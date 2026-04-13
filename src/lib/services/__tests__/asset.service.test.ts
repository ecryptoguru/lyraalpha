/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, cacheMock, redisMock } = vi.hoisted(() => ({
  prismaMock: { asset: { findUnique: vi.fn() }, assetScore: { findMany: vi.fn() } },
  cacheMock: { withCache: vi.fn() },
  redisMock: { invalidateCacheByPrefix: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/redis", () => ({ withCache: cacheMock.withCache, invalidateCacheByPrefix: redisMock.invalidateCacheByPrefix }));

import { AssetService, cryptoAssetSelect, analyticsAssetSelect, AnalyticsAsset } from "../asset.service";

const mockAsset: AnalyticsAsset = {
  id: "asset_1", symbol: "BTC-USD", name: "Bitcoin", type: "CRYPTO", sector: "Digital Assets",
  price: 65000, changePercent: 2.5, currency: "USD", lastPriceUpdate: new Date(),
  marketCap: 1200000000000, volume: 30000000000, avgVolume: 25000000000, oneYearChange: 120,
  technicalRating: "BUY", analystRating: "STRONG_BUY", fiftyTwoWeekHigh: 69000, fiftyTwoWeekLow: 42000,
  metadata: {}, category: null, openInterest: null, compatibilityScore: 85, compatibilityLabel: "FAVORABLE",
  assetGroup: "Core Crypto", avgTrendScore: 75, avgMomentumScore: 80, avgVolatilityScore: 65,
  avgLiquidityScore: 90, avgSentimentScore: 70, avgTrustScore: 85, factorData: null, correlationData: null,
  performanceData: null, correlationRegime: null, factorAlignment: null, eventAdjustedScores: null,
  signalStrength: null, scoreDynamics: null, description: null, cryptoIntelligence: null, scenarioData: null,
  industry: null, coingeckoId: "bitcoin", region: "US",
};

describe("AssetService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("getAssetBySymbol", () => {
    it("fetches asset with cache wrapper", async () => {
      cacheMock.withCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
      prismaMock.asset.findUnique.mockResolvedValue(mockAsset);

      const result = await AssetService.getAssetBySymbol("BTC-USD");

      expect(result).toEqual(mockAsset);
      expect(prismaMock.asset.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { symbol: "BTC-USD" }, select: analyticsAssetSelect,
      }));
    });

    it("normalizes symbol to uppercase", async () => {
      cacheMock.withCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
      prismaMock.asset.findUnique.mockResolvedValue(mockAsset);

      await AssetService.getAssetBySymbol("btc-usd");
      expect(prismaMock.asset.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { symbol: "BTC-USD" },
      }));
    });

    it("returns null when asset not found", async () => {
      cacheMock.withCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
      prismaMock.asset.findUnique.mockResolvedValue(null);

      const result = await AssetService.getAssetBySymbol("UNKNOWN");
      expect(result).toBeNull();
    });
  });

  describe("getAssetScores", () => {
    it("fetches scores with caching", async () => {
      const scores = [{ type: "TREND" as const, value: 75, date: new Date() }];
      cacheMock.withCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
      prismaMock.assetScore.findMany.mockResolvedValue(scores);

      const result = await AssetService.getAssetScores("asset_1", "BTC-USD", 30);

      expect(result).toEqual(scores);
      expect(prismaMock.assetScore.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { assetId: "asset_1", date: expect.objectContaining({ gte: expect.any(Date) }) },
        orderBy: { date: "desc" }, select: { type: true, value: true, date: true },
      }));
    });
  });

  describe("getAnalyticsCacheKey", () => {
    it("generates correct cache key", () => {
      expect(AssetService.getAnalyticsCacheKey("BTC-USD")).toBe("asset:analytics:BTC-USD");
    });

    it("normalizes to uppercase", () => {
      expect(AssetService.getAnalyticsCacheKey("btc-usd")).toBe("asset:analytics:BTC-USD");
    });
  });

  describe("getScoresCacheKey", () => {
    it("generates correct cache key", () => {
      expect(AssetService.getScoresCacheKey("BTC-USD", 30)).toBe("asset:scores:BTC-USD:30");
    });
  });

  describe("invalidateAsset", () => {
    it("invalidates all asset cache prefixes", async () => {
      await AssetService.invalidateAsset("BTC-USD");
      expect(redisMock.invalidateCacheByPrefix).toHaveBeenCalledWith("asset:metadata:BTC-USD");
      expect(redisMock.invalidateCacheByPrefix).toHaveBeenCalledWith("asset:analytics:BTC-USD");
      expect(redisMock.invalidateCacheByPrefix).toHaveBeenCalledWith("asset:scores:BTC-USD:");
      expect(redisMock.invalidateCacheByPrefix).toHaveBeenCalledWith("asset:dynamics:BTC-USD");
    });
  });
});

describe("cryptoAssetSelect", () => {
  it("contains expected fields", () => {
    expect(cryptoAssetSelect.symbol).toBe(true);
    expect(cryptoAssetSelect.name).toBe(true);
    expect(cryptoAssetSelect.price).toBe(true);
    expect(cryptoAssetSelect.metadata).toBe(true);
    expect(cryptoAssetSelect.coingeckoId).toBe(true);
  });
});

describe("analyticsAssetSelect", () => {
  it("contains region field", () => {
    expect(analyticsAssetSelect.region).toBe(true);
  });
});
