import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "factor-rotation-api" });

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = "bom1";

interface FactorConfig {
  label: string;
  minMomentum?: number;
  maxMomentum?: number;
  minTrend?: number;
  maxVolatility?: number;
  minTrust?: number;
}

const FACTOR_BUCKETS: Record<string, FactorConfig> = {
  momentum: { minMomentum: 70, label: "Momentum" },
  value: { minTrend: 50, maxMomentum: 50, label: "Value" },
  quality: { minTrust: 65, label: "Quality" },
  lowVol: { maxVolatility: 40, label: "Low Volatility" },
  growth: { minMomentum: 60, minTrend: 60, label: "Growth" },
};

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    const region = req.nextUrl.searchParams.get("region") || "US";
    const cacheKey = `factor-rotation:${region}`;

    try {
      const cached = await getCache(cacheKey);
      if (cached) return NextResponse.json(cached);
    } catch { /* Redis unavailable */ }

    // Get stocks with scores
    const assets = await prisma.asset.findMany({
      where: {
        type: "STOCK",
        region,
        avgTrendScore: { not: null },
        avgMomentumScore: { not: null },
      },
      select: {
        symbol: true,
        avgTrendScore: true,
        avgMomentumScore: true,
        avgVolatilityScore: true,
        avgTrustScore: true,
        changePercent: true,
      },
      orderBy: { avgMomentumScore: "desc" },
      take: 200,
    });

    if (assets.length === 0) {
      return NextResponse.json({ factors: [], region });
    }

    // Compute factor averages
    const factorResults = Object.entries(FACTOR_BUCKETS).map(([key, config]) => {
      const bucket = assets.filter((a) => {
        const trend = a.avgTrendScore ?? 0;
        const momentum = a.avgMomentumScore ?? 0;
        const volatility = a.avgVolatilityScore ?? 0;
        const trust = a.avgTrustScore ?? 0;

        if (config.minMomentum != null && momentum < config.minMomentum) return false;
        if (config.maxMomentum != null && momentum > config.maxMomentum) return false;
        if (config.minTrend != null && trend < config.minTrend) return false;
        if (config.maxVolatility != null && volatility > config.maxVolatility) return false;
        if (config.minTrust != null && trust < config.minTrust) return false;
        return true;
      });

      const avgChange = bucket.length > 0
        ? bucket.reduce((sum, a) => sum + (a.changePercent ?? 0), 0) / bucket.length
        : 0;

      const avgMomentum = bucket.length > 0
        ? bucket.reduce((sum, a) => sum + (a.avgMomentumScore ?? 0), 0) / bucket.length
        : 0;

      return {
        factor: key,
        label: config.label,
        count: bucket.length,
        avgChangePercent: parseFloat(avgChange.toFixed(2)),
        avgMomentumScore: parseFloat(avgMomentum.toFixed(1)),
        status: avgChange > 0.5 ? "leading" : avgChange < -0.5 ? "lagging" : "neutral",
        topSymbols: bucket
          .sort((a, b) => (b.avgMomentumScore ?? 0) - (a.avgMomentumScore ?? 0))
          .slice(0, 3)
          .map((a) => a.symbol.replace(/\.NS$/, "").replace(/\.BO$/, "")),
      };
    });

    // Sort by avgChangePercent descending
    factorResults.sort((a, b) => b.avgChangePercent - a.avgChangePercent);

    const result = {
      factors: factorResults,
      region,
      assetCount: assets.length,
      computedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result, 3600).catch(() => {});
    const res = NextResponse.json(result);
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
    return res;
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Factor rotation API failed");
    return apiError("Internal error", 500);
  }
}
