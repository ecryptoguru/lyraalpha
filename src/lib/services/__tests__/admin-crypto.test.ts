import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    asset: { count: vi.fn(), groupBy: vi.fn() },
    assetScore: { count: vi.fn() },
    watchlistItem: { count: vi.fn() },
    marketRegime: { findFirst: vi.fn(), findMany: vi.fn() },
    aIRequestLog: { count: vi.fn(), groupBy: vi.fn() },
    user: { count: vi.fn(), groupBy: vi.fn() },
    subscription: { count: vi.fn(), groupBy: vi.fn() },
    priceHistory: { count: vi.fn() },
    institutionalEvent: { count: vi.fn() },
    knowledgeDoc: { count: vi.fn(), groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { info: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    info: vi.fn().mockResolvedValue(""),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    ping: vi.fn().mockResolvedValue("PONG"),
  })),
}));

import { prisma } from "@/lib/prisma";

describe("Admin Service — Crypto Extensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEngineStats — cryptoIntelligenceStats", () => {
    it("should include cryptoIntelligenceStats in the response shape", async () => {
      // Mock the 5 queries in getEngineStats: scoreDistributions, compatibilityDist, assetCoverage, cryptoIntelRows, signalWeightRows
      (prisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // scoreDistributions
        .mockResolvedValueOnce([]) // compatibilityDist
        .mockResolvedValueOnce([]) // assetCoverage
        .mockResolvedValueOnce([
          {
            avgNetworkActivity: 65.5,
            avgHolderStability: 72.3,
            avgLiquidityRisk: 34.1,
            avgEnhancedTrust: 58.7,
            assetsWithCryptoIntel: 150,
            totalCryptoAssets: 200,
          },
        ]) // cryptoIntelRows
        .mockResolvedValueOnce([
          { weight: "HIGH", count: 50 },
          { weight: "MEDIUM", count: 80 },
          { weight: "LOW", count: 20 },
        ]); // signalWeightRows

      const { getEngineStats } = await import("@/lib/services/admin.service");
      const result = await getEngineStats();

      expect(result).toHaveProperty("cryptoIntelligenceStats");
      expect(result.cryptoIntelligenceStats).not.toBeNull();
      expect(result.cryptoIntelligenceStats).toHaveProperty("avgNetworkActivity", 65.5);
      expect(result.cryptoIntelligenceStats).toHaveProperty("avgHolderStability", 72.3);
      expect(result.cryptoIntelligenceStats).toHaveProperty("avgLiquidityRisk", 34.1);
      expect(result.cryptoIntelligenceStats).toHaveProperty("avgEnhancedTrust", 58.7);
      expect(result.cryptoIntelligenceStats).toHaveProperty("assetsWithCryptoIntel", 150);
      expect(result.cryptoIntelligenceStats).toHaveProperty("totalCryptoAssets", 200);
      expect(result.cryptoIntelligenceStats).toHaveProperty("signalWeightBreakdown");
      expect(result.cryptoIntelligenceStats!.signalWeightBreakdown).toHaveLength(3);
      expect(result.cryptoIntelligenceStats!.signalWeightBreakdown[0]).toEqual({
        weight: "HIGH",
        count: 50,
      });
    });

    it("should return null cryptoIntelligenceStats when no crypto intel rows", async () => {
      (prisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]) // no crypto intel rows
        .mockResolvedValueOnce([]); // no signal weight rows

      const { getEngineStats } = await import("@/lib/services/admin.service");
      const result = await getEngineStats();

      expect(result.cryptoIntelligenceStats).toBeNull();
    });
  });

  describe("getInfraStats — cryptoSyncHealth", () => {
    it("should include cryptoSyncHealth with age hours fields", async () => {
      const syncDate = new Date("2025-04-13T10:00:00Z");

      // Mock all count/groupBy calls used by getInfraStats
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(200);
      (prisma.aIRequestLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      (prisma.aIRequestLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.priceHistory.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (prisma.institutionalEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      (prisma.assetScore.count as ReturnType<typeof vi.fn>).mockResolvedValue(500);
      (prisma.watchlistItem.count as ReturnType<typeof vi.fn>).mockResolvedValue(80);

      // Only one $queryRaw call in getInfraStats — for cryptoSyncRows
      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          lastCoinGeckoSync: syncDate,
          lastNewsDataSync: syncDate,
          totalCryptoAssets: BigInt(200),
          freshAssetCount: BigInt(180),
          staleAssetCount: BigInt(20),
        },
      ]);

      const { getInfraStats } = await import("@/lib/services/admin.service");
      const result = await getInfraStats();

      expect(result).toHaveProperty("cryptoSyncHealth");
      expect(result.cryptoSyncHealth).not.toBeNull();
      expect(result.cryptoSyncHealth).toHaveProperty("lastCoinGeckoSync");
      expect(result.cryptoSyncHealth).toHaveProperty("lastNewsDataSync");
      expect(result.cryptoSyncHealth).toHaveProperty("lastCoinGeckoSyncAgeH");
      expect(result.cryptoSyncHealth).toHaveProperty("lastNewsDataSyncAgeH");
      expect(result.cryptoSyncHealth).toHaveProperty("pctAssetsFresh");
      expect(result.cryptoSyncHealth).toHaveProperty("totalCryptoAssets", 200);
      expect(result.cryptoSyncHealth).toHaveProperty("freshAssetCount", 180);
      expect(result.cryptoSyncHealth).toHaveProperty("staleAssetCount", 20);
      // Age hours should be a number (not null since sync dates exist)
      expect(typeof result.cryptoSyncHealth!.lastCoinGeckoSyncAgeH).toBe("number");
      expect(typeof result.cryptoSyncHealth!.lastNewsDataSyncAgeH).toBe("number");
    });

    it("should return null cryptoSyncHealth when no sync rows", async () => {
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.aIRequestLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.aIRequestLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.priceHistory.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.institutionalEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.assetScore.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.watchlistItem.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      // Empty array = no crypto sync rows
      (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const { getInfraStats } = await import("@/lib/services/admin.service");
      const result = await getInfraStats();

      expect(result.cryptoSyncHealth).toBeNull();
    });
  });

  describe("getCryptoDataSourceStats", () => {
    it("should return all expected top-level keys", async () => {
      // Mock all 8 parallel queries
      (prisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ totalAssets: 200, freshCount: 180, staleCount: 20, withMetadata: 190, noMetadataCount: 10, lastSync: new Date() }]) // coingecko
        .mockResolvedValueOnce([{ events24h: 50, events7d: 300, avgPerDay: 42, lastEvent: new Date() }]) // newsdata
        .mockResolvedValueOnce([{ assetsWithPoolData: 100, totalPools: 500 }]) // geckoTerminal
        .mockResolvedValueOnce([{ assetsWithTvl: 80, totalTvlUsd: 50000000000 }]) // defiLlama
        .mockResolvedValueOnce([{ assetsWithOiData: 60, assetsWithFuturesMetadata: 70 }]) // coinglass
        .mockResolvedValueOnce([{ assetsWithMessariData: 40 }]) // messari
        .mockResolvedValueOnce([{ currentState: "RISK_ON", lastCalculated: new Date(), cryptoBenchmarks: ["BTC", "ETH"] }]) // marketRegime
        .mockResolvedValueOnce([{ bucket: "Large Cap", fresh: 80, stale: 10, missing: 5 }]); // priceFreshness

      const { getCryptoDataSourceStats } = await import("@/lib/services/admin.service");
      const result = await getCryptoDataSourceStats();

      expect(result).toHaveProperty("coingecko");
      expect(result).toHaveProperty("newsdata");
      expect(result).toHaveProperty("geckoTerminal");
      expect(result).toHaveProperty("defiLlama");
      expect(result).toHaveProperty("coinglass");
      expect(result).toHaveProperty("messari");
      expect(result).toHaveProperty("marketRegime");
      expect(result).toHaveProperty("priceFreshness");

      // Verify CoinGecko shape
      expect(result.coingecko).toHaveProperty("totalAssets");
      expect(result.coingecko).toHaveProperty("freshCount");
      expect(result.coingecko).toHaveProperty("staleCount");
      expect(result.coingecko).toHaveProperty("withMetadata");
      expect(result.coingecko).toHaveProperty("noMetadataCount");
      expect(result.coingecko).toHaveProperty("lastSync");

      // Verify NewsData shape
      expect(result.newsdata).toHaveProperty("events24h");
      expect(result.newsdata).toHaveProperty("events7d");
      expect(result.newsdata).toHaveProperty("avgPerDay");
      expect(result.newsdata).toHaveProperty("lastEvent");

      // Verify MarketRegime shape
      expect(result.marketRegime).toHaveProperty("currentState");
      expect(result.marketRegime).toHaveProperty("lastCalculated");
      expect(result.marketRegime).toHaveProperty("cryptoBenchmarks");

      // Verify PriceFreshness shape
      expect(result.priceFreshness).toBeInstanceOf(Array);
      expect(result.priceFreshness[0]).toHaveProperty("bucket");
      expect(result.priceFreshness[0]).toHaveProperty("fresh");
      expect(result.priceFreshness[0]).toHaveProperty("stale");
      expect(result.priceFreshness[0]).toHaveProperty("missing");
    });
  });
});
