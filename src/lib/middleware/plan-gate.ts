/**
 * Plan-Aware API Response Gating — Phase 2.5
 *
 * Utility for API routes to check user plan and return gated responses.
 * Usage:
 *   const plan = await getUserPlan(userId);
 *   const limit = getPlanLimit(plan, "discovery_feed");
 */

import { prisma } from "@/lib/prisma";
import type { PlanTier } from "@/lib/ai/config";
import { normalizePlanTier } from "@/lib/utils/plan";
import { createLogger } from "@/lib/logger";
import { withStaleWhileRevalidate, delCache } from "@/lib/redis";
import { isPrivilegedEmail } from "@/lib/auth";

const logger = createLogger({ service: "plan-gate" });

/** Re-export for backward compatibility — implementation lives in @/lib/utils/plan */
export { normalizePlanTier };

// ─── Feature Limits by Plan ─────────────────────────────────────────────────

export type EliteFeature =
  | "discovery_feed"
  | "portfolio_lookthrough"
  | "crypto_onchain"
  | "macro_intelligence"
  | "learning_modules"
  | "macro_correlations"
  | "xp_multiplier"
  | "portfolio_count";

const PLAN_LIMITS: Record<EliteFeature, Record<PlanTier, number>> = {
  discovery_feed:          { STARTER: 5,  PRO: 15, ELITE: 100, ENTERPRISE: 100 },
  portfolio_lookthrough:   { STARTER: 1,  PRO: 1,  ELITE: 3,   ENTERPRISE: 3 },   // 0=basic, 1=holdings+sectors, 3=full
  crypto_onchain:          { STARTER: 1,  PRO: 1,  ELITE: 3,   ENTERPRISE: 3 },
  macro_intelligence:      { STARTER: 1,  PRO: 1,  ELITE: 3,   ENTERPRISE: 3 },
  learning_modules:        { STARTER: 1,  PRO: 2,  ELITE: 3,   ENTERPRISE: 3 },   // 1=fundamentals, 2=+intermediate, 3=all
  macro_correlations:      { STARTER: 0,  PRO: 3,  ELITE: 10,  ENTERPRISE: 10 },  // number of correlations shown
  xp_multiplier:           { STARTER: 1,  PRO: 1.25, ELITE: 1.5, ENTERPRISE: 1.5 },
  portfolio_count:         { STARTER: 1,  PRO: 3,  ELITE: 20,  ENTERPRISE: 20 },
};

/** Get the numeric limit for a feature based on user plan */
export function getPlanLimit(plan: PlanTier, feature: EliteFeature): number {
  return PLAN_LIMITS[feature]?.[plan] ?? PLAN_LIMITS[feature]?.STARTER ?? 0;
}

/** Alias to clarify level-based checks in call sites */
export function getFeatureLevel(plan: PlanTier, feature: EliteFeature): number {
  return getPlanLimit(plan, feature);
}

/** Elite-equivalent plans (full depth features) */
export function isElitePlan(plan: PlanTier): boolean {
  return plan === "ELITE" || plan === "ENTERPRISE";
}



/** Region access policy: Starter/Pro limited to IN+US, Elite/Enterprise all */
export function canAccessRegion(plan: PlanTier, region?: string | null): boolean {
  if (!region) return true;
  if (isElitePlan(plan)) return true;
  const normalized = region.toUpperCase();
  return normalized === "US" || normalized === "IN";
}

/** Check if a feature is fully unlocked for the given plan */
export function isFeatureUnlocked(plan: PlanTier): boolean {
  return isElitePlan(plan);
}

/** Check if user has at least partial access to a feature */
export function hasFeatureAccess(plan: PlanTier, feature: EliteFeature): boolean {
  return getPlanLimit(plan, feature) > 0;
}

// ─── User Plan Resolver (Direct DB) ─────────────────────────────────────────

/** Fetch user plan directly from DB. Returns STARTER as fallback. */
export async function getUserPlan(userId: string): Promise<PlanTier> {
  // Audit/test override: LYRA_AUDIT_PLAN=STARTER|PRO|ELITE|ENTERPRISE bypasses DB lookup.
  // Only allowed in development/test — never in any Vercel environment (production or preview).
  if (process.env.LYRA_AUDIT_PLAN &&
      process.env.NODE_ENV !== "production" &&
      !process.env.VERCEL_ENV) {
    return normalizePlanTier(process.env.LYRA_AUDIT_PLAN);
  }

  const PLAN_CACHE_ENABLED = process.env.PLAN_CACHE_ENABLED === "true";
  if (PLAN_CACHE_ENABLED) {
    const cacheKey = `plan:${userId}`;
    const cached = await withStaleWhileRevalidate<PlanTier>({
      key: cacheKey,
      ttlSeconds: 300,
      staleSeconds: 600,
      fetcher: async () => fetchUserPlanFromDb(userId),
      onRefreshError: (e) => {
        logger.warn({ userId, err: e }, "Plan cache refresh failed");
      },
    });
    if (cached) return cached;
  }

  try {
    return await fetchUserPlanFromDb(userId);
  } catch {
    return "STARTER";
  }
}

