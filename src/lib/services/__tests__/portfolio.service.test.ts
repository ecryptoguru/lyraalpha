/**
 * @vitest-environment node
 *
 * Portfolio Service — unit tests for orchestration logic.
 * Mocks Prisma and Redis to test business logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolio: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    portfolioHealthSnapshot: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  delCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

// Mock engines to prevent loading their heavy transitive dep trees
vi.mock("@/lib/engines/portfolio-health", () => ({
  computePortfolioHealth: vi.fn().mockReturnValue({
    healthScore: 72,
    dimensions: {
      diversificationScore: 70,
      concentrationScore: 65,
      volatilityScore: 75,
      correlationScore: 80,
      qualityScore: 70,
    },
    band: "HEALTHY",
    holdingCount: 2,
    signals: [],
    alerts: [],
  }),
}));

vi.mock("@/lib/engines/portfolio-fragility", () => ({
  computePortfolioFragility: vi.fn().mockReturnValue({
    fragilityScore: 30,
    classification: "LOW",
    topDrivers: [],
    components: {},
    alerts: [],
  }),
}));

import { prisma } from "@/lib/prisma";
import { delCache } from "@/lib/redis";
import {
  computeAndStorePortfolioHealth,
  computeAllPortfoliosHealth,
} from "../portfolio.service";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePortfolio(holdingOverrides: Partial<{
  price: number | null;
  avgVolatilityScore: number | null;
  avgLiquidityScore: number | null;
  avgTrustScore: number | null;
  compatibilityScore: number | null;
}>[] = [{}]) {
  return {
    id: "portfolio-1",
    region: "US",
    holdings: holdingOverrides.map((o, i) => ({
      id: `holding-${i}`,
      symbol: `SYM${i}`,
      quantity: 10,
      avgPrice: 100,
      asset: {
        price: 110,
        type: "STOCK",
        sector: i % 2 === 0 ? "Technology" : "Finance",
        avgVolatilityScore: 40,
        avgLiquidityScore: 70,
        avgTrustScore: 75,
        avgSentimentScore: 60,
        compatibilityScore: 65,
        compatibilityLabel: "COMPATIBLE",
        ...o,
      },
    })),
  };
}

// ─── computeAndStorePortfolioHealth ──────────────────────────────────────────

describe("computeAndStorePortfolioHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips compute when portfolio not found", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(null);
    await computeAndStorePortfolioHealth("nonexistent");
    expect(prisma.portfolioHealthSnapshot.create).not.toHaveBeenCalled();
    expect(delCache).not.toHaveBeenCalled();
  });

  it("skips compute when portfolio has no holdings", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([]) as never,
    );
    await computeAndStorePortfolioHealth("portfolio-1");
    expect(prisma.portfolioHealthSnapshot.create).not.toHaveBeenCalled();
  });

  it("skips compute when all holdings have null price", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{ price: null }, { price: null }]) as never,
    );
    await computeAndStorePortfolioHealth("portfolio-1");
    expect(prisma.portfolioHealthSnapshot.create).not.toHaveBeenCalled();
  });

  it("skips compute when all holdings have zero price", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{ price: 0 }, { price: 0 }]) as never,
    );
    await computeAndStorePortfolioHealth("portfolio-1");
    expect(prisma.portfolioHealthSnapshot.create).not.toHaveBeenCalled();
  });

  it("creates snapshot for valid portfolio with priced holdings", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{}, {}]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    await computeAndStorePortfolioHealth("portfolio-1");

    expect(prisma.portfolioHealthSnapshot.create).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.portfolioHealthSnapshot.create).mock.calls[0][0];
    expect(call.data.portfolioId).toBe("portfolio-1");
    expect(typeof call.data.healthScore).toBe("number");
    expect(call.data.healthScore).toBeGreaterThanOrEqual(0);
    expect(call.data.healthScore).toBeLessThanOrEqual(100);
  });

  it("snapshot contains all 5 dimension scores", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{}, {}]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    await computeAndStorePortfolioHealth("portfolio-1");

    const data = vi.mocked(prisma.portfolioHealthSnapshot.create).mock.calls[0][0].data;
    expect(typeof data.diversificationScore).toBe("number");
    expect(typeof data.concentrationScore).toBe("number");
    expect(typeof data.volatilityScore).toBe("number");
    expect(typeof data.correlationScore).toBe("number");
    expect(typeof data.qualityScore).toBe("number");
    expect(typeof data.fragilityScore).toBe("number");
  });

  it("snapshot riskMetrics contains fragility classification and top drivers", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{}, {}]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    await computeAndStorePortfolioHealth("portfolio-1");

    const data = vi.mocked(prisma.portfolioHealthSnapshot.create).mock.calls[0][0].data;
    const metrics = data.riskMetrics as Record<string, unknown>;
    expect(metrics).toHaveProperty("fragilityClassification");
    expect(metrics).toHaveProperty("fragilityTopDrivers");
    expect(metrics).toHaveProperty("band");
    expect(metrics).toHaveProperty("holdingCount");
  });

  it("invalidates both health and analytics cache keys after snapshot", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{}, {}]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    await computeAndStorePortfolioHealth("portfolio-1");

    const cacheKeys = vi.mocked(delCache).mock.calls.map((c) => c[0]);
    expect(cacheKeys).toContain("portfolio:health:portfolio-1");
    expect(cacheKeys).toContain("portfolio:analytics:portfolio-1");
  });

  it("filters out holdings with null price before computing", async () => {
    // 1 valid + 1 null price → service filters to 1 holding before calling engine
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{ price: 110 }, { price: null }]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);
    // Override mock to reflect actual filtered input length
    const { computePortfolioHealth } = await import("@/lib/engines/portfolio-health");
    vi.mocked(computePortfolioHealth).mockImplementationOnce((inputs) => ({
      healthScore: 72,
      dimensions: {
        diversificationScore: 70,
        concentrationScore: 65,
        volatilityScore: 75,
        correlationScore: 80,
        qualityScore: 70,
      },
      band: "HEALTHY" as never,
      holdingCount: inputs.length,
      signals: [],
      alerts: [],
    }));

    await computeAndStorePortfolioHealth("portfolio-1");

    const data = vi.mocked(prisma.portfolioHealthSnapshot.create).mock.calls[0][0].data;
    const metrics = data.riskMetrics as Record<string, unknown>;
    expect(metrics.holdingCount).toBe(1);
  });

  it("null scores (avgVolatilityScore=null) do not throw", async () => {
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([
        { avgVolatilityScore: null, avgLiquidityScore: null, avgTrustScore: null, compatibilityScore: null },
        { avgVolatilityScore: null, avgLiquidityScore: null, avgTrustScore: null, compatibilityScore: null },
      ]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    await expect(computeAndStorePortfolioHealth("portfolio-1")).resolves.not.toThrow();
    expect(prisma.portfolioHealthSnapshot.create).toHaveBeenCalledOnce();
  });
});

// ─── computeAllPortfoliosHealth ───────────────────────────────────────────────

describe("computeAllPortfoliosHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { processed: 0, errors: 0 } for empty portfolio list", async () => {
    vi.mocked(prisma.portfolio.findMany).mockResolvedValue([]);
    const result = await computeAllPortfoliosHealth();
    expect(result.processed).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("processes all portfolios and returns correct counts", async () => {
    // First page returns 3 items, second page returns [] to stop the cursor loop
    vi.mocked(prisma.portfolio.findMany)
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }, { id: "p3" }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{}, {}]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    const result = await computeAllPortfoliosHealth();
    expect(result.processed).toBe(3);
    expect(result.errors).toBe(0);
  });

  it("counts errors correctly when some portfolios fail", async () => {
    vi.mocked(prisma.portfolio.findMany)
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }, { id: "p3" }] as never)
      .mockResolvedValueOnce([] as never);
    // p1 succeeds, p2 throws, p3 succeeds
    vi.mocked(prisma.portfolio.findUnique)
      .mockResolvedValueOnce(makePortfolio([{}, {}]) as never)
      .mockRejectedValueOnce(new Error("DB error"))
      .mockResolvedValueOnce(makePortfolio([{}, {}]) as never);
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    const result = await computeAllPortfoliosHealth();
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(1);
  });

  it("processes portfolios in batches of 5 (concurrency limit)", async () => {
    // 7 portfolios → 2 batches (5 + 2), second findMany returns [] to stop loop
    const portfolios = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}` }));
    vi.mocked(prisma.portfolio.findMany)
      .mockResolvedValueOnce(portfolios as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(
      makePortfolio([{}, {}]) as never,
    );
    vi.mocked(prisma.portfolioHealthSnapshot.create).mockResolvedValue({} as never);

    const result = await computeAllPortfoliosHealth();
    expect(result.processed).toBe(7);
    expect(result.errors).toBe(0);
    // findUnique called once per portfolio
    expect(prisma.portfolio.findUnique).toHaveBeenCalledTimes(7);
  });

  it("all errors → processed=0, errors=N", async () => {
    vi.mocked(prisma.portfolio.findMany)
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.portfolio.findUnique).mockRejectedValue(new Error("fail"));

    const result = await computeAllPortfoliosHealth();
    expect(result.processed).toBe(0);
    expect(result.errors).toBe(2);
  });
});
