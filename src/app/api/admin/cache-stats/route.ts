import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { redis } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-cache-stats" });

// Block 11: Cache monitoring endpoint — returns per-prefix hit/miss counts + hit rates.
// Protected by requireAdmin (same auth guard as all other admin routes).
// Data sourced from cache:stats hash written by recordCacheMetric (5% sample rate).
// Key has a weekly TTL so it never accumulates forever.
export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const raw = await redis.hgetall("cache:stats");
    if (!raw) {
      return NextResponse.json({ message: "No cache stats recorded yet. Set CACHE_STATS_SAMPLE_RATE=0.05 in env.", stats: {} });
    }

    const entries = Object.entries(raw).map(([field, val]) => [field, Number(val)] as [string, number]);
    const statsMap = Object.fromEntries(entries);

    // Aggregate per-prefix hit rates
    const prefixes = [...new Set(
      Object.keys(statsMap)
        .filter((k) => k.includes(":"))
        .map((k) => k.split(":")[0])
    )];

    const perPrefix = prefixes.map((prefix) => {
      const hits = statsMap[`${prefix}:hit`] ?? 0;
      const misses = statsMap[`${prefix}:miss`] ?? 0;
      const total = hits + misses;
      const hitRate = total > 0 ? Math.round((hits / total) * 100) : null;
      return { prefix, hits, misses, total, hitRatePct: hitRate };
    }).sort((a, b) => b.total - a.total);

    const globalHits = statsMap["hit"] ?? 0;
    const globalMisses = statsMap["miss"] ?? 0;
    const globalTotal = globalHits + globalMisses;

    return NextResponse.json({
      global: {
        hits: globalHits,
        misses: globalMisses,
        total: globalTotal,
        hitRatePct: globalTotal > 0 ? Math.round((globalHits / globalTotal) * 100) : null,
        note: "Based on 5% sampling (CACHE_STATS_SAMPLE_RATE=0.05) — multiply by ~20 for estimated real totals.",
      },
      perPrefix,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch cache stats");
    return apiError("Failed to fetch cache stats", 500);
  }
}
