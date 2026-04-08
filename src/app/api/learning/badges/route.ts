import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserBadges } from "@/lib/engines/badge-evaluator";
import { isElitePlan, normalizePlanTier } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "learning-badges-api" });

/**
 * GET /api/learning/badges
 * Returns all badges (earned + available with progress) for the user.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const isElite = isElitePlan(normalizePlanTier(user?.plan as string | null | undefined));

    const badges = await getUserBadges(userId, isElite);

    return NextResponse.json({
      success: true,
      ...badges,
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Badges fetch failed");
    return NextResponse.json(
      { error: "Failed to fetch badges" },
      { status: 500 },
    );
  }
}
