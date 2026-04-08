import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "market-breadth-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get("region");
    const region = regionParam === "IN" ? "IN" : "US";

    const cacheKey = `market:breadth:${region}`;

    const payload = await withCache(
      cacheKey,
      async () => {
        // Single query: fetch all score fields needed for breadth calculation.
        // Avoids 3 separate COUNT round-trips to the DB.
        const assets = await prisma.asset.findMany({
          where: { region },
          select: { avgTrendScore: true, avgMomentumScore: true },
        });

        const total = assets.length;
        const trendUp = assets.filter((a) => (a.avgTrendScore ?? 0) > 55).length;
        const momentumUp = assets.filter((a) => (a.avgMomentumScore ?? 0) > 60).length;
        const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

        return {
          region,
          total,
          metrics: {
            trend: { threshold: 55, count: trendUp, percent: pct(trendUp) },
            momentum: { threshold: 60, count: momentumUp, percent: pct(momentumUp) },
          },
          computedAt: new Date().toISOString(),
        };
      },
      3600, // 1 hour TTL — breadth changes only on sync
    );

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
    return res;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Market breadth API failed");
    return apiError("Internal Server Error", 500);
  }
}
