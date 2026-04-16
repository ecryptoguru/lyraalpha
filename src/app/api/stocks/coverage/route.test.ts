/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    marketRegime: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitMarketData: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit/utils", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  getUserPlan: vi.fn().mockResolvedValue("STARTER"),
  canAccessRegion: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/runtime-env", () => ({
  isRateLimitBypassEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    AssetWhereInput: {},
    EnumAssetTypeFilter: {},
  },
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserPlan, canAccessRegion } from "@/lib/middleware/plan-gate";
import { getCache } from "@/lib/redis";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(extra = "") {
  return new NextRequest(`http://localhost/api/stocks/coverage?region=US${extra}`);
}

function makeCryptoAsset(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "BTC-USD",
    name: "Bitcoin",
    type: "CRYPTO",
    price: 42000,
    changePercent: 2.5,
    currency: "USD",
    sector: null,
    lastPriceUpdate: new Date(),
    marketCap: "2.9T",
    volume: 1000000,
    oneYearChange: 120,
    fiftyTwoWeekHigh: 73000,
    fiftyTwoWeekLow: 25000,
    category: null,
    metadata: {},
    compatibilityScore: 72,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/stocks/coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_starter" } as any);
    vi.mocked(getUserPlan).mockResolvedValue("STARTER" as any);
    vi.mocked(canAccessRegion).mockReturnValue(true);
    vi.mocked(getCache).mockResolvedValue(null);
  });

  // ── Crypto Access (no plan gating on asset type) ──────────────────────────

  it("returns crypto assets for STARTER plan — no type gating", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([makeCryptoAsset()] as any);
    vi.mocked(prisma.asset.count).mockResolvedValue(1);

    const res = await GET(makeRequest("&type=CRYPTO"));
    // Should NOT return 403 — crypto is accessible to all plans
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it("includes crypto assets in unfiltered coverage for STARTER plan", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      makeCryptoAsset({ symbol: "BTC-USD" }),
      makeCryptoAsset({ symbol: "ETH-USD", type: "CRYPTO" }),
    ] as any);
    vi.mocked(prisma.asset.count).mockResolvedValue(2);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    const cryptoAssets = json.assets.filter((a: any) => a.type === "CRYPTO");
    expect(cryptoAssets.length).toBeGreaterThan(0);
  });

  // ── Region Gating (still active) ────────────────────────────────────────

  it("returns 403 when STARTER plan accesses restricted region", async () => {
    vi.mocked(canAccessRegion).mockReturnValue(false);

    const res = await GET(new NextRequest("http://localhost/api/stocks/coverage?region=JP"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Starter and Pro plans");
  });

  it("allows US region for STARTER plan", async () => {
    vi.mocked(canAccessRegion).mockReturnValue(true);
    vi.mocked(prisma.asset.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.asset.count).mockResolvedValue(0);

    const res = await GET(makeRequest());
    expect(res.status).not.toBe(403);
  });

  // ── Pagination ──────────────────────────────────────────────────────────

  it("respects page and limit parameters", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.asset.count).mockResolvedValue(100);

    const res = await GET(makeRequest("&page=2&limit=10"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(10);
  });

  // ── Cache ────────────────────────────────────────────────────────────────

  it("returns cached coverage when available", async () => {
    const { getCache } = await import("@/lib/redis");
    const cachedData = { assets: [makeCryptoAsset()], total: 1, page: 1, limit: 30 };
    vi.mocked(getCache).mockResolvedValue(cachedData);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.assets).toHaveLength(1);
    expect(prisma.asset.findMany).not.toHaveBeenCalled();
  });

  // ── Response Structure ────────────────────────────────────────────────────

  it("returns marketContext and pagination in response", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.asset.count).mockResolvedValue(0);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    // Response shape: { marketContext, assets, pagination, lastSync }
    expect(json).toHaveProperty("assets");
    expect(json).toHaveProperty("pagination");
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.hasMore).toBe(false);
  });
});
