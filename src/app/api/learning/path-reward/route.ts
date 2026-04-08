import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardXP } from "@/lib/engines/gamification";
import { getLearningPathById } from "@/lib/learning/path-definitions";
import { isElitePlan, normalizePlanTier } from "@/lib/middleware/plan-gate";
import { apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { pathId } = await req.json();
    if (!pathId) {
      return apiError("Missing pathId", 400);
    }

    const path = getLearningPathById(pathId);
    if (!path) {
      return apiError("Invalid pathId", 400);
    }

    if (path.isEliteOnly) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      const plan = normalizePlanTier(user?.plan as string | null | undefined);
      if (!isElitePlan(plan)) {
        return apiError("This path requires an Elite plan", 403, { locked: true });
      }
    }

    const completionCount = await prisma.learningCompletion.count({
      where: {
        userId,
        moduleSlug: { in: path.modules },
      },
    });

    if (completionCount < path.modules.length) {
      return NextResponse.json(
        { error: "Complete all modules in this path before claiming the reward" },
        { status: 400 },
      );
    }

    // Check if already claimed
    const existing = await prisma.xPTransaction.findFirst({
      where: {
        userId,
        action: "complete_path",
        context: pathId,
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, alreadyAwarded: true });
    }

    // Award bonus XP (50 XP, configured in gamification.ts; multiplier applied level-based internally)
    const result = await awardXP(userId, "complete_path", pathId);

    return NextResponse.json({
      success: true,
      awarded: result.awarded,
      amount: result.amount,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to claim reward" },
      { status: 500 },
    );
  }
}
