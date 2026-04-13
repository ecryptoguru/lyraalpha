import { directPrisma as prisma } from "../prisma";
import { Asset, AssetType, ScoreType, Prisma } from "@/generated/prisma/client";
import { cleanHistory, dailyReturns } from "../engines/utils";
import { fetchAssetData } from "../market-data";
import { calculateTrendScore } from "../engines/trend";
import { calculateMomentumScore } from "../engines/momentum";
import { calculateVolatilityScore } from "../engines/volatility";
import { calculateLiquidityScore } from "../engines/liquidity";
import { calculateTrustScore } from "../engines/trust";
import { calculateSentimentScore } from "../engines/sentiment";
import { calculateMarketContext } from "../engines/market-regime";
import { calculateCorrelationRegime, type CorrelationMetrics } from "../engines/correlation-regime";
import { calculateFactorProfile, FactorProfile } from "../engines/factor-attribution";
import { calculateCorrelations } from "../engines/correlation-hub";
import { storeMultiHorizonRegime } from "../engines/multi-horizon-regime";
import { calculatePerformance } from "../engines/performance";
import { calculateFactorRegimeAlignment } from "../engines/factor-alignment";
import { calculateEventAdjustedScore } from "../engines/event-scoring";
import { calculateSignalStrength, FundamentalData } from "../engines/signal-strength";
import { EngineResult, OHLCV } from "../engines/types";

import { MarketQuote } from "@/types/market-data";
import { createLogger } from "@/lib/logger";
import { createTimer, sanitizeError } from "@/lib/logger/utils";
import { asPrismaJsonValue } from "@/lib/utils/json";
import { getEnv } from "@/lib/env/schema";

import { calculateCompatibility } from "../engines/compatibility";
import { classifyAsset } from "../engines/grouping";
import { SYNC_CONFIG } from "../engines/constants";
import { getCache, setCache } from "@/lib/redis";
import { MacroResearchService } from "./macro-research.service";
import { AssetService } from "./asset.service";
import { CoinGeckoService } from "./coingecko.service";
import {
  isCryptoSymbol,
  symbolToCoingeckoId,
  getDefaultCryptoSymbols,
  CRYPTO_DISPLAY_NAMES,
} from "./coingecko-mapping";
import { IntelligenceEventsService } from "./intelligence-events.service";
import {
  getHistoryConfidence,
  resolveSingleSourceField,
  type HistoryConfidence,
  type SourcedField,
} from "@/lib/data-quality/reliability";

const logger = createLogger({ service: "market-sync" });

interface EngineSignals {
  trend: EngineResult;
  momentum: EngineResult;
  volatility: EngineResult;
  liquidity: EngineResult;
  sentiment: EngineResult;
  trust: EngineResult;
}

type AssetWithHistory = Prisma.AssetGetPayload<{
  include: { 
    priceHistory: true,
    scores: { select: { date: true }, take: 1 }
  }
}>;

interface AssetComputeSignals {
  symbol: string;
  signals: EngineSignals;
  history: OHLCV[];
  asset: AssetWithHistory;
  historyConfidence: HistoryConfidence;
}

const DEFAULT_SYMBOLS = [
  // Digital Assets — Top 50 by market cap (synced via CoinGecko, not Yahoo)
  ...getDefaultCryptoSymbols(),
];

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  ...CRYPTO_DISPLAY_NAMES,
};

// Env-driven symbol extension — add extra symbols without code changes.
// Format: EXTRA_SYNC_SYMBOLS="COIN,MARA,RIOT" (comma-separated)
const EXTRA_SYMBOLS: string[] = (getEnv().EXTRA_SYNC_SYMBOLS ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

if (EXTRA_SYMBOLS.length > 0) {
  for (const sym of EXTRA_SYMBOLS) {
    if (!DEFAULT_SYMBOLS.includes(sym)) DEFAULT_SYMBOLS.push(sym);
  }
}

// Pre-computed Set for O(1) dedup in resolveUniverse — avoids rebuilding on every sync cycle
const DEFAULT_SYMBOLS_SET = new Set(DEFAULT_SYMBOLS);

const CRYPTO_QUOTES_SLA_HOURS = parseInt(getEnv().CRYPTO_QUOTES_SLA_HOURS, 10);
const LIQUIDITY_SLA_HOURS = parseInt(getEnv().LIQUIDITY_SLA_HOURS, 10);
const CRYPTO_DEX_SLA_HOURS = parseInt(getEnv().CRYPTO_DEX_SLA_HOURS, 10);

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hoursSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ts = new Date(date).getTime();
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60);
}

function toJsonObject(value: unknown): Prisma.JsonObject {
  return value as Prisma.JsonObject;
}

export class MarketSyncService {

  /**
   * Phase 1: Harvest Universe
   * Fetches crypto data from CoinGecko and persists to DB.
   */
  static async harvestUniverse(
    forceFull: boolean = false,
    targetSymbol?: string,
    region?: string,
    symbolsOverride?: string[],
  ) {
    const timer = createTimer();
    const currentHour = new Date().getHours();
    const isDailyWindow = currentHour === 0;
    const shouldFetchDeepInstitutional = forceFull || isDailyWindow;

    logger.info(
      {
        shouldFetchDeepInstitutional,
        forceFull,
        targetSymbol,
        region,
      },
      "📡 Phase 1: Harvesting crypto universe data...",
    );

    let symbols = symbolsOverride ?? await this.resolveUniverse(region);
    if (targetSymbol) {
      symbols = [targetSymbol.toUpperCase()];
    }

    // Sync universe definitions (upserts Asset records with type + coingeckoId)
    const syncedAssets = await this.syncUniverse(symbols);
    const assetMap = new Map<string, Asset>(syncedAssets.map((a) => [a.symbol, a]));

    // Phase 1-CG: Harvest crypto via CoinGecko
    const cryptoSymbols = symbols.filter(isCryptoSymbol);
    if (cryptoSymbols.length > 0) {
      await this.harvestCryptoUniverse(cryptoSymbols, assetMap, shouldFetchDeepInstitutional);
    }

    logger.info({ duration: timer.endFormatted() }, "✅ Phase 1: Harvest Complete.");
  }

  static async runCryptoMarketSync() {
    await this.harvestUniverse(false);
  }

