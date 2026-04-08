import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserProgressWithMeta, getRecentXPTransactions } from "@/lib/engines/gamification";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "learning-progress-api" });

/**
 * GET /api/learning/progress
 * Returns user's XP, level, streak, tier, and recent activity.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const [progress, recentActivity] = await Promise.all([
      getUserProgressWithMeta(userId),
      getRecentXPTransactions(userId, 10),
    ]);

    return NextResponse.json({
      success: true,
      progress,
      recentActivity,
    }, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Progress fetch failed");
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 },
    );
  }
}
