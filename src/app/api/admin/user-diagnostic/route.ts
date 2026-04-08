import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { delCache } from "@/lib/redis";
import { addCredits } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { getUserPlan, invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { isPrivilegedEmail } from "@/lib/auth";

const logger = createLogger({ service: "user-diagnostic" });

/**
 * POST /api/admin/user-diagnostic
 * Emergency diagnostic and repair endpoint for user account issues.
 * Returns detailed user state and can fix common issues (cache, credits, plan).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional: Check if admin for sensitive operations
    const isAdmin = isPrivilegedEmail(
      await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).then(u => u?.email)
    );

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || userId;
    const action = body.action as "diagnose" | "clear-cache" | "restore-credits" | "force-plan" | undefined;

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
      return NextResponse.json({ error: "User not found", userId: targetUserId }, { status: 404 });
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
      results.planError = String(error);
      logger.error({ userId: targetUserId, err: error }, "getUserPlan failed in diagnostic");
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

    // Execute requested actions
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
        `Emergency credit restore via diagnostic API`
      );
      results.creditsRestored = true;
      results.grantedAmount = amount;
      results.newBalance = newBalance;
    }

    if (action === "force-plan" && isAdmin && body.plan) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { plan: body.plan },
      });
      await invalidatePlanCache(targetUserId);
      results.planForced = body.plan;
    }

    // Re-test plan resolution after fixes
    if (action === "clear-cache" || action === "restore-credits") {
      try {
        const newResolvedPlan = await getUserPlan(targetUserId);
        results.resolvedPlanAfterFix = newResolvedPlan;
      } catch (error) {
        results.resolvedPlanAfterFix = null;
        results.planErrorAfterFix = String(error);
      }
    }

    return NextResponse.json({
      success: true,
      action,
      targetUserId,
      results,
    });
  } catch (error) {
    logger.error({ err: error }, "User diagnostic failed");
    return NextResponse.json(
      { error: "Diagnostic failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