  /**
   * Phase 1-CG: Harvest Crypto via CoinGecko API
   * Replaces Yahoo Finance for all -USD crypto symbols.
   */
  private static async harvestCryptoUniverse(
    cryptoSymbols: string[],
    assetMap: Map<string, Asset>,
    deepSync: boolean,
  ) {
    const timer = createTimer();
    logger.info({ count: cryptoSymbols.length, deepSync }, "📡 Phase 1-CG: Harvesting crypto via CoinGecko...");

    // 1. Resolve CoinGecko IDs
    const idMap = new Map<string, string>(); // coingeckoId → symbol
    for (const sym of cryptoSymbols) {
      const cgId = symbolToCoingeckoId(sym);
      if (cgId) idMap.set(cgId, sym);
    }
    const cgIds = Array.from(idMap.keys());

    if (cgIds.length === 0) {
      logger.warn("No CoinGecko IDs resolved — skipping crypto harvest");
      return;
    }

    // 2. Batch quotes via /coins/markets (single API call for all coins)
    const markets = await CoinGeckoService.getMarkets(cgIds, "usd", {
      priceChangePercentage: "7d,14d,30d,60d,200d,1y",
    });

    if (markets.length === 0) {
      logger.error("CoinGecko markets fetch returned empty — crypto harvest aborted");
      return;
    }

    logger.info({ fetched: markets.length }, "CoinGecko batch quotes received");

    // 3. Build batched asset updates (single $transaction instead of 49 individual writes)
    const assetUpdates: { symbol: string; data: Prisma.AssetUpdateInput }[] = [];
    for (const market of markets) {
      const symbol = idMap.get(market.id);
      if (!symbol) continue;

      const asset = assetMap.get(symbol);
      if (!asset) continue;

      const existingMetadata = (asset.metadata as Record<string, unknown>) || {};

      const cgMarketMeta: Record<string, unknown> = {
        ...existingMetadata,
        circulatingSupply: market.circulating_supply,
        totalSupply: market.total_supply,
        maxSupply: market.max_supply,
        volume24Hr: market.total_volume,
        exchangeName: "CoinGecko",
        beta: 0,
        dividendYield: 0,
        dayHigh: market.high_24h,
        dayLow: market.low_24h,
        coingecko: {
          ...(existingMetadata.coingecko as Record<string, unknown> || {}),
          marketCapRank: market.market_cap_rank,
          fullyDilutedValuation: market.fully_diluted_valuation,
          circulatingSupply: market.circulating_supply,
          totalSupply: market.total_supply,
          maxSupply: market.max_supply,
          ath: market.ath,
          athDate: market.ath_date,
          athChangePercentage: market.ath_change_percentage,
          atl: market.atl,
          atlDate: market.atl_date,
          atlChangePercentage: market.atl_change_percentage,
          priceChange24h: market.price_change_24h,
          priceChangePercentage7d: market.price_change_percentage_7d_in_currency ?? 0,
          priceChangePercentage14d: market.price_change_percentage_14d_in_currency ?? 0,
          priceChangePercentage30d: market.price_change_percentage_30d_in_currency ?? 0,
          priceChangePercentage60d: market.price_change_percentage_60d_in_currency ?? 0,
          priceChangePercentage200d: market.price_change_percentage_200d_in_currency ?? 0,
          priceChangePercentage1y: market.price_change_percentage_1y_in_currency ?? 0,
          image: { large: market.image },
          lastMarketSync: new Date().toISOString(),
        },
      };

      // Preserve human-readable DB name — only update if still unset or equals raw symbol.
      const cgExisting = asset?.name || "";
      const cgNameStale = !cgExisting || cgExisting === symbol;
      const cgResolvedName = DISPLAY_NAME_OVERRIDES[symbol]
        || (!cgNameStale ? cgExisting : (market.name || symbol));

      assetUpdates.push({
        symbol,
        data: {
          name: cgResolvedName,
          price: market.current_price || 0,
          changePercent: market.price_change_percentage_24h || 0,
          lastPriceUpdate: new Date(),
          marketCap: market.market_cap ?? null,
          volume: market.total_volume || null,
          fiftyTwoWeekHigh: market.ath || null,
          fiftyTwoWeekLow: market.atl || null,
          oneYearChange: market.price_change_percentage_1y_in_currency ?? null,
          coingeckoId: market.id,
          metadata: cgMarketMeta as Prisma.JsonObject,
          updatedAt: new Date(),
        },
      });
    }

    // Batch write in chunks of 25 to avoid PgBouncer transaction timeout
    let updated = 0;
    const CHUNK_SIZE = 25;
    for (let i = 0; i < assetUpdates.length; i += CHUNK_SIZE) {
      const chunk = assetUpdates.slice(i, i + CHUNK_SIZE);
      try {
        await prisma.$transaction(
          chunk.map((u) => prisma.asset.update({ where: { symbol: u.symbol }, data: u.data })),
        );
        updated += chunk.length;
      } catch (err) {
        logger.warn({ err: sanitizeError(err), chunk: i / CHUNK_SIZE }, "Crypto batch update failed, falling back to individual");
        for (const u of chunk) {
          try {
            await prisma.asset.update({ where: { symbol: u.symbol }, data: u.data });
            updated++;
          } catch (e2) {
            logger.error({ err: sanitizeError(e2), symbol: u.symbol }, "Failed to update crypto asset");
          }
        }
      }
    }

    // 4. Delta-only history fetch — pre-fetch all last history dates in one query
    const cryptoAssetIds = markets
      .map((m) => { const s = idMap.get(m.id); return s ? assetMap.get(s)?.id : undefined; })
      .filter(Boolean) as string[];

    const lastHistories = await prisma.$queryRaw<{ assetId: string; maxDate: Date }[]>`
      SELECT "assetId", MAX(date) as "maxDate" FROM "PriceHistory" WHERE "assetId" = ANY(${cryptoAssetIds}::text[]) GROUP BY "assetId"
    `;
    const lastHistoryMap = new Map(lastHistories.map((h) => [h.assetId, h.maxDate]));

    let historySkipped = 0;
    for (const market of markets) {
      const symbol = idMap.get(market.id);
      if (!symbol) continue;
      const asset = assetMap.get(symbol);
      if (!asset) continue;

      try {
        const lastDate = lastHistoryMap.get(asset.id);
        // Delta: compute how many days we actually need
        let days = 365;
        if (lastDate) {
          const daysSinceLast = Math.ceil((Date.now() - new Date(lastDate).getTime()) / (24 * 60 * 60 * 1000));
          if (daysSinceLast < 1) {
            historySkipped++;
            continue; // Already up to date
          }
          // Fetch only what we need + 2 day buffer for overlap safety
          days = Math.min(365, daysSinceLast + 2);
        }

        const chart = await CoinGeckoService.getMarketChart(market.id, days);
        if (!chart || chart.prices.length === 0) continue;

        const ohlcv = CoinGeckoService.marketChartToOHLCV(chart);
        if (ohlcv.length === 0) continue;

        // Filter to only new data points (1-year retention policy)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const historyToInsert = lastDate
          ? ohlcv.filter((h) => new Date(h.date) > new Date(lastDate) && new Date(h.date) >= oneYearAgo)
          : ohlcv.filter((h) => new Date(h.date) >= oneYearAgo);

        if (historyToInsert.length > 0) {
          await prisma.priceHistory.createMany({
            data: historyToInsert.map((h) => ({
              assetId: asset.id,
              date: new Date(h.date),
              open: h.open,
              high: h.high,
              low: h.low,
              close: h.close,
              volume: h.volume,
            })),
            skipDuplicates: true,
          });
          logger.debug({ symbol, inserted: historyToInsert.length, days }, "CoinGecko history persisted (delta, 1yr retention)");
        }
      } catch (err) {
        logger.error({ err: sanitizeError(err), symbol }, "Failed to fetch CoinGecko history");
      }
    }
    if (historySkipped > 0) {
      logger.info({ skipped: historySkipped }, "Crypto history: skipped up-to-date coins");
    }

    // 5. Detail metadata sync — gap-fill + periodic refresh
    // Only fetch /coins/{id} for coins missing categories or stale (>7 days).
    // Pre-fetch all metadata in one query instead of N+1.
    const DETAIL_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cryptoSymbolList = markets.map((m) => idMap.get(m.id)).filter(Boolean) as string[];
    const freshAssets = await prisma.asset.findMany({
      where: { symbol: { in: cryptoSymbolList } },
      select: { symbol: true, metadata: true },
    });
    const freshMetaMap = new Map(freshAssets.map((a) => [a.symbol, a.metadata as Record<string, unknown> || {}]));

    const coinsNeedingDetail: typeof markets = [];
    for (const market of markets) {
      const symbol = idMap.get(market.id);
      if (!symbol) continue;

      const meta = freshMetaMap.get(symbol) || {};
      const cg = meta.coingecko as Record<string, unknown> | undefined;
      const hasCategories = cg?.categories && Array.isArray(cg.categories) && (cg.categories as string[]).length > 0;
      const lastSync = cg?.lastDetailSync ? new Date(cg.lastDetailSync as string).getTime() : 0;
      const isStale = Date.now() - lastSync > DETAIL_STALE_MS;

      if (!hasCategories || isStale) {
        coinsNeedingDetail.push(market);
      }
    }

    if (coinsNeedingDetail.length > 0) {
      logger.info({ count: coinsNeedingDetail.length, total: markets.length }, "🔬 Fetching CoinGecko coin details (gap-fill + stale refresh)...");
      for (const market of coinsNeedingDetail) {
        const symbol = idMap.get(market.id);
        if (!symbol) continue;

        try {
          const detail = await CoinGeckoService.getCoinDetail(market.id);
          if (!detail) continue;

          const cgMetadata = CoinGeckoService.transformDetailToMetadata(detail);
          const existingMeta = freshMetaMap.get(symbol) || {};

          // Derive top-level enrichment fields from detail data (zero extra API calls)
          const devData = detail.developer_data;
          const commData = detail.community_data;

          // technicalRating: composite of developer + community health → label
          let techScore = 50; // neutral default
          if (devData) {
            const issueCloseRate = devData.total_issues > 0 ? devData.closed_issues / devData.total_issues : 0.5;
            const commitActivity = Math.min(1, devData.commit_count_4_weeks / 200);
            const starScore = Math.min(1, devData.stars / 10000);
            const forkScore = Math.min(1, devData.forks / 2000);
            techScore = Math.round((issueCloseRate * 20 + commitActivity * 30 + starScore * 25 + forkScore * 25));
          }
          const techLabel = techScore >= 70 ? "STRONG_BUY" : techScore >= 55 ? "BUY" : techScore >= 45 ? "NEUTRAL" : techScore >= 30 ? "SELL" : "STRONG_SELL";

          // analystRating: derived from sentiment votes → label
          const upPct = detail.sentiment_votes_up_percentage ?? 50;
          const analystLabel = upPct >= 75 ? "STRONG_BUY" : upPct >= 60 ? "BUY" : upPct >= 40 ? "NEUTRAL" : upPct >= 25 ? "SELL" : "STRONG_SELL";

          // Institutional proxy: approximate from watchlist + reddit + telegram engagement
          const watchlist = detail.watchlist_portfolio_users ?? 0;
          const redditSubs = commData?.reddit_subscribers ?? 0;
          const telegramUsers = commData?.telegram_channel_user_count ?? 0;
          const socialReach = watchlist + redditSubs + (telegramUsers ?? 0);
          const instProxy = Math.min(1, socialReach / 500000); // normalize to 0-1

          // TVL data from market_data (available but not persisted anywhere yet)
          const tvl = detail.market_data?.total_value_locked ?? null;
          const mcapToTvl = detail.market_data?.mcap_to_tvl_ratio ?? null;

          await prisma.asset.update({
            where: { symbol },
            data: {
              description: cgMetadata.description?.slice(0, 5000) || null,
              technicalRating: techLabel,
              analystRating: analystLabel,
              metadata: {
                ...existingMeta,
                coingecko: toJsonObject(cgMetadata),
                institutionalProxy: instProxy,
                ...(tvl !== null ? { tvl, mcapToTvlRatio: mcapToTvl } : {}),
              } as Prisma.JsonObject,
            },
          });
        } catch (err) {
          logger.error({ err: sanitizeError(err), symbol }, "Failed to fetch CoinGecko detail");
        }
      }
    } else {
      logger.info("All crypto coins have fresh detail metadata — skipping detail fetch");
    }

    // Invalidate cache for updated crypto assets
    await Promise.all(
      cryptoSymbols.map((s) => AssetService.invalidateAsset(s).catch((err) => {
        logger.debug({ err, symbol: s }, "Failed to invalidate asset cache (non-critical)");
      })),
    );

    logger.info({
      updated,
      total: cryptoSymbols.length,
      duration: timer.endFormatted(),
    }, "✅ Phase 1-CG: CoinGecko Crypto Harvest Complete.");
  }

