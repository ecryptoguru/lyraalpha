import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { delCache } from "@/lib/redis";
import { addCredits } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { getUserPlan, invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { normalizePlanTier } from "@/lib/middleware/plan-gate";

const logger = createLogger({ service: "user-diagnostic" });

const VALID_ACTIONS = new Set(["diagnose", "clear-cache", "restore-credits", "force-plan"]);
const VALID_PLANS = new Set(["STARTER", "PRO", "ELITE", "ENTERPRISE"]);

/**
 * POST /api/admin/user-diagnostic
 * Emergency diagnostic and repair endpoint for user account issues.
 * Requires admin authentication. Returns detailed user state and can fix common issues.
 */
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;
  const adminId = check.userId;

  try {
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || adminId;
    const action = VALID_ACTIONS.has(body.action) ? body.action as "diagnose" | "clear-cache" | "restore-credits" | "force-plan" : undefined;

    const results: Record<string, unknown> = {};

    // 1. Basic user info
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        plan: true,
        trialEndsAt: true,
        credits: true,
        monthlyCreditsBalance: true,
        bonusCreditsBalance: true,
        purchasedCreditsBalance: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: {
          where: { status: "ACTIVE" },
          select: { id: true, plan: true, status: true, currentPeriodEnd: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    results.user = {
      id: user.id,
      email: user.email,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      credits: user.credits,
      balances: {
        monthly: user.monthlyCreditsBalance,
        bonus: user.bonusCreditsBalance,
        purchased: user.purchasedCreditsBalance,
      },
      subscriptions: user.subscriptions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 2. Test getUserPlan
    try {
      const resolvedPlan = await getUserPlan(targetUserId);
      results.resolvedPlan = resolvedPlan;
      results.planResolution = "success";
    } catch (error) {
      results.resolvedPlan = null;
      results.planResolution = "failed";
      logger.error({ userId: targetUserId, err: sanitizeError(error) }, "getUserPlan failed in diagnostic");
    }

    // 3. Credit lots
    const creditLots = await prisma.creditLot.findMany({
      where: { userId: targetUserId, remainingAmount: { gt: 0 } },
      select: {
        id: true,
        bucket: true,
        remainingAmount: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    results.creditLots = creditLots;

    // 4. Recent credit transactions
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: targetUserId },
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    results.recentTransactions = transactions;

    // Execute requested actions (all gated behind admin — requireAdmin already verified above)
    if (action === "clear-cache" || action === "restore-credits") {
      await delCache(`plan:${targetUserId}`);
      await invalidatePlanCache(targetUserId);
      results.cacheCleared = true;
    }

    if (action === "restore-credits") {
      const isElitePlan = user.plan === "ELITE" || user.plan === "ENTERPRISE";
      const amount = isElitePlan ? 1500 : user.plan === "PRO" ? 500 : 50;

      const newBalance = await addCredits(
        targetUserId,
        amount,
        CreditTransactionType.ADJUSTMENT,
        "Emergency credit restore via diagnostic API"
      );
      results.creditsRestored = true;
      results.grantedAmount = amount;
      results.newBalance = newBalance;
    }

    if (action === "force-plan" && body.plan && VALID_PLANS.has(normalizePlanTier(body.plan))) {
      const safePlan = normalizePlanTier(body.plan);
      await prisma.user.update({
        where: { id: targetUserId },
        data: { plan: safePlan },
      });
      await invalidatePlanCache(targetUserId);
      results.planForced = safePlan;
    }

    // Re-test plan resolution after fixes
    if (action === "clear-cache" || action === "restore-credits") {
      try {
        const newResolvedPlan = await getUserPlan(targetUserId);
        results.resolvedPlanAfterFix = newResolvedPlan;
      } catch (error) {
        results.resolvedPlanAfterFix = null;
        logger.error({ userId: targetUserId, err: sanitizeError(error) }, "getUserPlan re-test failed in diagnostic");
      }
    }

    return NextResponse.json({
      success: true,
      action,
      targetUserId,
      results,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), adminId }, "User diagnostic failed");
    return NextResponse.json(
      { error: "Diagnostic failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
