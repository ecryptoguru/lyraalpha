/**
 * Daily token cap guards for Lyra AI service.
 * Provides atomic daily token tracking with Redis and configurable caps per plan.
 */

import { redis } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { alertIfDailyCostExceeded } from "../alerting";
import { logFireAndForgetError } from "@/lib/fire-and-forget";

const logger = createLogger({ service: "lyra-token-cap" });

// ─── Daily token spend caps (per-user, per-UTC-day) ─────────────────────
// Protects against runaway API cost from: infinite loop clients, compromised tokens,
// unusually large context requests, or prompt-injection that forces long completions.
// ENTERPRISE has a high but finite cap as a hard backstop — custom SLA still applies.
// Credits system is the primary STARTER/PRO control; this is a secondary backstop.
export const DAILY_TOKEN_CAPS_DEFAULTS: Record<string, number> = {
  STARTER:    50_000,   // ~100 SIMPLE queries at typical token counts
  PRO:       200_000,   // ~200 MODERATE queries
  ELITE:     500_000,   // ~250 COMPLEX queries
  ENTERPRISE: Number(process.env.ENTERPRISE_DAILY_TOKEN_CAP ?? 2_000_000), // ~$500/day hard ceiling
};

export const DAILY_TOKEN_CAPS_REDIS_KEY = "lyra:admin:daily_token_caps";

/** Merge hardcoded defaults with any admin-set Redis overrides.
 *  Redis values win — allows hot-patching caps without a deploy.
 *  Results are cached in-memory for 60s to avoid a Redis round-trip per request. */
let _capsCache: { value: Record<string, number>; expiresAt: number } | null = null;

export async function getEffectiveDailyTokenCaps(): Promise<Record<string, number>> {
  if (_capsCache && Date.now() < _capsCache.expiresAt) return { ..._capsCache.value };
  try {
    const overrides = await redis.hgetall(DAILY_TOKEN_CAPS_REDIS_KEY);
    if (!overrides) {
      _capsCache = { value: { ...DAILY_TOKEN_CAPS_DEFAULTS }, expiresAt: Date.now() + 60_000 };
      return { ...DAILY_TOKEN_CAPS_DEFAULTS };
    }
    const merged = { ...DAILY_TOKEN_CAPS_DEFAULTS };
    for (const [plan, val] of Object.entries(overrides)) {
      const n = Number(val);
      if (isFinite(n) && n > 0) merged[plan] = n;
    }
    _capsCache = { value: merged, expiresAt: Date.now() + 60_000 };
    return merged;
  } catch (e) {
    logger.warn({ err: sanitizeError(e) }, "getEffectiveDailyTokenCaps: Redis error — using hardcoded defaults");
    return { ...DAILY_TOKEN_CAPS_DEFAULTS };
  }
}

/** UTC date string used as the Redis key suffix — resets at midnight UTC. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "2026-03-24"
}

/** Atomically increment daily token counter using INCRBY to prevent read-modify-write races.
 *  Multiple concurrent requests each call INCRBY independently — the counter is always
 *  the true cumulative sum, not a last-write-wins value. Fire-and-forget safe. */
export async function incrementDailyTokens(userId: string, tokens: number): Promise<number> {
  try {
    // Clamp to non-negative — malformed provider usage.totalTokens could otherwise
    // decrement the counter and silently extend a user's daily budget.
    const safeTokens = Math.max(0, Math.floor(tokens));
    if (safeTokens === 0) return 0;
    const pipeline = redis.pipeline();
    pipeline.hincrby("lyra:daily_tokens_v2", `${userId}:${todayUtc()}`, safeTokens);
    pipeline.expire("lyra:daily_tokens_v2", 90_000);
    const results = await pipeline.exec();
    const newTotal = (results?.[0] as number | null) ?? 0;
    return newTotal;
  } catch (e) {
    logger.warn({ err: sanitizeError(e), userId, tokens }, "incrementDailyTokens: Redis error — token cap bypassed");
    return 0; // Redis failure must never block the response path
  }
}

/** Check whether the user has headroom remaining for this request.
 *  Reads from the same atomic hash field used by incrementDailyTokens.
 *  On Redis failure, returns 0 (allow traffic) — blocking users during Redis
 *  outages is worse than potentially exceeding the daily cap. */
export async function getDailyTokensUsed(userId: string, userPlan: string): Promise<number> {
  try {
    const field = `${userId}:${todayUtc()}`;
    const raw = await redis.hget("lyra:daily_tokens_v2", field);
    return raw ? Number(raw) : 0;
  } catch (redisError) {
    // On Redis failure, return 0 (allow traffic) instead of a percentage of the cap.
    // The daily cap is a secondary backstop; blocking users during Redis outages is worse
    // than potentially exceeding the cap. The cap will be re-evaluated on the next request
    // once Redis recovers.
    logger.warn(
      { userId, userPlan, err: sanitizeError(redisError) },
      "getDailyTokensUsed: Redis error — assuming 0 tokens used (allow traffic)",
    );
    // Fire-and-forget alert so prolonged Redis outages don't silently bypass the cap
    // for all users without any observability.
    alertIfDailyCostExceeded(0).catch((e) => logFireAndForgetError(e, "daily-tokens-redis-fallback-alert"));
    return 0;
  }
}

/** Clear the in-memory caps cache — used for testing. */
export function clearCapsCache(): void {
  _capsCache = null;
}