  private static async resolveUniverse(region?: string): Promise<string[]> {
    const where: Prisma.AssetWhereInput = {
      ...(region ? { region } : {}),
    };

    const assets = await prisma.asset.findMany({ where, select: { symbol: true } });
    const dbSymbols = assets.map(a => a.symbol);

    if (region && region !== "US") {
      const finalUniverse = [...new Set(dbSymbols)];
      logger.info({ region, count: finalUniverse.length }, "Resolved universe");
      return finalUniverse;
    }
    const finalUniverseSet = new Set(dbSymbols);
    for (const s of DEFAULT_SYMBOLS_SET) finalUniverseSet.add(s);
    const finalUniverse = Array.from(finalUniverseSet);

    logger.info({ region, count: finalUniverse.length }, "Resolved universe");
    return finalUniverse;
  }

  /**
   * Phase 2: Compute Analytics
   * Runs all engines based on data already in DB.
   */
  static async computeFullAnalytics(force = false, region?: string) {
    const timer = createTimer();
    logger.info({ region, force }, "⚙️ Phase 2: Computing platform analytics & correlations...");

    // For analytics, include ALL assets
    const symbols = await this.resolveUniverse(region);
    
    // 1. Pre-fetch benchmark histories for correlation
    const benchmarks = ["BTC-USD", "ETH-USD", "SOL-USD"];
    const benchmarkHistories: Record<string, OHLCV[]> = {};
    const benchmarkResults = await Promise.all(
      benchmarks.map((b) => fetchAssetData(b, "1y")),
    );
    benchmarkResults.forEach((h: OHLCV[] | import("../market-data").MarketDataError, i: number) => {
      if (!("error" in h) && Array.isArray(h) && h.length > 0) benchmarkHistories[benchmarks[i]] = h;
    });
    const benchmarkHistoriesForCorrelation = benchmarkHistories;
    logger.info({ count: Object.keys(benchmarkHistoriesForCorrelation).length }, "Benchmark histories loaded");

    // 2. We need the market context FIRST to calculate compatibility
    // So we'll run a mini-pass to get signals for the context
    logger.info("Pass 1: Pre-computing signals for global context...");
    const assetSignals: AssetComputeSignals[] = [];
    const allScores: Prisma.AssetScoreCreateManyInput[] = [];

    const CONCURRENCY_LIMIT = SYNC_CONFIG.CONCURRENCY_LIMIT || 10;
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += CONCURRENCY_LIMIT) {
      chunks.push(symbols.slice(i, i + CONCURRENCY_LIMIT));
    }

