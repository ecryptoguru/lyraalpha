import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { XPRedemptionType } from "@/generated/prisma/client";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";

const logger = createLogger({ service: "gamification" });

// ─── XP Action Definitions ───────────────────────────────────────────────────
export type XPAction =
  | "explain_score"
  | "complete_module"
  | "complete_path"
  | "discovery_explore"
  | "lyra_question"
  | "weekly_streak"
  | "daily_login"
  | "quiz_pass"
  | "watchlist_add"
  | "share_analysis"
  | "referral_success"  // 0 XP — referrals reward Credits directly
  | "first_purchase";

interface XPActionConfig {
  amount: number;
  dailyCap: number; // 0 = no cap
  description: string;
}

const XP_ACTIONS: Record<XPAction, XPActionConfig> = {
  explain_score:    { amount: 5,   dailyCap: 10, description: "Tap 'Explain this score'" },
  complete_module:  { amount: 25,  dailyCap: 3,  description: "Complete a learning module" },
  complete_path:    { amount: 50,  dailyCap: 1,  description: "Complete a curated learning path" },
  discovery_explore:{ amount: 5,   dailyCap: 15, description: "Explore a discovery card" },
  lyra_question:    { amount: 5,   dailyCap: 10, description: "Ask Lyra an analytical question" },
  weekly_streak:    { amount: 50,  dailyCap: 1,  description: "Complete weekly streak (7 consecutive days)" },
  daily_login:      { amount: 5,   dailyCap: 1,  description: "Daily login bonus" },
  quiz_pass:        { amount: 20,  dailyCap: 3,  description: "Pass a learning quiz" },
  watchlist_add:    { amount: 5,   dailyCap: 5,  description: "Add asset to watchlist" },
  share_analysis:   { amount: 5,   dailyCap: 3,  description: "Share an asset analysis" },
  referral_success: { amount: 0,   dailyCap: 3,  description: "Successful referral (credited via Credits, not XP)" },
  first_purchase:   { amount: 100, dailyCap: 1,  description: "First credit pack purchase" },
};

// ─── Level Thresholds (30 levels) ────────────────────────────────────────────
// Level 1-5:   0-500 XP   (Beginner)
// Level 6-10:  500-2000 XP (Explorer)
// Level 11-15: 2000-5000 XP (Analyst)
// Level 16-20: 5000-12000 XP (Strategist)
// Level 21-25: 12000-25000 XP (Expert)
// Level 26-30: 25000-50000 XP (Master)

const LEVEL_THRESHOLDS: number[] = [
  // Beginner (1-5)
  0, 100, 200, 350, 500,
  // Explorer (6-10)
  750, 1000, 1300, 1650, 2000,
  // Analyst (11-15)
  2500, 3000, 3600, 4300, 5000,
  // Strategist (16-20)
  6000, 7200, 8600, 10200, 12000,
  // Expert (21-25)
  14000, 16500, 19500, 22500, 25000,
  // Master (26-30)
  28000, 32000, 37000, 43000, 50000,
];

const MAX_LEVEL = 30;

// ─── Tier Configuration ───────────────────────────────────────────────────────
interface TierConfig {
  name: string;
  badge: string;
  emoji: string;
  minLevel: number;
  maxLevel: number;
  multiplier: number;
  // Badge slug stored in UserBadge table
  badgeSlug: string;
}

const TIER_CONFIGS: TierConfig[] = [
  { name: "Beginner",   badge: "tier_beginner",   badgeSlug: "tier_beginner",   emoji: "🌱", minLevel: 1,  maxLevel: 5,  multiplier: 1.0 },
  { name: "Explorer",   badge: "tier_explorer",   badgeSlug: "tier_explorer",   emoji: "🔭", minLevel: 6,  maxLevel: 10, multiplier: 1.1 },
  { name: "Analyst",    badge: "tier_analyst",    badgeSlug: "tier_analyst",    emoji: "⚡", minLevel: 11, maxLevel: 15, multiplier: 1.25 },
  { name: "Strategist", badge: "tier_strategist", badgeSlug: "tier_strategist", emoji: "🎯", minLevel: 16, maxLevel: 20, multiplier: 1.4 },
  { name: "Expert",     badge: "tier_expert",     badgeSlug: "tier_expert",     emoji: "🏆", minLevel: 21, maxLevel: 25, multiplier: 1.5 },
  { name: "Master",     badge: "tier_master",     badgeSlug: "tier_master",     emoji: "👑", minLevel: 26, maxLevel: 30, multiplier: 1.6 },
];

