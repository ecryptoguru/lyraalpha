import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCache, delCache } from "@/lib/redis";
import { computeAndStorePortfolioHealth } from "@/lib/services/portfolio.service";
import { portfolioHealthCacheKey } from "@/lib/cache-keys";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

const HEALTH_CACHE_TTL = 300; // 5 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id: portfolioId } = await params;
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";

    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: { id: true, region: true },
    });
    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    if (forceRefresh) {
      // Delete cache before recompute so the new snapshot lands fresh
      await delCache(portfolioHealthCacheKey(portfolioId));
      await computeAndStorePortfolioHealth(portfolioId).catch((err) => {
        logger.warn({ err: sanitizeError(err), portfolioId }, "Health recompute on refresh failed (non-fatal)");
      });
      // Read directly from DB after refresh — don't let a stale in-flight withCache serve old data
      const freshSnapshot = await prisma.portfolioHealthSnapshot.findFirst({
        where: { portfolioId },
        orderBy: { date: "desc" },
      });
      if (!freshSnapshot) {
        return NextResponse.json({ snapshot: null, message: "No health data yet. Add holdings to compute health." });
      }
      return NextResponse.json({ snapshot: freshSnapshot });
    }

    const snapshot = await withCache(
      portfolioHealthCacheKey(portfolioId),
      async () => {
        return prisma.portfolioHealthSnapshot.findFirst({
          where: { portfolioId },
          orderBy: { date: "desc" },
        });
      },
      HEALTH_CACHE_TTL,
    );

    if (!snapshot) {
      return NextResponse.json({ snapshot: null, message: "No health data yet. Add holdings to compute health." });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch portfolio health");
    return apiError("Failed to fetch portfolio health", 500);
  }
}
