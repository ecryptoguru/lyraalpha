import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "watchlist-drift-alert" });

export const dynamic = "force-dynamic";

/**
 * GET /api/user/watchlist/drift-alert
 * Returns count of watchlist assets with compatibilityScore < 40 (regime misaligned).
 * Used to power the sidebar drift alert badge.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ driftCount: 0 }, { status: 200 });
    }

    const cacheKey = `watchlist:drift:${userId}`;
    const cached = await getCache<{ driftCount: number }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const items = await prisma.watchlistItem.findMany({
      where: { userId },
      select: {
        asset: {
          select: {
            compatibilityScore: true,
          },
        },
      },
    });

    const driftCount = items.filter(
      (item) => item.asset.compatibilityScore !== null && item.asset.compatibilityScore < 40,
    ).length;

    const payload = { driftCount };
    await setCache(cacheKey, payload, 300).catch(() => {});

    return NextResponse.json(payload);
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Drift alert API failed");
    return NextResponse.json({ driftCount: 0 });
  }
}
