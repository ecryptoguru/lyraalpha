import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/utils/ensure-user";
import { getUserPlan, invalidatePlanCache } from "@/lib/middleware/plan-gate";
import {
  isAllowedPrelaunchCoupon,
  normalizePrelaunchCoupon,
  PRELAUNCH_TRIAL_DAYS,
} from "@/lib/config/prelaunch";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";

const PROMO_ERROR_MESSAGE = "coupon not found/expired";

export interface PrelaunchAccessStatus {
  entitled: boolean;
  plan: "STARTER" | "PRO" | "ELITE" | "ENTERPRISE";
  requiresCoupon: boolean;
}

export async function getPrelaunchAccessStatus(userId: string): Promise<PrelaunchAccessStatus> {
  await ensureUserExists(userId);
  const plan = await getUserPlan(userId);

  const entitled = plan !== "STARTER";
  return {
    entitled,
    plan,
    requiresCoupon: !entitled,
  };
}

export async function redeemPrelaunchCoupon(userId: string, couponCode: string) {
  const code = normalizePrelaunchCoupon(couponCode);
  if (!code) {
    return { success: false as const, error: PROMO_ERROR_MESSAGE };
  }

  await ensureUserExists(userId);

  // Short-circuit: if the user is already on a paid plan (e.g. webhook already applied
  // the coupon during sign-up), return success immediately without touching usedCount.
  const existingPlan = await getUserPlan(userId);
  if (existingPlan !== "STARTER") {
    await invalidatePlanCache(userId);
    return { success: true as const, redirectUrl: "/dashboard" };
  }

  // Lightweight pre-flight: check hardcoded coupons before hitting the DB
  const isHardcodedPromo = isAllowedPrelaunchCoupon(code);

  // For DB promo codes, do a quick existence check outside the tx to fail fast
  // on clearly invalid codes — the real guard runs atomically inside the tx below.
  if (!isHardcodedPromo) {
    const promo = await prisma.promoCode.findUnique({
      where: { code },
      select: { id: true, isActive: true, expiresAt: true },
    });
    const couldBeValid = Boolean(
      promo && promo.isActive && (!promo.expiresAt || promo.expiresAt > new Date()),
    );
    if (!couldBeValid) {
      return { success: false as const, error: PROMO_ERROR_MESSAGE };
    }
  }

  // Interactive-callback transaction: all reads AND writes run in one atomic unit,
  // eliminating the TOCTOU window on maxUses-limited promo codes.
  const result = await prisma.$transaction(async (tx) => {
    // Check if user has already completed onboarding — don't wipe their progress
    const existingPreference = await tx.userPreference.findUnique({
      where: { userId },
      select: { onboardingCompleted: true },
    });
    const hasCompletedOnboarding = Boolean(existingPreference?.onboardingCompleted);

    let promoDurationDays = PRELAUNCH_TRIAL_DAYS;

    if (!isHardcodedPromo) {
      // Re-fetch inside tx and atomically increment — enforces maxUses under concurrency
      const promo = await tx.promoCode.findUnique({
        where: { code },
        select: { id: true, durationDays: true, isActive: true, expiresAt: true, maxUses: true, usedCount: true },
      });

      const isValidNow = Boolean(
        promo &&
          promo.isActive &&
          (!promo.expiresAt || promo.expiresAt > new Date()) &&
          (!promo.maxUses || promo.usedCount < promo.maxUses),
      );

      if (!isValidNow || !promo) {
        // Coupon expired or maxUses reached between pre-flight and now
        return { aborted: true as const };
      }

      promoDurationDays = promo.durationDays;

      await tx.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + promoDurationDays);

    await tx.user.update({
      where: { id: userId },
      data: {
        plan: "ELITE",
        trialEndsAt,
        updatedAt: new Date(),
      },
    });

    await tx.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferredRegion: "US",
        experienceLevel: "BEGINNER",
        interests: ["STOCKS", "ETF"],
        onboardingStep: 0,
        onboardingCompleted: false,
        onboardingSkipped: false,
      },
      update: hasCompletedOnboarding
        ? {} // preserve existing onboarding state for returning users
        : {
            onboardingStep: 0,
            onboardingCompleted: false,
            onboardingCompletedAt: null,
            onboardingSkipped: false,
          },
    });

    // Grant 500 bonus credits for hardcoded prelaunch coupons (ELITE15/ELITE30).
    // Idempotency: referenceId key prevents double-grant if the Clerk webhook
    // already ran this path during user.created with the same coupon code.
    if (isHardcodedPromo) {
      const promoGrantReferenceId = `clerk-signup-prelaunch:${code}:${userId}`;
      const existingGrant = await tx.creditTransaction.findFirst({
        where: { userId, referenceId: promoGrantReferenceId },
        select: { id: true },
      });
      if (!existingGrant) {
        await grantCreditsInTransaction(
          tx,
          userId,
          500,
          "ADJUSTMENT",
          `Prelaunch coupon credits — ${code} (${promoDurationDays}-day Elite)`,
          promoGrantReferenceId,
        );
      }
    }

    return { aborted: false as const };
  });

  if (result.aborted) {
    return { success: false as const, error: PROMO_ERROR_MESSAGE };
  }

  await invalidatePlanCache(userId);

  return {
    success: true as const,
    redirectUrl: "/dashboard",
  };
}

export { PROMO_ERROR_MESSAGE };