// ─── XP Redemption Config ─────────────────────────────────────────────────────
export interface XPRedemptionConfig {
  type: XPRedemptionType;
  xpCost: number;
  creditsGranted: number;
  planGranted: string;   // plan tier to activate trial for
  trialDays: number;
  label: string;
  description: string;
}

export const XP_REDEMPTIONS: XPRedemptionConfig[] = [
  {
    type: "PRO_TRIAL_7D_WITH_CREDITS",
    xpCost: 500,
    creditsGranted: 50,
    planGranted: "PRO",
    trialDays: 0,
    label: "PRO Credit Bundle — 50 Credits",
    description: "Redeem 500 XP for 50 bonus credits deposited instantly",
  },
  {
    type: "ELITE_TRIAL_7D_WITH_CREDITS",
    xpCost: 1000,
    creditsGranted: 125,
    planGranted: "ELITE",
    trialDays: 0,
    label: "ELITE Credit Bundle — 125 Credits",
    description: "Redeem 1000 XP for 125 bonus credits deposited instantly",
  },
];

// ─── Public Utility Functions ─────────────────────────────────────────────────

/** Compute level (1-30) from total XP */
export function computeLevel(totalXp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      return Math.min(i + 1, MAX_LEVEL);
    }
  }
  return 1;
}

/** XP required to reach the current level threshold */
export function xpForCurrentLevel(level: number): number {
  if (level <= 1) return 0;
  return LEVEL_THRESHOLDS[level - 1];
}

/** XP required to reach the next level (0 = max level) */
export function xpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return LEVEL_THRESHOLDS[level];
}

/** Get the full tier config for a given level */
export function getTierConfig(level: number): TierConfig {
  return TIER_CONFIGS.find(t => level >= t.minLevel && level <= t.maxLevel) ?? TIER_CONFIGS[0];
}

/** Get just the tier name for a level (backwards-compat) */
export function getTierName(level: number): string {
  return getTierConfig(level).name;
}

/** Get the XP multiplier for a given level */
export function getXPMultiplierForLevel(level: number): number {
  return getTierConfig(level).multiplier;
}

/** True if this level is the first level of a new tier (badge award trigger) */
export function isTierEntryLevel(level: number): boolean {
  return TIER_CONFIGS.some(t => t.minLevel === level);
}

/** Get XP action config (for UI display) */
export function getXPActionConfig(action: XPAction): XPActionConfig {
  return XP_ACTIONS[action];
}

/** Get all XP action configs */
export function getAllXPActions(): Record<XPAction, XPActionConfig> {
  return { ...XP_ACTIONS };
}

// ─── Public Return Types ───────────────────────────────────────────────────────

export interface AwardXPResult {
  awarded: boolean;
  amount: number;
  reason?: string;
  newTotalXp: number;
  newLevel: number;
  previousLevel: number;
  leveledUp: boolean;
  newTierUnlocked: boolean; // true if a new tier badge was earned
  tierName: string;
  tierEmoji: string;
  streakUpdated: boolean;
  newStreak: number;
}

export interface XPRedemptionResult {
  success: boolean;
  insufficientXp?: boolean;
  creditsAdded?: number;
  planGranted?: string;
  newTotalXp?: number;
  error?: string;
}

// ─── Award XP ─────────────────────────────────────────────────────────────────

