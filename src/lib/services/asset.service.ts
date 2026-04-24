import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";
import { Prisma } from "@/generated/prisma/client";

export const cryptoAssetSelect = {
  id: true,
  symbol: true,
  name: true,
  type: true,
  sector: true,
  price: true,
  changePercent: true,
  currency: true,
  lastPriceUpdate: true,
  marketCap: true,
  volume: true,
  avgVolume: true,
  oneYearChange: true,
  technicalRating: true,
  analystRating: true,
  fiftyTwoWeekHigh: true,
  fiftyTwoWeekLow: true,
  metadata: true,
  category: true,
  openInterest: true,
  compatibilityScore: true,
  compatibilityLabel: true,
  assetGroup: true,
  avgTrendScore: true,
  avgMomentumScore: true,
  avgVolatilityScore: true,
  avgLiquidityScore: true,
  avgSentimentScore: true,
  avgTrustScore: true,
  factorData: true,
  correlationData: true,
  performanceData: true,
  correlationRegime: true,
  factorAlignment: true,
  eventAdjustedScores: true,
  signalStrength: true,
  scoreDynamics: true,
  description: true,
  cryptoIntelligence: true,
  scenarioData: true,
  industry: true,
  coingeckoId: true,
  holderGini: true,
  top10HolderPercent: true,
  fundingRate: true,
  exchangeFlows: true,
  stakingYield: true,
  emissionSchedule: true,
  governanceData: true,
} as const;

export const analyticsAssetSelect = {
  id: true,
  symbol: true,
  name: true,
  type: true,
  sector: true,
  price: true,
  changePercent: true,
  currency: true,
  lastPriceUpdate: true,
  marketCap: true,
  volume: true,
  avgVolume: true,
  oneYearChange: true,
  fiftyTwoWeekHigh: true,
  fiftyTwoWeekLow: true,
  category: true,
  openInterest: true,
  technicalRating: true,
  analystRating: true,
  metadata: true,
  compatibilityScore: true,
  compatibilityLabel: true,
  assetGroup: true,
  avgTrendScore: true,
  avgMomentumScore: true,
  avgVolatilityScore: true,
  avgLiquidityScore: true,
  avgSentimentScore: true,
  avgTrustScore: true,
  factorData: true,
  correlationData: true,
  performanceData: true,
  correlationRegime: true,
  factorAlignment: true,
  eventAdjustedScores: true,
  signalStrength: true,
  scoreDynamics: true,
  description: true,
  cryptoIntelligence: true,
  scenarioData: true,
  industry: true,
  coingeckoId: true,
  region: true,
  holderGini: true,
  top10HolderPercent: true,
  fundingRate: true,
  exchangeFlows: true,
  stakingYield: true,
  emissionSchedule: true,
  governanceData: true,
} as const;

export type AnalyticsAsset = Prisma.AssetGetPayload<{
  select: typeof analyticsAssetSelect;
}>;

export class AssetService {
  private static CACHE_TTL_SECONDS = 300; // 5 minutes — aligned with analytics cache to prevent stale prices
  private static ANALYTICS_TTL_SECONDS = 300; // 5 minutes
  private static SCORES_TTL_SECONDS = 900; // 15 minutes

  /**
   * Retrieves asset metadata by symbol, using Redis cache if available.
   * Does NOT include heavy relationships like PriceHistory or AssetScore.
   */
  static async getAssetBySymbol(symbol: string): Promise<AnalyticsAsset | null> {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `asset:metadata:${upperSymbol}`;

    return withCache<AnalyticsAsset>(
      cacheKey,
      () => prisma.asset.findUnique({
        where: { symbol: upperSymbol },
        select: analyticsAssetSelect,
      }),
      this.CACHE_TTL_SECONDS
    );
  }

  /**
   * Batch variant of getAssetBySymbol. One DB round-trip for N symbols.
   * Returns a map keyed by uppercase symbol; missing symbols are absent from the map.
   * Prefer this over Promise.all(symbols.map(getAssetBySymbol)) for N>1.
   */
  static async getAssetsBySymbols(symbols: string[]): Promise<Map<string, AnalyticsAsset>> {
    const upperSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
    if (upperSymbols.length === 0) return new Map();
    const rows = await prisma.asset.findMany({
      where: { symbol: { in: upperSymbols } },
      select: analyticsAssetSelect,
    });
    const map = new Map<string, AnalyticsAsset>();
    for (const row of rows) map.set(row.symbol, row);
    return map;
  }

  static getAnalyticsCacheKey(symbol: string): string {
    return `asset:analytics:${symbol.toUpperCase()}`;
  }

  static getScoresCacheKey(symbol: string, days: number): string {
    return `asset:scores:${symbol.toUpperCase()}:${days}`;
  }

  static async getAssetScores(
    assetId: string,
    symbol: string,
    days: number = 30,
  ) {
    const cacheKey = this.getScoresCacheKey(symbol, days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return withCache(
      cacheKey,
      () => prisma.assetScore.findMany({
        where: { assetId, date: { gte: since } },
        orderBy: { date: "desc" },
        select: { type: true, value: true, date: true },
      }),
      this.SCORES_TTL_SECONDS,
    );
  }

  /**
   * Invalidates the cache for a specific symbol.
   * Should be called after updates.
   */
  static async invalidateAsset(symbol: string): Promise<void> {
    const upperSymbol = symbol.toUpperCase();
    // Sweep all cache keys for this symbol rather than enumerating specific durations.
    // This ensures no stale data remains if new cache durations are added elsewhere.
    const { invalidateCacheByPrefix } = await import("@/lib/redis");
    await invalidateCacheByPrefix(`asset:metadata:${upperSymbol}`);
    await invalidateCacheByPrefix(`asset:analytics:${upperSymbol}`);
    await invalidateCacheByPrefix(`asset:scores:${upperSymbol}:`);
    await invalidateCacheByPrefix(`asset:dynamics:${upperSymbol}`);
  }
}