async function fetchUserPlanFromDb(userId: string): Promise<PlanTier> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        plan: true,
        trialEndsAt: true,
        subscriptions: {
          where: { status: "ACTIVE", plan: { not: "STARTER" } },
          select: { plan: true },
          take: 1,
        },
      },
    });

    if (!user) {
      logger.warn({ userId }, "User not found in DB - returning STARTER");
      return "STARTER";
    }

    let plan = normalizePlanTier(user?.plan as string | null | undefined);
    const hasActiveTrial = Boolean(user?.trialEndsAt && user.trialEndsAt > new Date());
    const hasExpiredTrial = Boolean(user?.trialEndsAt && user.trialEndsAt < new Date());
    const hasActivePaidSubscription = Boolean(user?.subscriptions?.length);
    const isAdmin = isPrivilegedEmail(user?.email);

    if (isAdmin) {
      return "ELITE";
    }

    // Only downgrade if the user had an explicit time-limited trial that has now expired.
    // Permanently-granted plans (trialEndsAt = null, no subscription) are trusted as-is.
    if (hasExpiredTrial && plan !== "STARTER") {
      ({ plan } = await expireTrialIfNeeded(userId, plan, user?.trialEndsAt ?? null));
    }

    if (hasActiveTrial && plan === "STARTER") {
      return "PRO";
    }

    if (hasActivePaidSubscription && plan === "STARTER") {
      return "PRO";
    }

    return plan;
  } catch (error) {
    logger.error({ userId, err: error }, "fetchUserPlanFromDb failed");
    throw error;
  }
}

/**
 * Expire a user's trial if it has passed and they haven't yet been downgraded.
 * Persists the downgrade to DB and busts the plan cache atomically.
 * Call this from any code-path that reads plan data, so expiry is consistent.
 */
export async function expireTrialIfNeeded(
  userId: string,
  currentPlan: PlanTier,
  trialEndsAt: Date | null,
): Promise<{ plan: PlanTier; trialEndsAt: Date | null }> {
  if (!trialEndsAt || trialEndsAt >= new Date() || currentPlan === "STARTER") {
    return { plan: currentPlan, trialEndsAt };
  }
  try {
    // Invalidate cache BEFORE the DB update to prevent stale ELITE reads
    // during the window between DB write and cache invalidation
    await delCache(`plan:${userId}`);
    await prisma.user.update({ where: { id: userId }, data: { plan: "STARTER", trialEndsAt: null } });
  } catch (err) {
    logger.warn({ userId, err }, "Failed to persist trial expiry downgrade");
  }
  return { plan: "STARTER", trialEndsAt: null };
}

/** Bust the Redis plan cache for a user — call this in Stripe/Clerk webhooks after plan changes. */
/** Clear plan cache for all users — used in test teardown. No-op when cache is disabled. */
export async function _clearPlanCacheForTest(): Promise<void> {
  if (process.env.PLAN_CACHE_ENABLED !== "true") return;
  try {
    // Reset the memoized admin allowlist so tests get fresh env values
    const { delCache } = await import("@/lib/redis");
    // Delete all plan:* keys using a scan pattern
    // For test teardown, we just invalidate the known key pattern
    await delCache("plan:*");
  } catch {
    // Non-fatal — tests don't depend on cache being cleared
  }
}

export async function invalidatePlanCache(userId: string): Promise<void> {
  if (process.env.PLAN_CACHE_ENABLED !== "true") return;
  try {
    await delCache(`plan:${userId}`);
    logger.info({ userId }, "Plan cache invalidated");
  } catch (e) {
    logger.warn({ userId, err: e }, "Plan cache invalidation failed — will expire naturally");
  }
}


// ─── Gated Response Helper ──────────────────────────────────────────────────

export interface GatedResponse<T> {
  data: T;
  plan: PlanTier;
  gated: boolean;
  upgradeHint?: string;
}

/** Wrap API data with plan gating metadata */
export function gateResponse<T>(
  data: T,
  plan: PlanTier,
  feature: EliteFeature,
  upgradeHint?: string,
): GatedResponse<T> {
  const gated = !hasFeatureAccess(plan, feature);
  return {
    data,
    plan,
    gated,
    upgradeHint: gated ? (upgradeHint ?? `Upgrade to Elite for full ${feature.replace(/_/g, " ")} access`) : undefined,
  };
}
