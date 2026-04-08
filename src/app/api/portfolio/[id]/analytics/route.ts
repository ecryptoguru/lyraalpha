import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getUserPlan, isElitePlan } from "@/lib/middleware/plan-gate";
import { withCache } from "@/lib/redis";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

const ANALYTICS_CACHE_TTL = 600; // 10 minutes

function analyticsCacheKey(portfolioId: string): string {
  return `portfolio:analytics:${portfolioId}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id: portfolioId } = await params;
    const plan = await getUserPlan(userId);

    if (plan === "STARTER") {
      return NextResponse.json(
        { error: "Upgrade to Pro or Elite to access portfolio analytics.", gated: true },
        { status: 403 },
      );
    }

    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: { id: true, region: true },
    });
    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    const analytics = await withCache(
      analyticsCacheKey(portfolioId),
      async () => {
        const snapshot = await prisma.portfolioHealthSnapshot.findFirst({
          where: { portfolioId },
          orderBy: { date: "desc" },
          select: {
            healthScore: true,
            diversificationScore: true,
            concentrationScore: true,
            volatilityScore: true,
            correlationScore: true,
            qualityScore: true,
            fragilityScore: true,
            riskMetrics: true,
            regime: true,
            date: true,
          },
        });
        return snapshot;
      },
      ANALYTICS_CACHE_TTL,
    );

    return NextResponse.json({
      analytics,
      plan,
      fragilityAvailable: isElitePlan(plan),
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch portfolio analytics");
    return apiError("Failed to fetch portfolio analytics", 500);
  }
}
