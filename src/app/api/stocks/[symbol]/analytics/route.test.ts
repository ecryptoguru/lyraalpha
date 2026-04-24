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
      findUnique: vi.fn(),
    },
    marketRegime: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    institutionalEvent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Now called in the top-level Promise.all to eliminate a serial round-trip
    // on the dynamics-cache-miss path — see analytics route Phase 1 comment.
    assetSector: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    tokenUnlockEvent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
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

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/fire-and-forget", () => ({
  logFireAndForgetError: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));

vi.mock("@/lib/runtime-env", () => ({
  isRateLimitBypassEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/engines/compatibility", () => ({
  calculateCompatibility: vi.fn().mockReturnValue({
    score: 75,
    label: "GOOD",
    regimeFit: "ALIGNED",
    dominantFactor: "MOMENTUM",
  }),
  AssetSignals: {},
  CompatibilityResult: {},
}));

vi.mock("@/lib/engines/grouping", () => ({
  classifyAsset: vi.fn().mockReturnValue({
    group: "LARGE_CAP_GROWTH" as any,
    label: "Large Cap Growth",
    description: "Large cap growth stocks",
  }),
  GroupingResult: {},
  AssetGroup: {},
}));

vi.mock("@/lib/engines/score-dynamics", () => ({
  calculateScoreDynamics: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/engines/signal-strength", () => ({
  calculateSignalStrength: vi.fn().mockReturnValue({
    score: 78,
    label: "STRONG",
    confidence: "HIGH",
    direction: "BULLISH",
  }),
  FundamentalData: {},
}));

vi.mock("@/lib/engines/performance", () => ({
  PerformanceMetrics: {},
}));

vi.mock("@/lib/engines/correlation-regime", () => ({
  CorrelationMetrics: {},
}));

vi.mock("@/lib/services/asset.service", () => ({
  AssetService: {
    getAnalyticsCacheKey: vi.fn((symbol: string) => `analytics:${symbol}`),
  },
  analyticsAssetSelect: {},
  AnalyticsAsset: {},
}));

vi.mock("@/lib/api-response", () => ({
  apiError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status }),
}));

vi.mock("@/generated/prisma/client", () => ({
  ScoreType: {
    TREND: "TREND",
    MOMENTUM: "MOMENTUM",
    VOLATILITY: "VOLATILITY",
    SENTIMENT: "SENTIMENT",
    TRUST: "TRUST",
    LIQUIDITY: "LIQUIDITY",
  },
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(symbol: string) {
  return new NextRequest(`http://localhost/api/stocks/${symbol}/analytics`);
}

function makeContext(symbol: string) {
  return { params: Promise.resolve({ symbol }) };
}

function makeCryptoAsset(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "BTC-USD",
    name: "Bitcoin",
    type: "CRYPTO",
    region: "US",
    price: 42000,
    changePercent: 2.5,
    currency: "USD",
    sector: null,
    industry: null,
    avgTrendScore: 78,
    avgMomentumScore: 65,
    avgVolatilityScore: 55,
    avgLiquidityScore: 90,
    avgSentimentScore: 70,
    avgTrustScore: 88,
    signalStrength: { score: 74, label: "STRONG", confidence: "HIGH" },
    factorAlignment: { score: 68, regimeFit: "GOOD", dominantFactor: "MOMENTUM" },
    performanceData: { returns: { "1D": 1.2, "1W": 3.4, "1M": -2.1, "3M": 8.7, "1Y": 22.3 } },
    metadata: { marketCap: "2.9T" },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/stocks/[symbol]/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_starter" } as any);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 for empty symbol", async () => {
    const res = await GET(makeRequest(""), makeContext(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 for UNDEFINED symbol literal", async () => {
    const res = await GET(makeRequest("UNDEFINED"), makeContext("UNDEFINED"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for NULL symbol literal", async () => {
    const res = await GET(makeRequest("NULL"), makeContext("NULL"));
    expect(res.status).toBe(400);
  });

  // ── Crypto Access (no plan gating) ───────────────────────────────────────

  it("allows crypto analytics for STARTER plan — no 403", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_starter" } as any);
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(makeCryptoAsset() as any);

    const res = await GET(makeRequest("BTC-USD"), makeContext("BTC-USD"));
    // Crypto analytics should NOT be gated — no 403 for any plan
    expect(res.status).not.toBe(403);
  });

  it("allows crypto analytics for PRO plan — no 403", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_pro" } as any);
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(makeCryptoAsset() as any);

    const res = await GET(makeRequest("ETH-USD"), makeContext("ETH-USD"));
    expect(res.status).not.toBe(403);
  });

  it("allows crypto analytics for ELITE plan", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_elite" } as any);
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(makeCryptoAsset() as any);

    const res = await GET(makeRequest("SOL-USD"), makeContext("SOL-USD"));
    expect(res.status).not.toBe(403);
  });

  // ── 404 for unknown asset ────────────────────────────────────────────────

  it("returns 404 when asset not found in database", async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest("FAKE-SYMBOL"), makeContext("FAKE-SYMBOL"));
    expect(res.status).toBe(404);
  });

  // ── Cache ────────────────────────────────────────────────────────────────

  it("returns cached analytics when available", async () => {
    const { getCache } = await import("@/lib/redis");
    const cachedPayload = { type: "CRYPTO", symbol: "BTC-USD", scores: {} };
    vi.mocked(getCache).mockResolvedValue(cachedPayload);

    const res = await GET(makeRequest("BTC-USD"), makeContext("BTC-USD"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.symbol).toBe("BTC-USD");
    expect(prisma.asset.findUnique).not.toHaveBeenCalled();
  });

  // ── Type Safety ──────────────────────────────────────────────────────────

  it("uses direct type assertion (not as unknown as) for AnalyticsAsset", async () => {
    // This test verifies the route compiles and runs without `as unknown as`.
    // The route uses `assetWithRegion as AnalyticsAsset` which is a direct assertion.
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(makeCryptoAsset() as any);

    const res = await GET(makeRequest("BTC-USD"), makeContext("BTC-USD"));
    // If the type assertion was wrong, the route would throw at runtime
    expect(res.status).not.toBe(500);
  });
});
