import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { awardXP, checkWeeklyStreak, XPAction } from "@/lib/engines/gamification";
import { evaluateAndAwardBadges } from "@/lib/engines/badge-evaluator";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { LearningXPSchema } from "@/lib/schemas";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "learning-xp-api" });

/**
 * POST /api/learning/xp
 * Award XP for a learning action.
 * Body: { action: XPAction, context?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }
    const parsed = LearningXPSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const { action, context } = parsed.data;

    // Award XP (multiplier is now level-based, no plan flag needed)
    const result = await awardXP(userId, action as XPAction, context);

    // Check weekly streak bonus (if streak was updated)
    let streakBonus = null;
    if (result.streakUpdated) {
      streakBonus = await checkWeeklyStreak(userId);
    }

    // Evaluate badges after XP award
    const badgeResults = await evaluateAndAwardBadges(userId);

    return NextResponse.json({
      success: true,
      xp: result,
      streakBonus,
      badges: {
        newlyAwarded: badgeResults.awarded,
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "XP award failed");
    return NextResponse.json(
      { error: "Failed to award XP" },
      { status: 500 },
    );
  }
}
