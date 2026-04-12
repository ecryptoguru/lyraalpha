import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateCompatibility,
  AssetSignals,
  CompatibilityResult,
} from "@/lib/engines/compatibility";
import { classifyAsset, GroupingResult, AssetGroup } from "@/lib/engines/grouping";
import { rateLimitMarketData } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit/utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { calculateScoreDynamics } from "@/lib/engines/score-dynamics";
import { ScoreType } from "@/generated/prisma/client";
import { PerformanceMetrics } from "@/lib/engines/performance";
import { CorrelationMetrics } from "@/lib/engines/correlation-regime";
import { AssetService, analyticsAssetSelect, AnalyticsAsset } from "@/lib/services/asset.service";
import { getCache, setCache } from "@/lib/redis";
import { calculateSignalStrength, FundamentalData } from "@/lib/engines/signal-strength";
import { getUserPlan, canAccessAssetType } from "@/lib/middleware/plan-gate";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "analytics-api" });

const ANALYTICS_CACHE_TTL = 300; // 5 minutes Redis cache TTL

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    const upperSymbol = (symbol || "").trim().toUpperCase();
    const fresh = req.nextUrl.searchParams.get("fresh") === "1";

    if (!upperSymbol || upperSymbol === "UNDEFINED" || upperSymbol === "NULL") {
      return apiError("Symbol is required.", 400);
    }

    // Resolve user plan once (used for both gating + rate limits)
    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    if (!fresh) {
      try {
        const cached = await getCache<Record<string, unknown>>(AssetService.getAnalyticsCacheKey(upperSymbol));
        const cachedPayload = cached as ({ type?: string } & Record<string, unknown>) | null;
        if (cachedPayload) {
          if (cachedPayload.type && !canAccessAssetType(plan, cachedPayload.type as AnalyticsAsset["type"])) {
            return NextResponse.json(
              { error: "Upgrade to Elite to access crypto market intelligence." },
              { status: 403 },
            );
          }
          const response = NextResponse.json(cached);
          response.headers.set("Cache-Control", "private, no-store");
          return response;
        }
      } catch (cacheError) {
        logger.warn(
          { symbol: upperSymbol, err: sanitizeError(cacheError) },
          "Analytics cache read failed, proceeding without cache",
        );
      }
    }

    logger.info({ symbol: upperSymbol }, "Processing analytics request");

    // 0. Rate Limiting
    const identifier = userId || getClientIp(req);
    const isTest = isRateLimitBypassEnabled();

    if (!isTest) {
      const rateLimitError = await rateLimitMarketData(
        identifier,
        userId || undefined,
      );
      if (rateLimitError) {
        return rateLimitError;
      }
    }

    // 1. Fetch asset first (single query) - get region + full data in one call
    const assetWithRegion = await prisma.asset.findUnique({
      where: { symbol: upperSymbol },
      select: analyticsAssetSelect
    });

    if (!assetWithRegion) {
      logger.warn({ symbol: upperSymbol }, "Asset not found in database");
      return apiError("Asset data not found.", 404);
    }

    const assetRegion = assetWithRegion.region || "US";
    const currentAsset = assetWithRegion as unknown as AnalyticsAsset;

    // 2. Parallel Fetch: Market context + Events (asset already fetched above)
    const [latestRegime, events] = await Promise.all([
      prisma.marketRegime.findFirst({ 
        where: { region: assetRegion },
        orderBy: { date: "desc" },
        select: { context: true, date: true }
      }),
      prisma.institutionalEvent.findMany({
        where: { 
          asset: { symbol: upperSymbol },
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
        },
        orderBy: { date: "desc" },
        select: { id: true, type: true, title: true, description: true, severity: true, date: true, metadata: true }
      }),
    ]);
    
    if (!latestRegime || !latestRegime.context) {
      return apiError("Market context not initialized.", 404);
    }

    // Market access policy: Starter/Pro cannot access crypto analytics
    if (!canAccessAssetType(plan, currentAsset.type)) {
      return NextResponse.json(
        { error: "Upgrade to Elite to access crypto market intelligence." },
        { status: 403 },
      );
    }

    if (!currentAsset.lastPriceUpdate) {
      return apiError("Asset data not synchronized.", 404);
    }

    const makeDimension = (obj: unknown, defaultLabel: string) => {
      const base = { score: 50, confidence: "medium" as const, drivers: ["Not available"] };
      if (typeof obj === "string") return { ...base, label: obj, drivers: [obj] };
      if (obj && typeof obj === "object") {
        const o = obj as Record<string, unknown>;
        return {
          score: typeof o.score === "number" ? o.score : 50,
          label: typeof o.label === "string" ? o.label : defaultLabel,
          confidence: (["low", "medium", "high"].includes(o.confidence as string) ? o.confidence : "medium") as "low" | "medium" | "high",
          drivers: Array.isArray(o.drivers) ? (o.drivers as string[]) : [String(o.drivers ?? "Not available")],
        };
      }
      return { ...base, label: defaultLabel };
    };

    let marketContextRaw: Record<string, unknown> = {};
    try {
      marketContextRaw = JSON.parse(latestRegime.context);
    } catch {
      logger.warn({ symbol: upperSymbol }, "Failed to parse market regime context, using fallback");
    }

    const marketContext = {
      regime: makeDimension(marketContextRaw.regime, "NEUTRAL"),
      volatility: makeDimension(marketContextRaw.volatility, "NORMAL"),
      risk: makeDimension(marketContextRaw.risk, "NEUTRAL"),
      breadth: makeDimension(marketContextRaw.breadth, "NEUTRAL"),
      liquidity: makeDimension(marketContextRaw.liquidity, "NORMAL"),
      lastUpdated: latestRegime.date?.toISOString?.() ?? new Date().toISOString(),
    } as import("@/lib/engines/market-regime").MarketContextSnapshot;

    // 2. Read pre-computed signals from denormalized fields
    const signals: AssetSignals = {
      trend: currentAsset.avgTrendScore || 0,
      momentum: currentAsset.avgMomentumScore || 0,
      volatility: currentAsset.avgVolatilityScore || 0,
      liquidity: currentAsset.avgLiquidityScore || 0,
      sentiment: currentAsset.avgSentimentScore || 0,
      trust: currentAsset.avgTrustScore || 0,
    };

    // Fallback if denormalized data is missing (first sync not yet run)
    const hasDenormalizedSignals = Object.values(signals).some(v => v !== 0);
    if (!hasDenormalizedSignals) {
      const latestScores = await AssetService.getAssetScores(currentAsset.id, upperSymbol, 7);
      if (latestScores && latestScores.length > 0) {
        const seenTypes = new Set<string>();
        latestScores.forEach((s) => {
          const typeLower = s.type.toLowerCase() as keyof AssetSignals;
          if (typeLower in signals && !seenTypes.has(typeLower)) {
            signals[typeLower] = s.value;
            seenTypes.add(typeLower);
          }
        });
      }
    }

    // 3. Read all pre-computed analytics from Asset record (stored as Json fields)
    const readJson = <T>(field: unknown, fallback: T): T => {
      if (field && typeof field === "object") return field as T;
      return fallback;
    };

    // Performance: use pre-computed, with safe defaults
    const performance: PerformanceMetrics = readJson<PerformanceMetrics>(currentAsset.performanceData, {
      returns: { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, YTD: null, "1Y": null },
      range52W: { high: currentAsset.fiftyTwoWeekHigh, low: currentAsset.fiftyTwoWeekLow, currentPosition: null, distanceFromHigh: null, distanceFromLow: null }
    });

    // Correlation Regime: use pre-computed
    const finalCorrelationRegime: CorrelationMetrics = readJson<CorrelationMetrics>(currentAsset.correlationRegime, {
      avgCorrelation: 0.45,
      dispersion: 0.18,
      trend: "STABLE",
      regime: "NORMAL",
      confidence: "low",
      implications: "Baseline estimates. Run full analytics sync to populate.",
    });

    // Factor Alignment: use pre-computed
    const factorAlignment = readJson<Record<string, unknown> | null>(currentAsset.factorAlignment, null);

    // Event-Adjusted Scores: use pre-computed
    const eventAdjustedScores: Record<string, unknown> = readJson<Record<string, unknown>>(currentAsset.eventAdjustedScores, {});

    // Score Dynamics: use pre-computed with lightweight fallback (cached)
    let scoreDynamics: Record<string, unknown> = {};
    const assetDynamics = currentAsset.scoreDynamics as Record<string, unknown> | null;
    
    if (assetDynamics && Object.keys(assetDynamics).length > 0) {
      scoreDynamics = assetDynamics;
    } else {
      // Check Redis cache before computing (avoids 6 DB queries on repeated requests)
      const dynamicsCacheKey = `asset:dynamics:${upperSymbol}`;
      let cachedDynamics: Record<string, unknown> | null = null;
      try {
        cachedDynamics = await getCache<Record<string, unknown>>(dynamicsCacheKey);
      } catch (cacheError) {
        logger.warn(
          { symbol: upperSymbol, err: sanitizeError(cacheError) },
          "Dynamics cache read failed, recomputing",
        );
      }
      if (cachedDynamics) {
        scoreDynamics = cachedDynamics;
      } else {
        const scoreTypes: ScoreType[] = ["TREND", "MOMENTUM", "VOLATILITY", "SENTIMENT", "LIQUIDITY", "TRUST"];
        const sectorMapping = await prisma.stockSector.findFirst({
          where: { assetId: currentAsset.id, isActive: true },
          select: { sectorId: true },
        });
        const dynamicsResults = await Promise.all(scoreTypes.map(async (scoreType) => {
          const d = await calculateScoreDynamics(currentAsset.id, scoreType, sectorMapping?.sectorId);
          return d ? { type: scoreType.toLowerCase(), dynamics: d } : null;
        }));
        dynamicsResults.forEach(r => { if (r) scoreDynamics[r.type] = r.dynamics; });
        // Cache for 15 minutes
        if (Object.keys(scoreDynamics).length > 0) {
          await setCache(dynamicsCacheKey, scoreDynamics, 900).catch(() => {});
        }
      }
    }

    // 4. Compatibility & Grouping: use pre-computed
    let compatibility: CompatibilityResult = {
      score: currentAsset.compatibilityScore || 0,
      label: (currentAsset.compatibilityLabel as CompatibilityResult["label"]) || "Mixed Fit",
      confidence: "high",
      explanation: [] as string[],
      breakdown: { trend: 0, momentum: 0, volatility: 0, liquidity: 0, sentiment: 0 }
    };

    // Only recalculate if no pre-computed data exists
    if (compatibility.score === 0) {
      compatibility = calculateCompatibility(signals, marketContext);
    }

    const grouping: GroupingResult = currentAsset.assetGroup 
      ? { group: currentAsset.assetGroup as AssetGroup, explanation: "Institutional classification persisted from latest sync cycle.", intent: "Strategy Alignment" }
      : classifyAsset(signals, compatibility, currentAsset.type.toLowerCase());

    // 5. Signal Strength: use pre-computed from DB, fall back to live computation
    const precomputedSignal = readJson<Record<string, unknown> | null>(currentAsset.signalStrength, null);
    let signalStrength: Record<string, unknown> | null = precomputedSignal;

    if (!precomputedSignal || !precomputedSignal.score) {
      const meta = (currentAsset.metadata || {}) as Record<string, unknown>;
      const fundamentals: FundamentalData = {
        peRatio: (meta.peRatio as number) ?? null,
        industryPe: (meta.industryPe as number) ?? null,
        pegRatio: (meta.pegRatio as number) ?? null,
        priceToBook: (meta.priceToBook as number) ?? null,
        roe: (meta.roe as number) ?? null,
        roce: (meta.roce as number) ?? null,
        profitMargins: (meta.profitMargins as number) ?? null,
        operatingMargins: (meta.operatingMargins as number) ?? null,
        revenueGrowth: (meta.revenueGrowth as number) ?? null,
        dividendYield: (meta.dividendYield as number) ?? null,
        shortRatio: (meta.shortRatio as number) ?? null,
        heldPercentInstitutions: (meta.heldPercentInstitutions as number) ?? null,
        targetMeanPrice: (meta.targetMeanPrice as number) ?? null,
        currentPrice: currentAsset.price,
        distanceFrom52WHigh: performance.range52W.distanceFromHigh,
        beta: (meta.beta as number) ?? null,
        debtToEquity: (meta.debtToEquity as number) ?? null,
      };

      signalStrength = calculateSignalStrength({
        signals,
        compatibility,
        marketContext,
        assetType: currentAsset.type,
        scoreDynamics: scoreDynamics as Record<string, import("@/types/analytics").ScoreDynamics> | null,
        eventAdjustedScores: eventAdjustedScores as Record<string, import("@/types/analytics").EventImpact> | null,
        factorAlignment: factorAlignment as { score: number; regimeFit: string; dominantFactor?: string } | null,
        fundamentals,
        groupClassification: grouping.group,
      }) as unknown as Record<string, unknown>;
    }

    // 6. Assemble payload — all data from DB, zero live engine calculations
    const payload = {
      symbol: currentAsset.symbol,
      name: currentAsset.name,
      type: currentAsset.type,
      price: currentAsset.price,
      changePercent: currentAsset.changePercent,
      currency: currentAsset.currency,
      lastUpdated: currentAsset.lastPriceUpdate,
      signals,
      compatibility,
      grouping,
      marketContext,

      scoreDynamics,
      eventAdjustedScores,
      correlationRegime: finalCorrelationRegime,
      factorAlignment,

      factorData: currentAsset.factorData,
      correlationData: currentAsset.correlationData,
      events,
      technicalMetrics: {
        marketCap: currentAsset.marketCap,
        volume: currentAsset.volume,
        avgVolume: currentAsset.avgVolume,
        oneYearChange: currentAsset.oneYearChange,
        fiftyTwoWeekHigh: performance.range52W.high || currentAsset.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: performance.range52W.low || currentAsset.fiftyTwoWeekLow,
        category: currentAsset.category,
        openInterest: currentAsset.openInterest,
        technicalRating: currentAsset.technicalRating,
        analystRating: currentAsset.analystRating,
        distanceFrom52WHigh: performance.range52W.distanceFromHigh,
        distanceFrom52WLow: performance.range52W.distanceFromLow,
      },
      performance,
      signalStrength,
      metadata: currentAsset.metadata as Record<string, unknown> || {},
      description: currentAsset.description || null,
      industry: currentAsset.industry || null,
      sector: currentAsset.sector || null,
    };

    if (!fresh) {
      await setCache(
        AssetService.getAnalyticsCacheKey(upperSymbol),
        payload,
        ANALYTICS_CACHE_TTL,
      ).catch((cacheError) => {
        logger.warn(
          { symbol: upperSymbol, err: sanitizeError(cacheError) },
          "Analytics cache write failed, response will still be returned",
        );
      });
    }

    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "private, no-store");

    logger.info({ symbol: upperSymbol }, "Analytics request completed");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Asset analytics failed");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
