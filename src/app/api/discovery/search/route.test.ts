/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/services/discovery.service", () => ({
  DiscoveryService: {
    search: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitDiscovery: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit/utils", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/runtime-env", () => ({
  isRateLimitBypassEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/schemas", () => ({
  DiscoverySearchSchema: {
    _def: { typeName: "ZodObject" },
  },
  parseSearchParams: (_sp: any, _: any) => {
    const q = _sp.get("q");
    if (!q) return { success: false, error: { flatten: () => ({ fieldErrors: { q: ["Required"] } }) } };
    return { success: true, data: { q } };
  },
}));

import { DiscoveryService } from "@/lib/services/discovery.service";
import { auth } from "@/lib/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(q: string, extra = "") {
  return new NextRequest(`http://localhost/api/discovery/search?q=${q}${extra}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/discovery/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_starter" } as any);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when q param is missing", async () => {
    const req = new NextRequest("http://localhost/api/discovery/search");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // ── Crypto Access (no plan gating) ───────────────────────────────────────

  it("returns crypto assets in search results without plan filtering", async () => {
    vi.mocked(DiscoveryService.search).mockResolvedValue({
      sectors: [],
      assets: [
        { symbol: "BTC-USD", name: "Bitcoin", type: "CRYPTO", sectorSlug: "crypto", sectorName: "Crypto" },
        { symbol: "ETH-USD", name: "Ethereum", type: "CRYPTO", sectorSlug: "crypto", sectorName: "Crypto" },
        { symbol: "SOL-USD", name: "Solana", type: "CRYPTO", sectorSlug: "l1", sectorName: "Layer 1" },
      ] as any,
    });

    const res = await GET(makeRequest("bit"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Crypto assets should NOT be filtered out
    const cryptoAssets = json.assets.filter((a: any) => a.type === "CRYPTO");
    expect(cryptoAssets.length).toBeGreaterThan(0);
  });

  it("does not gate crypto search results for STARTER plan", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_starter" } as any);
    vi.mocked(DiscoveryService.search).mockResolvedValue({
      sectors: [],
      assets: [{ symbol: "SOL-USD", name: "Solana", type: "CRYPTO", sectorSlug: "crypto", sectorName: "Crypto" }] as any,
    });

    const res = await GET(makeRequest("sol"));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.assets).toHaveLength(1);
  });

  // ── Response Shape ───────────────────────────────────────────────────────

  it("returns sectors and assets in response", async () => {
    vi.mocked(DiscoveryService.search).mockResolvedValue({
      sectors: [{ id: "1", name: "Technology", slug: "tech" }] as any,
      assets: [{ symbol: "SOL-USD", name: "Solana", type: "CRYPTO", sectorSlug: "l1", sectorName: "Layer 1" }] as any,
    });

    const res = await GET(makeRequest("apple"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sectors).toBeDefined();
    expect(json.assets).toBeDefined();
  });

  it("returns empty arrays when DiscoveryService returns null", async () => {
    vi.mocked(DiscoveryService.search).mockResolvedValue(null);

    const res = await GET(makeRequest("nonexistent"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sectors).toEqual([]);
    expect(json.assets).toEqual([]);
  });

  // ── Region Parameter ────────────────────────────────────────────────────

  it("passes region parameter to DiscoveryService", async () => {
    vi.mocked(DiscoveryService.search).mockResolvedValue({ sectors: [], assets: [] });

    await GET(makeRequest("btc", "&region=IN"));
    expect(DiscoveryService.search).toHaveBeenCalledWith("btc", "IN", false);
  });

  it("passes global parameter to DiscoveryService", async () => {
    vi.mocked(DiscoveryService.search).mockResolvedValue({ sectors: [], assets: [] });

    await GET(makeRequest("btc", "&global=true"));
    expect(DiscoveryService.search).toHaveBeenCalledWith("btc", undefined, true);
  });

  // ── Error Handling ───────────────────────────────────────────────────────

  it("returns 500 when DiscoveryService throws", async () => {
    vi.mocked(DiscoveryService.search).mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest("btc"));
    expect(res.status).toBe(500);
  });
});
