/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/market-data", () => ({
  getQuotes: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitMarketData: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit/utils", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/schemas", () => ({
  StocksQuotesSchema: {
    _def: { typeName: "ZodArray" },
  },
  parseSearchParams: (_sp: any, _schema: any) => {
    const symbols = _sp.get("symbols");
    if (!symbols) return { success: false, error: { flatten: () => ({ fieldErrors: { symbols: ["Required"] } }) } };
    return { success: true, data: { symbols: symbols.split(",") } };
  },
}));

import { getQuotes } from "@/lib/market-data";
import { auth } from "@/lib/auth";
import { rateLimitMarketData } from "@/lib/rate-limit";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(symbols: string) {
  return new NextRequest(`http://localhost/api/stocks/quotes?symbols=${symbols}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/stocks/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_starter" } as any);
    vi.mocked(rateLimitMarketData).mockResolvedValue(null);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when symbols param is missing", async () => {
    const req = new NextRequest("http://localhost/api/stocks/quotes");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // ── Crypto Access (no plan gating) ───────────────────────────────────────

  it("allows crypto quotes without plan gating", async () => {
    vi.mocked(getQuotes).mockResolvedValue([
      { symbol: "BTC-USD", price: 42000, changePercent: 2.5 },
    ] as any);

    const res = await GET(makeRequest("BTC-USD"));
    // Should NOT return 403 — crypto quotes accessible to all plans
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it("allows mixed crypto + equity quotes", async () => {
    vi.mocked(getQuotes).mockResolvedValue([
      { symbol: "BTC-USD", price: 42000, changePercent: 2.5 },
      { symbol: "AAPL", price: 180, changePercent: -0.3 },
    ] as any);

    const res = await GET(makeRequest("BTC-USD,AAPL"));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
  });

  // ── Rate Limiting ────────────────────────────────────────────────────────

  it("returns rate limit error when exceeded", async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    vi.mocked(rateLimitMarketData).mockResolvedValue(rateLimitResponse as any);

    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(429);
  });

  // ── Error Handling ───────────────────────────────────────────────────────

  it("returns 500 when getQuotes throws", async () => {
    vi.mocked(getQuotes).mockRejectedValue(new Error("Market data unavailable"));

    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(500);
  });

  it("returns quotes data on success", async () => {
    const quotesData = [
      { symbol: "AAPL", price: 180, changePercent: -0.3 },
    ];
    vi.mocked(getQuotes).mockResolvedValue(quotesData as any);

    const res = await GET(makeRequest("AAPL"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(quotesData);
  });
});