    // Pre-fetch ALL assets with history in a single query (eliminates N+1)
    const allAssetsWithHistory = await prisma.asset.findMany({
      where: { symbol: { in: symbols } },
      include: {
        priceHistory: { orderBy: { date: 'desc' }, take: 365 },
        scores: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
      },
    });
    const assetBySymbol = new Map(allAssetsWithHistory.map(a => [a.symbol, a]));

    // Pre-fetch ALL recent events in a single query (eliminates N+1 in compute loop)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allRecentEvents = await prisma.institutionalEvent.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
    });
    const eventsByAssetId = new Map<string, typeof allRecentEvents>();
    for (const evt of allRecentEvents) {
      const list = eventsByAssetId.get(evt.assetId) || [];
      list.push(evt);
      eventsByAssetId.set(evt.assetId, list);
    }

    for (const chunk of chunks) {
      const chunkSignals = await Promise.all(
        chunk.map(async (symbol) => {
          try {
            const asset = assetBySymbol.get(symbol) ?? null;

            if (!asset || asset.priceHistory.length === 0) return null;

            // Computation Skip Logic: 
            // If the latest price update is older than the last compute cycle, skip.
            const lastScoreDate = asset.scores[0]?.date;
            if (!force && lastScoreDate && asset.lastPriceUpdate && asset.lastPriceUpdate <= lastScoreDate) {
              logger.debug({ symbol }, "Asset price has not updated since last computation, skipping engines.");
              return null;
            }


            const history: OHLCV[] = asset.priceHistory.map(h => ({
              date: h.date.toISOString(),
              open: h.open,
              high: h.high,
              low: h.low,
              close: h.close,
              volume: h.volume
            })).reverse();

            // Clean history globally to remove high-frequency noise/duplicates
            const cleanData = cleanHistory(history);
            const historyConfidence = getHistoryConfidence(cleanData.length);

            const quote: MarketQuote = {
              symbol,
              regularMarketPrice: asset.price || 0,
              regularMarketChangePercent: asset.changePercent || 0,
              marketCap: asset.marketCap ?? undefined,
              fiftyTwoWeekChangePercent: asset.oneYearChange || undefined,
              regularMarketVolume: asset.volume || undefined,
            };

            const signals: EngineSignals = {
              trend: calculateTrendScore(cleanData),
              momentum: calculateMomentumScore(cleanData),
              volatility: calculateVolatilityScore(cleanData, asset.type),
              liquidity: calculateLiquidityScore(quote, {
                history: cleanData,
                avgVolume3M: asset.avgVolume || undefined,
                marketCap: asset.marketCap ?? undefined,
              }),
              sentiment: calculateSentimentScore(cleanData),
              trust: calculateTrustScore(asset, quote),
            };

            return { symbol, signals, history: cleanData, asset, historyConfidence };
          } catch (err) {
            logger.error({ err: sanitizeError(err), symbol }, "Error pre-computing signals");
            return null;
          }
        })
      );
      assetSignals.push(...chunkSignals.filter((s): s is AssetComputeSignals => s !== null));
    }

    // 3. Calculate Global Market Context
    logger.info("Calculating global market context");

    const regimeDate = new Date();
    regimeDate.setUTCHours(0, 0, 0, 0);
    const contextRegion = region || "US";
    const CACHE_KEY_REGIME = `market_regime:${contextRegion}:${regimeDate.toISOString().split('T')[0]}`;
    
    interface CachedRegime {
      context: ReturnType<typeof calculateMarketContext>;
      correlationMetrics: Prisma.InputJsonValue;
    }

    // Try Cache First
    const cachedRegime = await getCache<CachedRegime>(CACHE_KEY_REGIME);
    
    let context: ReturnType<typeof calculateMarketContext>;
    let correlationMetrics: CorrelationMetrics;

    if (cachedRegime && !force) {
        logger.info("Using Cached Market Regime");
        context = cachedRegime.context;
        correlationMetrics = cachedRegime.correlationMetrics as unknown as CorrelationMetrics;
    } else {
        const contextInput = assetSignals
          .filter((a) => a.historyConfidence.regimeWeight > 0)
          .map((a) => ({
            trend: a.signals.trend.score,
            momentum: a.signals.momentum.score,
            volatility: a.signals.volatility.score,
            liquidity: a.signals.liquidity.score,
            sentiment: a.signals.sentiment.score,
            weight: a.historyConfidence.regimeWeight,
          }));
        context = calculateMarketContext(contextInput);

        // Calculate correlation regime and store with market regime
        logger.info("Calculating correlation regime...");
        correlationMetrics = await calculateCorrelationRegime();

      // Cache the full object for use in this cycle
      await setCache(CACHE_KEY_REGIME, { context, correlationMetrics }, 86400);
      logger.info("Market Regime Calculated & Cached");
    }

    const latestMarketRegime = await prisma.marketRegime.findFirst({
      where: { region: contextRegion },
      orderBy: { date: "desc" },
      select: {
        state: true,
        breadthScore: true,
        vixValue: true,
        context: true,
        correlationMetrics: true,
      },
    });

    const nextMarketRegimeSignature = JSON.stringify({
      state: context.regime.label,
      breadthScore: context.breadth.score,
      vixValue: context.volatility.score,
      context: JSON.stringify(context),
      correlationMetrics,
    });
    const previousMarketRegimeSignature = latestMarketRegime
      ? JSON.stringify({
          state: latestMarketRegime.state,
          breadthScore: latestMarketRegime.breadthScore,
          vixValue: latestMarketRegime.vixValue,
          context: latestMarketRegime.context,
          correlationMetrics: latestMarketRegime.correlationMetrics,
        })
      : null;
    const hasRegimeShift = previousMarketRegimeSignature !== nextMarketRegimeSignature;

    // Always ensure DB is in sync with the current regime (even if cached)
    await prisma.marketRegime.upsert({
      where: {
        date_region: {
          date: regimeDate,
          region: contextRegion,
        },
      },
      create: {
        date: regimeDate,
        region: contextRegion,
        state: context.regime.label,
        breadthScore: context.breadth.score,
        vixValue: context.volatility.score,
        context: JSON.stringify(context),
        correlationMetrics: asPrismaJsonValue(correlationMetrics),
      },
      update: {
        state: context.regime.label,
        breadthScore: context.breadth.score,
        vixValue: context.volatility.score,
        context: JSON.stringify(context),
        correlationMetrics: asPrismaJsonValue(correlationMetrics),
      },
    });

    void MacroResearchService.invalidateSnapshot(contextRegion).catch((err) => {
      logger.warn({ err: sanitizeError(err), region: contextRegion }, "Macro research cache invalidation failed");
    });

    if (hasRegimeShift) {
      void MacroResearchService.invalidate(contextRegion).catch((err: unknown) => {
        logger.warn({ err: sanitizeError(err), region: contextRegion }, "Macro research cache invalidation failed");
      });
    }

    // 4. Final Pass: Compute Factors, Compatibility, and Persistence
    logger.info("Pass 2: Finalizing analytics and batching updates...");
    let fundamentalFieldsEvaluated = 0;
    let fundamentalFallbacks = 0;
    let fundamentalUnavailable = 0;
    const cryptoProviderStats: Record<string, { evaluated: number; unavailable: number }> = {};

    // Hoist dynamic imports once before the hot loop — avoids repeated module resolution overhead
    const [
      { CryptoIntelligenceEngine },
      { calculateScenarios, computeRiskMetrics },
    ] = await Promise.all([
      import("../engines/crypto-intelligence"),
      import("../engines/scenario-engine"),
    ]);
    
    for (let i = 0; i < assetSignals.length; i += CONCURRENCY_LIMIT) {
      const batch = assetSignals.slice(i, i + CONCURRENCY_LIMIT);
      
      const updateData = await Promise.all(batch.map(async (item) => {
        const { signals, history, asset, symbol, historyConfidence } = item;
        const assetMeta = (asset.metadata || {}) as Record<string, unknown>;

        if (!historyConfidence.shouldWriteScores) {
          return {
            symbol,
            data: {
              avgTrendScore: null,
              avgMomentumScore: null,
              avgVolatilityScore: null,
              avgLiquidityScore: null,
              avgSentimentScore: null,
              avgTrustScore: null,
              compatibilityScore: null,
              compatibilityLabel: "CALIBRATING",
              assetGroup: "Calibrating",
              metadata: toJsonObject({
                ...assetMeta,
                reliabilityMeta: {
                  ...((assetMeta.reliabilityMeta as Record<string, unknown>) || {}),
                  updatedAt: new Date().toISOString(),
                  history: historyConfidence,
                  scorePersistence: "blocked_<60",
                },
                preliminaryScores: {
                  trend: signals.trend.score,
                  momentum: signals.momentum.score,
                  volatility: signals.volatility.score,
                  liquidity: signals.liquidity.score,
                  sentiment: signals.sentiment.score,
                  trust: signals.trust.score,
                  confidence: historyConfidence.tier,
                  bars: historyConfidence.bars,
                  updatedAt: new Date().toISOString(),
                },
              }),
              updatedAt: new Date(),
            },
            reliabilityStats: { evaluated: 0, fallbacks: 0, unavailable: 0 },
            cryptoReliabilityStats: null,
            events: async () => {},
          };
        }

        // Factors & Correlations
        const factorProfile = calculateFactorProfile(symbol, history, {
          peRatio: (assetMeta.forwardPe as number) ?? null,
          industryPe: (assetMeta.industryPe as number) ?? null,
          roe: (assetMeta.roe as number) ?? null,
          oneYearChange: asset.oneYearChange,
        });
        const correlations = calculateCorrelations(history, benchmarkHistoriesForCorrelation);

        // Compatibility & Grouping
        const flatSignals = {
          trend: signals.trend.score,
          momentum: signals.momentum.score,
          volatility: signals.volatility.score,
          liquidity: signals.liquidity.score,
          sentiment: signals.sentiment.score,
          trust: signals.trust.score,
        };
        const compatibility = calculateCompatibility(flatSignals, context);
        const grouping = classifyAsset(flatSignals, compatibility, asset.type.toLowerCase());

        // Pre-compute Performance from price history
        const performance = calculatePerformance(history);

        // Pre-compute asset-specific Correlation Regime
        let assetCorrelationRegime: Prisma.InputJsonValue | null = null;
        const corrValues = Object.entries(correlations)
          .filter(([key, val]) => key !== symbol && typeof val === 'number')
          .map(([, val]) => Math.abs(val));
        if (corrValues.length > 0) {
          const avgCorr = corrValues.reduce((s, c) => s + c, 0) / corrValues.length;
          const mean = avgCorr;
          const variance = corrValues.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / corrValues.length;
          const dispersion = Math.sqrt(variance);
          let regime: string = "NORMAL";
          let implications = "Normal correlation with market benchmarks.";
          if (avgCorr > 0.7) { regime = "MACRO_DRIVEN"; implications = "High correlation to benchmarks. Moves closely with market trends."; }
          else if (avgCorr < 0.3) { regime = "IDIOSYNCRATIC"; implications = "Low correlation to benchmarks. Moves independently of market."; }
          assetCorrelationRegime = asPrismaJsonValue({
            avgCorrelation: Math.round(avgCorr * 100) / 100,
            dispersion: Math.round(dispersion * 100) / 100,
            trend: "STABLE",
            regime,
            confidence: corrValues.length >= 3 ? "high" : "medium",
            implications,
          }) as Prisma.InputJsonValue | null;
        }

        // Pre-compute Factor Alignment (spider chart)
        const hasStandardFactors = factorProfile && "value" in factorProfile;
        const factorAlignment = hasStandardFactors
          ? calculateFactorRegimeAlignment(factorProfile as FactorProfile, context.regime.label)
          : null;

        // Pre-compute Event-Adjusted Scores (using pre-fetched events map)
        const scoreTypes: ScoreType[] = ["TREND", "MOMENTUM", "VOLATILITY", "SENTIMENT", "LIQUIDITY", "TRUST"];
        const eventAdjustedScores: Record<string, unknown> = {};
        const events = eventsByAssetId.get(asset.id) || [];
        const impacts = await Promise.all(
          scoreTypes.map(async (st) => {
            const baseScore = flatSignals[st.toLowerCase() as keyof typeof flatSignals] || 0;
            const impact = await calculateEventAdjustedScore(asset.id, baseScore, st, events);
            return { key: st.toLowerCase(), impact };
          }),
        );
        impacts.forEach(({ key, impact }) => {
          eventAdjustedScores[key] = impact;
        });

        // Pre-compute Signal Strength (composite of all layers)
        const fundamentals: FundamentalData = {
          distanceFrom52WHigh: performance.range52W.distanceFromHigh,
        };

        const signalStrength = calculateSignalStrength({
          signals: flatSignals,
          compatibility,
          marketContext: context,
          assetType: asset.type,
          scoreDynamics: (asset.scoreDynamics as unknown as Record<string, import("@/types/analytics").ScoreDynamics>) || null,
          eventAdjustedScores: eventAdjustedScores as Record<string, import("@/types/analytics").EventImpact> | null,
          factorAlignment: factorAlignment as { score: number; regimeFit: string; dominantFactor?: string } | null,
          fundamentals,
          groupClassification: grouping.group,
        });

        // Pre-compute Scenario Analysis (Wave 2 - Phase 3)
        let scenarioData: Prisma.InputJsonValue | null = null;
        if (hasStandardFactors && factorProfile) {
          try {
            const avgCorr = assetCorrelationRegime 
              ? ((assetCorrelationRegime as Record<string, unknown>).avgCorrelation as number)
              : 0.5;

            const closes = history.map((bar: OHLCV) => bar.close);
            const returns1d = dailyReturns(closes);
            const historicalReturns = { returns1d };

            const scenarios = calculateScenarios(
              flatSignals,
              factorProfile,
              context,
              avgCorr,
              historicalReturns,
              { horizon: "1D", confidence: 0.95 },
            );

            const meanReturn = scenarios.bearCase.expectedReturn / 100;
            const riskVariants = {
              "1D_95": computeRiskMetrics({
                meanReturn,
                volatilityScore: flatSignals.volatility,
                stressRegime: scenarios.bearCase.regime as import("../engines/scenario-engine").RegimeLabel,
                historicalReturns,
                horizon: "1D",
                confidence: 0.95,
              }),
              "1D_99": computeRiskMetrics({
                meanReturn,
                volatilityScore: flatSignals.volatility,
                stressRegime: scenarios.bearCase.regime as import("../engines/scenario-engine").RegimeLabel,
                historicalReturns,
                horizon: "1D",
                confidence: 0.99,
              }),
              "1W_95": computeRiskMetrics({
                meanReturn,
                volatilityScore: flatSignals.volatility,
                stressRegime: scenarios.bearCase.regime as import("../engines/scenario-engine").RegimeLabel,
                historicalReturns,
                horizon: "1W",
                confidence: 0.95,
              }),
              "1W_99": computeRiskMetrics({
                meanReturn,
                volatilityScore: flatSignals.volatility,
                stressRegime: scenarios.bearCase.regime as import("../engines/scenario-engine").RegimeLabel,
                historicalReturns,
                horizon: "1W",
                confidence: 0.99,
              }),
            };

            scenarioData = asPrismaJsonValue({ ...scenarios, riskVariants }) as Prisma.InputJsonValue | null;
          } catch (err) {
            logger.warn({ symbol, err: String(err) }, "Scenario computation failed");
          }
        }

        // Prepare Scores (deterministic persistence)
        const normalizeScore = (score: number | undefined | null): number => {
          if (score === undefined || score === null || isNaN(score)) return 0;
          return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
        };

        const createScore = (type: ScoreType, result: EngineResult): Prisma.AssetScoreCreateManyInput => ({
          assetId: asset.id,
          type,
          value: normalizeScore(result.score),
          date: new Date(),
          context: result.context,
          direction: result.direction,
          description: JSON.stringify(result.metadata || {}),
        });

        allScores.push(
          createScore(ScoreType.TREND, signals.trend),
          createScore(ScoreType.MOMENTUM, signals.momentum),
          createScore(ScoreType.VOLATILITY, signals.volatility),
          createScore(ScoreType.LIQUIDITY, signals.liquidity),
          createScore(ScoreType.SENTIMENT, signals.sentiment),
          createScore(ScoreType.TRUST, signals.trust),
        );

        // Crypto Intelligence: network activity, holder stability, liquidity risk, structural risk, enhanced trust
        let cryptoIntelData: Prisma.InputJsonValue | null = null;
        let cryptoReliability: Record<string, SourcedField<number>> | null = null;
        if (asset.type === "CRYPTO" && asset.coingeckoId) {
          try {
            const result = await CryptoIntelligenceEngine.compute(prisma, asset.id, symbol, asset.coingeckoId, {
              metadata: asset.metadata as Record<string, unknown> | null,
              marketCap: asset.marketCap,
              volume: asset.volume,
              avgTrustScore: asset.avgTrustScore,
              price: asset.price,
              changePercent: asset.changePercent,
            });
            if (result) {
              cryptoIntelData = asPrismaJsonValue(result) as Prisma.InputJsonValue | null;

              const cgMeta = (assetMeta.coingecko as Record<string, unknown>) || {};
              const quoteFreshnessHours = hoursSince((cgMeta.lastMarketSync as string | undefined) || asset.lastPriceUpdate);
              const computedFreshnessHours = hoursSince(result.computedAt);
              const poolSummary = result.liquidityRisk?.poolSummary;

              cryptoReliability = {
                quotePrice: resolveSingleSourceField<number>({
                  expectedSource: "coingecko",
                  source: "coingecko",
                  value: asNumber(asset.price),
                  freshnessHours: quoteFreshnessHours,
                  slaHours: CRYPTO_QUOTES_SLA_HOURS,
                }),
                marketCap: resolveSingleSourceField<number>({
                  expectedSource: "coingecko",
                  source: "coingecko",
                  value: asNumber(asset.marketCap),
                  freshnessHours: quoteFreshnessHours,
                  slaHours: CRYPTO_QUOTES_SLA_HOURS,
                }),
                cexVolume: resolveSingleSourceField<number>({
                  expectedSource: "coingecko",
                  source: "coingecko",
                  value: asNumber(asset.volume),
                  freshnessHours: quoteFreshnessHours,
                  slaHours: LIQUIDITY_SLA_HOURS,
                }),
                dexLiquidity: resolveSingleSourceField<number>({
                  expectedSource: "geckoterminal",
                  source: "geckoterminal",
                  value: asNumber(poolSummary?.totalReserveUsd),
                  freshnessHours: computedFreshnessHours,
                  slaHours: CRYPTO_DEX_SLA_HOURS,
                }),
                tvl: resolveSingleSourceField<number>({
                  expectedSource: "defillama",
                  source: "defillama",
                  value: asNumber(result.tvlData?.tvl),
                  freshnessHours: computedFreshnessHours,
                  slaHours: LIQUIDITY_SLA_HOURS,
                }),
              };
            }
          } catch (err) {
            logger.warn({ symbol, err: String(err) }, "Crypto intelligence computation failed");
          }
        }

        // CoinGlass derivatives enrichment — DEFERRED until API key is purchased (no free tier)
        // To activate: set COINGLASS_API_KEY in .env and uncomment the block below
        // let coinglassOi: number | null = null;
        // if (asset.type === "CRYPTO") {
        //   try {
        //     const { CoinGlassService } = await import("./coinglass.service");
        //     const derivatives = await CoinGlassService.getDerivativesSummary(symbol);
        //     if (derivatives.openInterest || derivatives.fundingRate || derivatives.liquidation) {
        //       assetMeta.coinglass = { ... } as Record<string, unknown>;
        //       coinglassOi = derivatives.openInterest?.openInterest ?? null;
        //     }
        //   } catch (err) {
        //     logger.debug({ symbol, err: String(err) }, "CoinGlass enrichment skipped");
        //   }
        // }

        // Messari financials enrichment (protocol revenue, P/S, tokenomics)
        let messariFinancials: Record<string, unknown> | null = null;
        if (asset.type === "CRYPTO" && asset.coingeckoId) {
          try {
            const { MessariService } = await import("./messari.service");
            const slug = MessariService.symbolToSlug(symbol);
            const [metrics, profile] = await Promise.all([
              MessariService.getAssetMetrics(slug).catch(() => null),
              MessariService.getAssetProfile(slug).catch(() => null),
            ]);

            if (metrics || profile) {
              assetMeta.messari = {
                ...(metrics ? {
                  revenue: metrics.revenue,
                  revenueChangeYtd: metrics.revenueChangeYtd,
                  psRatio: metrics.psRatio,
                  peRatio: metrics.peRatio,
                  yield: metrics.yield,
                  inflationRate: metrics.inflationRate,
                  unlockSchedule: metrics.unlockSchedule,
                } : {}),
                ...(profile ? {
                  sector: profile.sector,
                  category: profile.category,
                  governanceType: profile.governanceType,
                  tokenUseCases: profile.tokenUseCases,
                  consensusMechanism: profile.consensusMechanism,
                } : {}),
                lastUpdated: new Date().toISOString(),
              } as Record<string, unknown>;

              if (metrics?.revenue != null || metrics?.psRatio != null) {
                messariFinancials = {
                  revenue: metrics.revenue,
                  revenueChangeYtd: metrics.revenueChangeYtd,
                  psRatio: metrics.psRatio,
                  peRatio: metrics.peRatio,
                  yield: metrics.yield,
                  inflationRate: metrics.inflationRate,
                };
              }
            }
          } catch (err) {
            logger.debug({ symbol, err: String(err) }, "Messari enrichment skipped");
          }
        }

        const cryptoReliabilityStats: Record<string, { evaluated: number; unavailable: number }> | null = cryptoReliability
          ? Object.values(cryptoReliability).reduce<Record<string, { evaluated: number; unavailable: number }>>((acc, field) => {
              const provider = field.expectedSource;
              if (!acc[provider]) acc[provider] = { evaluated: 0, unavailable: 0 };
              acc[provider].evaluated += 1;
              if (field.qualityTier === "unavailable") acc[provider].unavailable += 1;
              return acc;
            }, {})
          : null;

        return {
          symbol,
          data: {
            factorData: asPrismaJsonValue(factorProfile),
            correlationData: asPrismaJsonValue(correlations),
            updatedAt: new Date(),
            avgTrendScore: signals.trend.score,
            avgMomentumScore: signals.momentum.score,
            avgVolatilityScore: signals.volatility.score,
            avgLiquidityScore: signals.liquidity.score,
            avgSentimentScore: signals.sentiment.score,
            avgTrustScore: signals.trust.score,
            compatibilityScore: compatibility.score,
            compatibilityLabel: compatibility.label,
            assetGroup: grouping.group,
            performanceData: asPrismaJsonValue(performance),
            correlationRegime: assetCorrelationRegime ?? Prisma.JsonNull,
            factorAlignment: factorAlignment ? asPrismaJsonValue(factorAlignment) : Prisma.JsonNull,
            eventAdjustedScores: asPrismaJsonValue(eventAdjustedScores),
            signalStrength: asPrismaJsonValue(signalStrength),
            metadata: toJsonObject({
              ...assetMeta,
              reliabilityMeta: {
                ...((assetMeta.reliabilityMeta as Record<string, unknown>) || {}),
                updatedAt: new Date().toISOString(),
                history: historyConfidence,
                fundamentals: {},
                fallbackCount: 0,
                unavailableCount: 0,
                ...(cryptoReliability
                  ? {
                      crypto: {
                        fields: cryptoReliability,
                        unavailableCount: Object.values(cryptoReliability).filter((f) => f.qualityTier === "unavailable").length,
                      },
                    }
                  : {}),
              },
              preliminaryScores: null,
            }),
            ...(cryptoIntelData ? { cryptoIntelligence: cryptoIntelData } : {}),
            ...(scenarioData ? { scenarioData } : {}),
            // CoinGlass: add ...(coinglassOi != null ? { openInterest: coinglassOi } : {}) when activated
            ...(messariFinancials ? { financials: asPrismaJsonValue(messariFinancials) } : {}),
          },
          reliabilityStats: { evaluated: 0, fallbacks: 0, unavailable: 0 },
          cryptoReliabilityStats,
          // Institutional events are still triggered during compute
          events: () => IntelligenceEventsService.generateInstitutionalEvents(asset.id, symbol, signals, factorProfile, correlations)
        };
      }));

      for (const item of updateData) {
        if (!item.reliabilityStats) continue;
        fundamentalFieldsEvaluated += item.reliabilityStats.evaluated;
        fundamentalFallbacks += item.reliabilityStats.fallbacks;
        fundamentalUnavailable += item.reliabilityStats.unavailable;

        if (item.cryptoReliabilityStats) {
          for (const [provider, stats] of Object.entries(item.cryptoReliabilityStats as Record<string, { evaluated: number; unavailable: number }>)) {
            if (!cryptoProviderStats[provider]) {
              cryptoProviderStats[provider] = { evaluated: 0, unavailable: 0 };
            }
            cryptoProviderStats[provider].evaluated += stats.evaluated;
            cryptoProviderStats[provider].unavailable += stats.unavailable;
          }
        }
      }

      // Execute Transaction Batch
      await prisma.$transaction(
        updateData.map(u => prisma.asset.update({
          where: { symbol: u.symbol },
          data: u.data
        }))
      );

      // Trigger events
      await Promise.all(updateData.map(u => u.events()));
    }

    if (fundamentalFieldsEvaluated > 0) {
      const fallbackRate = fundamentalFallbacks / fundamentalFieldsEvaluated;
      logger.info({
        evaluated: fundamentalFieldsEvaluated,
        unavailableCount: fundamentalUnavailable,
        fallbackRate,
      }, "Phase 1 fundamentals reliability summary");
    }

    for (const [provider, stats] of Object.entries(cryptoProviderStats)) {
      if (stats.evaluated === 0) continue;
      const unavailableRate = stats.unavailable / stats.evaluated;
      logger.info({ provider, evaluated: stats.evaluated, unavailable: stats.unavailable, unavailableRate }, "Phase 2 crypto reliability summary");
      if (unavailableRate > 0.2) {
        logger.warn({ provider, unavailableRate }, `Provider degradation detected: ${provider} unavailable rate exceeded 20%`);
      }
    }

    // 5. Batch Store Scores
    if (allScores.length > 0) {
      // Filter out invalid scores to prevent Prisma "Argument value is missing" errors
      const validScores = allScores.filter(s => s.value !== undefined && s.value !== null && !isNaN(s.value));
      logger.info({ 
        total: allScores.length, 
        valid: validScores.length,
        filtered: allScores.length - validScores.length 
      }, "Batching score snapshots");
      
      if (validScores.length > 0) {
        // Delete today's scores for affected assets then bulk-insert fresh ones.
        // No unique index exists on AssetScore so ON CONFLICT is not available.
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const affectedAssetIds = [...new Set(validScores.map(s => s.assetId))];
        const affectedTypes = [...new Set(validScores.map(s => s.type))] as import("@/generated/prisma/client").ScoreType[];
        await prisma.assetScore.deleteMany({
          where: {
            assetId: { in: affectedAssetIds },
            type: { in: affectedTypes },
            date: { gte: today, lt: tomorrow },
          },
        });
        const BATCH = 200;
        let inserted = 0;
        for (let i = 0; i < validScores.length; i += BATCH) {
          const batch = validScores.slice(i, i + BATCH);
          await prisma.assetScore.createMany({
            data: batch.map(s => ({
              assetId: s.assetId,
              type: s.type as import("@/generated/prisma/client").ScoreType,
              value: s.value,
              context: s.context ?? null,
              description: s.description ?? null,
              direction: s.direction ?? null,
              date: today,
            })),
          });
          inserted += batch.length;
        }
        logger.info({ inserted }, "Score snapshots inserted (delete-then-insert, no duplicates)");
      }

      // 5a. Calculate and persist score dynamics — bulk-optimized path
      logger.info("Calculating score dynamics for all assets...");
      const { buildBulkDynamicsContext, calculateAllScoreDynamicsBulk } = await import("../engines/score-dynamics");
      const uniqueAssetIds = [...new Set(allScores.map(s => s.assetId))];

      // Build shared context ONCE (global distributions + all sector mappings in 4 queries total)
      const bulkContext = await buildBulkDynamicsContext(uniqueAssetIds);

      // Process all assets in parallel batches — each asset only fetches its own historical scores
      const DYNAMICS_BATCH_SIZE = 50;
      const allDynamicsUpdates: { id: string; dynamics: Record<string, unknown> }[] = [];
      for (let i = 0; i < uniqueAssetIds.length; i += DYNAMICS_BATCH_SIZE) {
        const batch = uniqueAssetIds.slice(i, i + DYNAMICS_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(assetId => calculateAllScoreDynamicsBulk(assetId, bulkContext))
        );
        for (const updates of batchResults) {
          for (const u of updates) allDynamicsUpdates.push({ id: u.id, dynamics: u.dynamics as unknown as Record<string, unknown> });
        }
      }

      // Write all AssetScore dynamics using Prisma update calls
      if (allDynamicsUpdates.length > 0) {
        const WRITE_BATCH = 50;
        for (let i = 0; i < allDynamicsUpdates.length; i += WRITE_BATCH) {
          const chunk = allDynamicsUpdates.slice(i, i + WRITE_BATCH);
          await Promise.all(
            chunk.map(u =>
              prisma.assetScore.update({
                where: { id: u.id },
                data: { dynamics: u.dynamics as Prisma.InputJsonValue },
              })
            )
          );
        }
      }

      // Batch-fetch all latest scores with dynamics and group by assetId for Asset.scoreDynamics update
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const allLatestScores = await prisma.assetScore.findMany({
        where: { assetId: { in: uniqueAssetIds }, date: { gte: twentyFourHoursAgo } },
        orderBy: { date: 'desc' },
        distinct: ['assetId', 'type'],
        select: { assetId: true, type: true, dynamics: true },
      });

      const dynamicsByAsset = new Map<string, Record<string, Prisma.JsonValue>>();
      for (const score of allLatestScores) {
        if (!score.dynamics) continue;
        let map = dynamicsByAsset.get(score.assetId);
        if (!map) { map = {}; dynamicsByAsset.set(score.assetId, map); }
        map[score.type] = score.dynamics;
      }

      // Write Asset.scoreDynamics using safe parameterized queries
      const dynamicsEntries = Array.from(dynamicsByAsset.entries())
        .filter(([, d]) => Object.keys(d).length > 0);
      if (dynamicsEntries.length > 0) {
        const WRITE_BATCH = 50;
        for (let i = 0; i < dynamicsEntries.length; i += WRITE_BATCH) {
          const chunk = dynamicsEntries.slice(i, i + WRITE_BATCH);
          await Promise.all(
            chunk.map(([id, sd]) =>
              prisma.asset.update({
                where: { id },
                data: { scoreDynamics: sd as Prisma.InputJsonValue },
              })
            )
          );
        }
      }
      logger.info({ assetCount: uniqueAssetIds.length, dynamicsWritten: allDynamicsUpdates.length }, "Score dynamics calculated and stored");
    }

    // 6. Update Sector Regimes
    logger.info("Updating Sector Regimes...");
    const { storeAllSectorRegimes, calculateCrossSectorCorrelation } = await import("../engines/sector-regime");
    await storeAllSectorRegimes();

    // 6b. Cross-Sector Correlation Regime
    logger.info("Calculating Cross-Sector Correlation Regime...");
    const crossSectorCorr = await calculateCrossSectorCorrelation();
    // Merge into latest MarketRegime correlationMetrics
    const latestRegimeForCorr = await prisma.marketRegime.findFirst({
      where: { region: contextRegion },
      orderBy: { date: "desc" },
    });
    if (latestRegimeForCorr) {
      const existingMetrics = (latestRegimeForCorr.correlationMetrics as Record<string, unknown>) || {};
      await prisma.marketRegime.update({
        where: { id: latestRegimeForCorr.id },
        data: {
          correlationMetrics: toJsonObject({ ...existingMetrics, crossSector: crossSectorCorr }),
        },
      });
    }
    logger.info({ regime: crossSectorCorr.regime, avgCorr: crossSectorCorr.avgCorrelation, trend: crossSectorCorr.trend }, "Cross-sector correlation regime stored");

    // 7. Update Multi-Horizon Regime
    logger.info(`Updating Multi-Horizon Regime for ${contextRegion}...`);
    await storeMultiHorizonRegime(contextRegion);

    // 8. Compute Discovery Feed (DRS engine)
    logger.info("Computing Discovery Feed...");
    try {
      const { computeDiscoveryFeed } = await import("./discovery-intelligence.service");
      const feedResult = await computeDiscoveryFeed();
      logger.info(feedResult, "Discovery feed computed");
    } catch (err) {
      logger.warn({ err: String(err) }, "Discovery feed computation failed (non-blocking)");
    }
    
    logger.info({ duration: timer.endFormatted(), region: contextRegion }, "✅ Phase 2: Computation Complete.");
  }


  private static async syncUniverse(symbols: string[]) {
    logger.debug({ symbolCount: symbols.length }, "Syncing universe definitions");
    const upserts = symbols.map((symbol) => {
      const coingeckoId = symbolToCoingeckoId(symbol);

      return prisma.asset.upsert({
        where: { symbol },
        update: { type: AssetType.CRYPTO, ...(coingeckoId ? { coingeckoId } : {}) },
        create: { symbol, name: symbol, type: AssetType.CRYPTO, ...(coingeckoId ? { coingeckoId } : {}) },
      });
    });

    // Chunk into batches of 50 to avoid exhausting the connection pool
    const UPSERT_CHUNK = 50;
    const results: Asset[] = [];
    for (let i = 0; i < upserts.length; i += UPSERT_CHUNK) {
      const batch = await Promise.all(upserts.slice(i, i + UPSERT_CHUNK));
      results.push(...batch);
    }
    return results;
  }

}
