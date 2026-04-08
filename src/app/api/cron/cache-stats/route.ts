import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-cache-stats" });

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = "bom1";

export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "cache-stats" },
    async () => {
      const stats = (await redis.hgetall("cache:stats")) as Record<string, string> | null;
      const safeStats: Record<string, string> = stats ?? {};
      const hits = Number(safeStats.hit || safeStats.hits || 0);
      const misses = Number(safeStats.miss || safeStats.misses || 0);
      const total = hits + misses;
      const hitRate = total > 0 ? Number(((hits / total) * 100).toFixed(2)) : 0;

      return NextResponse.json({
        success: true,
        stats: {
          hits,
          misses,
          total,
          hitRate,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
