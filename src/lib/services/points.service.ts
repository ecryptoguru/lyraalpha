/**
 * @internal points.service.ts — XP & Credit read helpers
 *
 * Provides backward-compatible read endpoints for the /api/points route.
 * All XP write operations should use `awardXP()` / `redeemXP()` directly
 * from `@/lib/engines/gamification`.
 */

import {
  canGenerateReferral,
  getUserProgressWithMeta,
  getRecentXPTransactions,
  XP_REDEMPTIONS
} from "@/lib/engines/gamification";
import { prisma } from "@/lib/prisma";
import { getUserCredits } from "@/lib/services/credit.service";

export { canGenerateReferral };

export async function getUserPoints(userId: string) {
  const [user, currentCredits, progress, referralAgg, referralCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { totalCreditsEarned: true },
    }),
    getUserCredits(userId),
    getUserProgressWithMeta(userId),
    prisma.creditTransaction.aggregate({
      where: { userId, type: { in: ["REFERRAL_BONUS", "REFERRAL_REDEEMED"] } },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.count({
      where: { userId, type: { in: ["REFERRAL_BONUS", "REFERRAL_REDEEMED"] } },
    }),
  ]);

  return {
    // XP data (primary)
    xp: progress.totalXp,
    level: progress.level,
    tierName: progress.tierName,
    tierEmoji: progress.tierEmoji,
    multiplier: progress.multiplier,
    progressPercent: progress.progressPercent,
    xpInCurrentLevel: progress.xpInCurrentLevel,
    xpNeededForNext: progress.xpNeededForNext,
    isMaxLevel: progress.isMaxLevel,
    badges: progress.badges,
    redemptions: progress.redemptions,
    // Credit data (still used in UI)
    credits: currentCredits,
    totalCreditsEarned: user?.totalCreditsEarned ?? 0,
    referralCreditsEarned: referralAgg._sum.amount ?? 0,
    referralCount,
  };
}

export async function getPointHistory(userId: string, limit = 20) {
  // Return XP transactions formatted in a backward-compatible shape
  const txns = await getRecentXPTransactions(userId, limit);
  return txns.map(t => ({
    id: t.id,
    amount: t.amount,
    description: t.context ?? t.action,
    createdAt: t.createdAt,
    type: "XP",
  }));
}

export function getRedemptionOptions() {
  return XP_REDEMPTIONS.map((r: { type: string; xpCost: number; creditsGranted: number; label: string; planGranted: string; trialDays: number }) => ({
    type: r.type,
    name: r.label,
    xpCost: r.xpCost,
    credits: r.creditsGranted,
    plan: r.planGranted,
    trialDays: r.trialDays,
  }));
}