/** Award XP to a user for a specific action */
export async function awardXP(
  userId: string,
  action: XPAction,
  context?: string,
): Promise<AwardXPResult> {
  const config = XP_ACTIONS[action];
  if (!config) {
    return {
      awarded: false, amount: 0, reason: `Unknown action: ${action}`,
      newTotalXp: 0, newLevel: 1, previousLevel: 1,
      leveledUp: false, newTierUnlocked: false, tierName: "Beginner", tierEmoji: "🌱",
      streakUpdated: false, newStreak: 0,
    };
  }

  // 0-XP actions (e.g., referral_success) are no-ops — they exist for logging only
  if (config.amount === 0) {
    const progress = await getOrCreateProgress(userId);
    return {
      awarded: false, amount: 0, reason: "Action awards Credits, not XP",
      newTotalXp: progress.totalXp, newLevel: progress.level, previousLevel: progress.level,
      leveledUp: false, newTierUnlocked: false,
      tierName: getTierName(progress.level), tierEmoji: getTierConfig(progress.level).emoji,
      streakUpdated: false, newStreak: progress.streak,
    };
  }

  return prisma.$transaction(async (tx) => {
    // Check daily cap
    if (config.dailyCap > 0) {
      const todayStart = startOfDay(new Date());
      const todayCount = await tx.xPTransaction.count({
        where: { userId, action, createdAt: { gte: todayStart } },
      });
      if (todayCount >= config.dailyCap) {
        const progress = await getOrCreateProgress(userId, tx);
        return {
          awarded: false, amount: 0,
          reason: `Daily cap reached (${todayCount}/${config.dailyCap})`,
          newTotalXp: progress.totalXp, newLevel: progress.level, previousLevel: progress.level,
          leveledUp: false, newTierUnlocked: false,
          tierName: getTierName(progress.level), tierEmoji: getTierConfig(progress.level).emoji,
          streakUpdated: false, newStreak: progress.streak,
        };
      }
    }

    const progress = await getOrCreateProgress(userId, tx);
    const previousLevel = progress.level;

    // Apply level-based XP multiplier
    const multiplier = getXPMultiplierForLevel(previousLevel);
    const amount = Math.round(config.amount * multiplier);

    const newTotalXp = progress.totalXp + amount;
    const newLevel = computeLevel(newTotalXp);
    const leveledUp = newLevel > previousLevel;
    const newTierUnlocked = leveledUp && isTierEntryLevel(newLevel);
    const newTierConfig = getTierConfig(newLevel);
    const newXpMultiplier = newTierConfig.multiplier;

    // Streak logic
    const today = startOfDay(new Date());
    const lastActive = progress.lastActiveDate ? startOfDay(progress.lastActiveDate) : null;
    const isConsecutiveDay = lastActive && daysDiff(lastActive, today) === 1;
    const isSameDay = lastActive && daysDiff(lastActive, today) === 0;
    let newStreak = progress.streak;
    let streakUpdated = false;

    if (!isSameDay) {
      if (isConsecutiveDay) {
        newStreak = progress.streak + 1;
        streakUpdated = true;
      } else if (!lastActive || daysDiff(lastActive, today) > 1) {
        newStreak = 1;
        streakUpdated = true;
      }
    }

    // Weekly XP tracking
    let weeklyXp = progress.weeklyXp + amount;
    let weeklyResetAt = progress.weeklyResetAt;
    if (!weeklyResetAt || new Date() >= weeklyResetAt) {
      weeklyXp = amount;
      weeklyResetAt = nextMonday();
    }

    // Persist atomically
    await tx.xPTransaction.create({ data: { userId, amount, action, context } });
    await tx.userProgress.update({
      where: { userId },
      data: {
        totalXp: newTotalXp,
        level: newLevel,
        streak: newStreak,
        lastActiveDate: new Date(),
        weeklyXp,
        weeklyResetAt,
        xpMultiplier: newXpMultiplier,
      },
    });

    // Auto-award tier badge when entering a new tier
    if (newTierUnlocked) {
      await tx.userBadge.upsert({
        where: { userId_badgeSlug: { userId, badgeSlug: newTierConfig.badge } },
        update: {},
        create: {
          userId,
          badgeSlug: newTierConfig.badge,
          metadata: { tierName: newTierConfig.name, level: newLevel, emoji: newTierConfig.emoji },
        },
      });
      logger.info({ userId, tier: newTierConfig.name, level: newLevel }, "Tier badge awarded");
    }

    logger.info(
      { userId, action, amount, multiplier, newTotalXp, newLevel, leveledUp, streak: newStreak },
      "XP awarded",
    );

    return {
      awarded: true,
      amount,
      newTotalXp,
      newLevel,
      previousLevel,
      leveledUp,
      newTierUnlocked,
      tierName: newTierConfig.name,
      tierEmoji: newTierConfig.emoji,
      streakUpdated,
      newStreak,
    };
  });
}

// ─── Redeem XP ────────────────────────────────────────────────────────────────

