import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";

const logger = createLogger({ service: "referral" });

const REFERRAL_CREDITS = {
  REFERREE: 50,      // Credits for the person signing up
  REFERRER: 75,      // Credits for the referrer when referee activates
  ACTIVATION_THRESHOLD: 10, // Credits the referee must use to activate
};

const REFERRAL_BONUS_TIERS = [
  { minReferrals: 1, maxReferrals: 3, bonusCredits: 75, badge: "bronze" },
  { minReferrals: 4, maxReferrals: 10, bonusCredits: 100, badge: "silver" },
  { minReferrals: 11, maxReferrals: 25, bonusCredits: 150, badge: "gold" },
  { minReferrals: 26, maxReferrals: Infinity, bonusCredits: 200, badge: "platinum" },
];

export interface CreateReferralResult {
  success: boolean;
  referralCode?: string;
  referralLink?: string;
  error?: string;
}

export async function createReferralCode(userId: string): Promise<string> {
  // Check if user already has a referral code
  const existing = await prisma.referral.findFirst({
    where: { referrerId: userId },
    select: { id: true },
  });

  if (existing) {
    // Generate code from userId (use first 8 chars)
    return userId.slice(0, 8).toUpperCase();
  }

  // No referral row exists — but we don't create one here because
  // a referral requires both referrer and referee. The code is derived
  // from the userId prefix for deterministic lookup in trackReferralClick.
  return userId.slice(0, 8).toUpperCase();
}

export async function getReferralStats(userId: string) {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: {
      id: true,
      status: true,
      refereeCreditsAwarded: true,
      referrerCreditsAwarded: true,
      createdAt: true,
      activatedAt: true,
    },
  });

  const totalReferrals = referrals.length;
  const activatedReferrals = referrals.filter((r) => r.status === "ACTIVATED" || r.status === "COMPLETED").length;
  const pendingReferrals = referrals.filter((r) => r.status === "PENDING").length;

  // Calculate tier
  const tier = REFERRAL_BONUS_TIERS.find(
    (t) => totalReferrals >= t.minReferrals && totalReferrals <= t.maxReferrals
  );

  return {
    totalReferrals,
    activatedReferrals,
    pendingReferrals,
    totalCreditsEarned: activatedReferrals * REFERRAL_CREDITS.REFERRER,
    currentTier: tier?.badge || "none",
    nextTier: getNextTier(totalReferrals),
  };
}

function getNextTier(currentCount: number): { badge: string; referralsNeeded: number } | null {
  const tiers = [
    { badge: "bronze", min: 1 },
    { badge: "silver", min: 4 },
    { badge: "gold", min: 11 },
    { badge: "platinum", min: 26 },
  ];

  for (const tier of tiers) {
    if (currentCount < tier.min) {
      return { badge: tier.badge, referralsNeeded: tier.min - currentCount };
    }
  }
  return null;
}

export async function trackReferralClick(referrerCode: string): Promise<string | null> {
  // Find user by referral code (first 8 chars of their ID)
  const referrer = await prisma.user.findFirst({
    where: { id: { startsWith: referrerCode.toLowerCase() } },
    select: { id: true },
  });

  return referrer?.id || null;
}

export async function createReferral(referrerId: string, refereeId: string): Promise<CreateReferralResult> {
  try {
    // Check if referral already exists
    const existing = await prisma.referral.findUnique({
      where: {
        referrerId_refereeId: {
          referrerId,
          refereeId,
        },
      },
    });

    if (existing) {
      return { success: true, referralCode: referrerId.slice(0, 8).toUpperCase() };
    }

    // Create the referral
    await prisma.referral.create({
      data: {
        referrerId,
        refereeId,
        status: "PENDING",
      },
    });

    return {
      success: true,
      referralCode: referrerId.slice(0, 8).toUpperCase(),
    };
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to create referral");
    return { success: false, error: "Failed to create referral" };
  }
}

export async function activateReferral(refereeId: string): Promise<{ success: boolean; creditsAwarded: number }> {
  try {
    const referral = await prisma.referral.findFirst({
      where: { refereeId, status: "PENDING" },
      select: {
        id: true,
        referrerId: true,
        refereeCreditsAwarded: true,
        referrerCreditsAwarded: true,
        referrer: { select: { email: true } },
      },
    });

    if (!referral) return { success: false, creditsAwarded: 0 };

    // Verify referee exists in DB before granting credits
    const referee = await prisma.user.findUnique({
      where: { id: refereeId },
      select: { totalCreditsSpent: true },
    });

    if (!referee) {
      logger.warn({ refereeId }, "Cannot activate referral — referee not found in DB");
      return { success: false, creditsAwarded: 0 };
    }

    const thresholdMet = referee.totalCreditsSpent >= REFERRAL_CREDITS.ACTIVATION_THRESHOLD;

    // Phase 1: Award signup bonus to referee (once)
    if (!referral.refereeCreditsAwarded) {
      await prisma.$transaction(async (tx) => {
        await grantCreditsInTransaction(
          tx,
          refereeId,
          REFERRAL_CREDITS.REFERREE,
          CreditTransactionType.REFERRAL_REDEEMED,
          "Referral signup bonus",
        );
        await tx.referral.update({
          where: { id: referral.id },
          data: { refereeCreditsAwarded: true },
        });
      });
    }

    // Phase 2: Activate + award referrer bonus when threshold met (once)
    if (thresholdMet && !referral.referrerCreditsAwarded) {
      await prisma.$transaction(async (tx) => {
        await grantCreditsInTransaction(
          tx,
          referral.referrerId,
          REFERRAL_CREDITS.REFERRER,
          CreditTransactionType.REFERRAL_BONUS,
          `Referral bonus — ${referral.referrer?.email || "new user"} activated`,
          referral.id,
        );
        await tx.referral.update({
          where: { id: referral.id },
          data: {
            referrerCreditsAwarded: true,
            status: "COMPLETED",
            activatedAt: new Date(),
          },
        });
      });
    }

    return { success: true, creditsAwarded: REFERRAL_CREDITS.REFERREE };
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to activate referral");
    return { success: false, creditsAwarded: 0 };
  }
}

export function getReferralLink(referrerCode: string, baseUrl: string = "https://lyraalpha.ai"): string {
  return `${baseUrl}/ref/${referrerCode}`;
}
