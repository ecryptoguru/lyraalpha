/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/market-data", () => ({
  fetchAssetData: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/schemas", () => ({
  StockHistorySchema: {
    safeParse: (data: any) => {
      if (!data.symbol || !data.range) {
        return { success: false, error: { flatten: () => ({ fieldErrors: { symbol: ["Required"] } }) } };
      }
      return { success: true, data };
    },
  },
}));

vi.mock("@/lib/api-response", () => ({
  apiError: (msg: string, status: number) => new Response(JSON.stringify({ error: msg }), { status }),
}));

import { fetchAssetData } from "@/lib/market-data";
import { getCache, setCache } from "@/lib/redis";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(symbol: string, range = "1mo") {
  return new NextRequest(`http://localhost/api/stocks/history?symbol=${symbol}&range=${range}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/stocks/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCache).mockResolvedValue(null);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 for missing symbol", async () => {
    const res = await GET(makeRequest("", "1mo"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for undefined/null symbol literals", async () => {
    const res1 = await GET(makeRequest("undefined", "1mo"));
    expect(res1.status).toBe(400);
    const res2 = await GET(makeRequest("null", "1mo"));
    expect(res2.status).toBe(400);
  });

  // ── Crypto Access (no plan gating) ───────────────────────────────────────

  it("allows crypto symbol without plan gating", async () => {
    vi.mocked(fetchAssetData).mockResolvedValue([{ date: "2024-01-01", open: 41500, high: 42500, low: 41000, close: 42000, volume: 1000 }] as any);
    const res = await GET(makeRequest("BTC-USD", "1mo"));
    // Should NOT return 403 — crypto is accessible to all plans
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it("allows ETH-USD without plan gating", async () => {
    vi.mocked(fetchAssetData).mockResolvedValue([{ date: "2024-01-01", open: 2150, high: 2250, low: 2100, close: 2200, volume: 500 }] as any);
    const res = await GET(makeRequest("ETH-USD", "1mo"));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  // ── Cache ────────────────────────────────────────────────────────────────

  it("returns cached data when available", async () => {
    const cachedData = [{ date: "2024-01-01", open: 41500, high: 42500, low: 41000, close: 42000, volume: 1000 }];
    vi.mocked(getCache).mockResolvedValue(cachedData);

    const res = await GET(makeRequest("AAPL", "1mo"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(cachedData);
    expect(fetchAssetData).not.toHaveBeenCalled();
  });

  it("caches fresh data with correct TTL", async () => {
    const freshData = [{ date: "2024-01-01", open: 178, high: 182, low: 176, close: 180, volume: 5000 }] as any;
    vi.mocked(fetchAssetData).mockResolvedValue(freshData);

    const res = await GET(makeRequest("AAPL", "1mo"));
    expect(res.status).toBe(200);
    expect(setCache).toHaveBeenCalledWith(
      "history:AAPL:1mo",
      freshData,
      300, // 1mo TTL
    );
  });

  // ── Error Handling ───────────────────────────────────────────────────────

  it("returns 404 when fetchAssetData returns an error", async () => {
    vi.mocked(fetchAssetData).mockResolvedValue({ error: "Not found" });

    const res = await GET(makeRequest("FAKE", "1mo"));
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(fetchAssetData).mockRejectedValue(new Error("Network failure"));

    const res = await GET(makeRequest("AAPL", "1mo"));
    expect(res.status).toBe(500);
  });

  // ── Range TTL mapping ────────────────────────────────────────────────────

  it.each([
    ["1d", 60],
    ["5d", 120],
    ["1mo", 300],
    ["3mo", 600],
    ["6mo", 900],
    ["1y", 1800],
    ["5y", 3600],
  ])("uses correct TTL for range %s", async (range, expectedTtl) => {
    vi.mocked(fetchAssetData).mockResolvedValue([{ date: "2024-01-01", open: 99, high: 101, low: 98, close: 100, volume: 1000 }] as any);

    await GET(makeRequest("AAPL", range));
    expect(setCache).toHaveBeenCalledWith(
      `history:AAPL:${range}`,
      expect.anything(),
      expectedTtl,
    );
  });
});