/** Redeem XP for a repeatable XP-to-credits bundle. */
export async function redeemXP(
  userId: string,
  type: XPRedemptionType,
): Promise<XPRedemptionResult> {
  const redemption = XP_REDEMPTIONS.find(r => r.type === type);
  if (!redemption) {
    return { success: false, error: "Invalid redemption type" };
  }

  return prisma.$transaction(async (tx) => {
    // XP balance check
    const progress = await getOrCreateProgress(userId, tx);
    if (progress.totalXp < redemption.xpCost) {
      return { success: false, insufficientXp: true };
    }

    const newTotalXp = progress.totalXp - redemption.xpCost;

    // Deduct XP
    await tx.userProgress.update({
      where: { userId },
      data: { totalXp: newTotalXp, level: computeLevel(newTotalXp) },
    });

    // Record redemption history for analytics and UX state
    await tx.xPRedemption.create({
      data: {
        userId,
        type,
        xpCost: redemption.xpCost,
        creditsGranted: redemption.creditsGranted,
        description: redemption.label,
      },
    });

    // Grant credits
    if (redemption.creditsGranted > 0) {
      await grantCreditsInTransaction(
        tx,
        userId,
        redemption.creditsGranted,
        "BONUS" as never,
        `XP Redemption: ${redemption.label}`,
      );
    }

    // Grant plan metadata (repeatable bundles currently only deposit credits)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + redemption.trialDays);
    await tx.user.update({
      where: { id: userId },
      data: { plan: redemption.planGranted as "PRO" | "ELITE", trialEndsAt },
    });

    logger.info({ userId, type, xpCost: redemption.xpCost, creditsGranted: redemption.creditsGranted, plan: redemption.planGranted }, "XP redeemed");

    return {
      success: true,
      creditsAdded: redemption.creditsGranted,
      planGranted: redemption.planGranted,
      newTotalXp,
    };
  });
}

// ─── Progress Helpers ─────────────────────────────────────────────────────────

/** Get or create user progress record */
export async function getOrCreateProgress(
  userId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const db = tx ?? prisma;
  const existing = await db.userProgress.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.userProgress.create({ data: { userId } });
}

/** Get user progress with computed display fields */
export async function getUserProgressWithMeta(userId: string) {
  const progress = await getOrCreateProgress(userId);
  const level = progress.level;
  const tier = getTierConfig(level);
  const currentLevelXp = xpForCurrentLevel(level);
  const nextLevelXp = xpForNextLevel(level);
  const xpInCurrentLevel = progress.totalXp - currentLevelXp;
  const xpNeededForNext = nextLevelXp > 0 ? nextLevelXp - currentLevelXp : 0;
  const progressPercent = xpNeededForNext > 0
    ? Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100))
    : 100;

  // Load tier badges earned
  const [badges, earnedRedemptions] = await Promise.all([
    prisma.userBadge.findMany({
      where: { userId, badgeSlug: { startsWith: "tier_" } },
      orderBy: { earnedAt: "asc" },
    }),
    prisma.xPRedemption.findMany({
      where: { userId },
      select: { type: true },
    }),
  ]);

  const redeemedTypes = new Set(earnedRedemptions.map((redemption) => redemption.type));

  return {
    ...progress,
    tierName: tier.name,
    tierEmoji: tier.emoji,
    tierBadgeSlug: tier.badge,
    multiplier: tier.multiplier,
    currentLevelXp,
    nextLevelXp,
    xpInCurrentLevel,
    xpNeededForNext,
    progressPercent,
    isMaxLevel: level >= MAX_LEVEL,
    badges,
    redemptions: XP_REDEMPTIONS.map(r => ({
      ...r,
      alreadyRedeemed: redeemedTypes.has(r.type),
    })),
  };
}

/** Check and award weekly streak bonus if eligible */
export async function checkWeeklyStreak(userId: string): Promise<AwardXPResult | null> {
  const progress = await getOrCreateProgress(userId);
  if (progress.streak > 0 && progress.streak % 7 === 0) {
    const todayStart = startOfDay(new Date());
    const alreadyAwarded = await prisma.xPTransaction.findFirst({
      where: { userId, action: "weekly_streak", createdAt: { gte: todayStart } },
    });
    if (alreadyAwarded) return null;
    return awardXP(userId, "weekly_streak", `${progress.streak}-day streak milestone`);
  }
  return null;
}

/** Get recent XP transactions for a user */
export async function getRecentXPTransactions(userId: string, limit = 20) {
  return prisma.xPTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Referral Eligibility ─────────────────────────────────────────────────────

/**
 * Only PAID (non-trial) Pro and Elite users can generate referral codes.
 * Checks for an ACTIVE subscription (not TRIALING) with plan PRO or ELITE.
 */
export async function canGenerateReferral(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      trialEndsAt: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        select: { plan: true, status: true },
        take: 1,
      },
    },
  });

  if (!user) return false;

  // Must be PRO or ELITE plan (not STARTER)
  if (user.plan !== "PRO" && user.plan !== "ELITE") return false;

  // If trialEndsAt is set and in the future → this is a trial, not a paid subscriber
  if (user.trialEndsAt && user.trialEndsAt > new Date()) return false;

  // Must have at least one ACTIVE (not TRIALING) subscription for PRO or ELITE
  const hasPaidSub = user.subscriptions.some(
    s => s.status === "ACTIVE" && (s.plan === "PRO" || s.plan === "ELITE"),
  );

  return hasPaidSub;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function nextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}
