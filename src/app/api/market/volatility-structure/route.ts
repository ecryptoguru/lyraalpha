import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "volatility-structure-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get("region");
    const region = regionParam === "IN" ? "IN" : "US";

    const cacheKey = `market:volatility:${region}`;

    const payload = await withCache(
      cacheKey,
      async () => {
        // Single query: fetch volatility scores and bucket in-memory.
        // Avoids 4 separate COUNT round-trips to the DB.
        const assets = await prisma.asset.findMany({
          where: { region },
          select: { avgVolatilityScore: true },
        });

        const total = assets.length;
        let low = 0, mid = 0, high = 0;
        for (const a of assets) {
          const v = a.avgVolatilityScore ?? 0;
          if (v < 35) low++;
          else if (v < 65) mid++;
          else high++;
        }
        const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

        return {
          region,
          total,
          buckets: {
            stable:   { label: "Stable",   count: low,  percent: pct(low) },
            normal:   { label: "Normal",   count: mid,  percent: pct(mid) },
            elevated: { label: "Elevated", count: high, percent: pct(high) },
          },
          computedAt: new Date().toISOString(),
        };
      },
      3600, // 1 hour TTL — volatility structure changes only on sync
    );

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
    return res;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Volatility structure API failed");
    return apiError("Internal Server Error", 500);
  }
}
