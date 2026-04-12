import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { rateLimitMarketData } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit/utils";
import { getUserPlan, canAccessAssetType, canAccessRegion } from "@/lib/middleware/plan-gate";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";

const logger = createLogger({ service: "stocks-api" });

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30));
    const skip = (page - 1) * limit;

    const typeParam = searchParams.get("type");
    const query = searchParams.get("q");
    const regionParam = (searchParams.get("region") || "US").toUpperCase();
    const fresh = searchParams.get("fresh") === "1";

    // Resolve plan before cache read so cache key can be plan-scoped.
    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    if (!canAccessRegion(plan, regionParam)) {
      return NextResponse.json(
        { error: "Starter and Pro plans support IN/US markets only." },
        { status: 403 },
      );
    }

    if (typeParam?.toUpperCase() === "CRYPTO" && !canAccessAssetType(plan, "CRYPTO")) {
      return NextResponse.json(
        { error: "Upgrade to Elite to access crypto market coverage." },
        { status: 403 },
      );
    }

    const cacheKey = `coverage:v3:${regionParam}:${typeParam || "ALL"}:${query || ""}:${page}:${limit}:${plan}`;

    if (!fresh) {
      const cached = await getCache(cacheKey);
      if (cached) {
        const response = NextResponse.json(cached);
        response.headers.set(
          "Cache-Control",
          "private, no-store",
        );
        return response;
      }
    }

    // 0. Rate Limiting
    const identifier = userId || getClientIp(req);

    // Bypass rate limit for E2E tests — ONLY in non-production environments
    const isTest = isRateLimitBypassEnabled();

    if (!isTest) {
      const rateLimitError = await rateLimitMarketData(identifier, userId || undefined);
      if (rateLimitError) {
        logger.warn({ identifier, userId }, "Rate limit exceeded for coverage");
        return rateLimitError;
      }
    }

    // 1. Get the latest Market Regime
    // 2. Fetch assets with Server-Side Filtering
    // GOLD-MCX and SILVER-MCX are proper IN region assets (region="IN", currency="INR")
    // US commodities remain region="US" — fully separate.
    // Crypto assets are global (region: null) and should appear in all region views.
    const whereInput: Prisma.AssetWhereInput = {
      lastPriceUpdate: { not: null },
      OR: [
        { region: regionParam },
        { region: null },
      ],
    };

    if (typeParam && typeParam !== "ALL") {
      whereInput.type = typeParam as Prisma.EnumAssetTypeFilter;
    }

    if (!canAccessAssetType(plan, "CRYPTO") && (!typeParam || typeParam === "ALL")) {
      whereInput.type = { not: "CRYPTO" };
    }

    if (query) {
      whereInput.OR = [
        { symbol: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ];
    }

    // Columns shared across all asset types
    const baseSelect = {
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
      oneYearChange: true,
      fiftyTwoWeekHigh: true,
      fiftyTwoWeekLow: true,
      category: true,
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
    } as const;

    // Equity-specific columns (always null for CRYPTO)
    const equitySelect = {
      peRatio: true,
      avgVolume: true,
      dividendYield: true,
      industryPe: true,
      roe: true,
      roce: true,
      eps: true,
      pegRatio: true,
      priceToBook: true,
      shortRatio: true,
      expenseRatio: true,
      nav: true,
      yield: true,
      morningstarRating: true,
      openInterest: true,
      fundHouse: true,
      schemeType: true,
    } as const;

    const isCryptoOnly = typeParam?.toUpperCase() === "CRYPTO";
    const assetSelect = isCryptoOnly
      ? baseSelect
      : { ...baseSelect, ...equitySelect };

    const [latestRegimeForRegion, latestRegimeUS, dbAssets, totalCount] = await Promise.all([
      prisma.marketRegime.findFirst({
        where: { region: regionParam },
        orderBy: { date: "desc" },
        select: { context: true, date: true, state: true },
      }),
      regionParam !== "US" ? prisma.marketRegime.findFirst({
        where: { region: "US" },
        orderBy: { date: "desc" },
        select: { context: true, date: true, state: true },
      }) : Promise.resolve(null),
      prisma.asset.findMany({
        where: whereInput,
        orderBy: { marketCap: { sort: "desc", nulls: "last" } },
        take: limit,
        skip: skip,
        select: assetSelect,
      }),
      prisma.asset.count({
        where: whereInput
      }),
    ]);

    // 3. Construct Market Context — fall back to US regime or full defaults if no regime exists
    const latestRegime = latestRegimeForRegion ?? latestRegimeUS;

    // Ensure the structure is correct even if JSON parsed but was missing objects
    const createFallback = (obj: unknown, defaultLabel: string) => {
      if (typeof obj === "string") return { label: obj, drivers: [obj], confidence: 50 };
      if (obj && typeof obj === "object" && "label" in obj) return obj;
      return { label: defaultLabel, drivers: ["Not available"], confidence: 50 };
    };

    let marketContextData: Record<string, unknown> = {};
    if (latestRegime?.context) {
      try {
        marketContextData = JSON.parse(latestRegime.context);
      } catch {
        logger.warn({ regimeId: latestRegime.state }, "Failed to parse regime context as JSON, falling back to defaults");
      }
    } else {
      logger.info({ region: regionParam }, "No market regime found — returning default context");
    }

    const marketContext = {
       regime: createFallback(marketContextData.regime, latestRegime?.state || "Initializing"),
       volatility: createFallback(marketContextData.volatility, "Normal"),
       risk: createFallback(marketContextData.risk, "Neutral"),
       breadth: createFallback(marketContextData.breadth, "Neutral"),
       liquidity: createFallback(marketContextData.liquidity, "Normal"),
       lastUpdated: latestRegime?.date ?? null,
    };

    // 4. Transform to expected UI format
    const assets = dbAssets.map(asset => ({
      ...asset,
      lastUpdated: asset.lastPriceUpdate,
      signals: {
        trend: Math.round((asset.avgTrendScore as number) || 0),
        momentum: Math.round((asset.avgMomentumScore as number) || 0),
        volatility: Math.round((asset.avgVolatilityScore as number) || 0),
        liquidity: Math.round((asset.avgLiquidityScore as number) || 0),
        sentiment: Math.round((asset.avgSentimentScore as number) || 0),
        trust: Math.round((asset.avgTrustScore as number) || 0)
      },
      compatibility: {
        score: Math.round((asset.compatibilityScore as number) || 0),
        label: (asset.compatibilityLabel || "Mixed Fit") as string
      },
      grouping: {
        group: (asset.assetGroup || "Neutral / Defensive") as string
      }
    }));

    const hasMore = skip + limit < totalCount;

    const payload = {
      marketContext,
      assets,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore,
      },
      lastSync: latestRegime?.date ?? null,
    };

    if (!fresh) {
      await setCache(cacheKey, payload, 900);
    }

    const response = NextResponse.json(payload);

    // 6. Browser never caches — Redis handles server-side caching (15 min TTL)
    response.headers.set(
      "Cache-Control",
      "private, no-store",
    );

    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Coverage API failed");
    return NextResponse.json(
      { error: "Failed to fetch coverage data" },
      { status: 500 },
    );
  }
}
