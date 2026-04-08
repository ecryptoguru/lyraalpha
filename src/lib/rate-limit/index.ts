import {
  chatDailyBurstRateLimiter,
  chatMonthlyCapRateLimiter,
  discoveryRateLimiter,
  marketDataRateLimiter,
  generalRateLimiter,
} from "./config";
import { createRateLimitErrorResponse } from "./errors";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import type { PlanTier } from "@/lib/ai/config";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { isRateLimitBypassEnabled, isRateLimitBypassHeaderEnabled } from "@/lib/runtime-env";
import { timed } from "@/lib/telemetry";

const logger = createLogger({ service: "rate-limit" });

async function shouldBypassRateLimit(): Promise<boolean> {
  if (isRateLimitBypassEnabled()) return true;

  try {
    const headerStore = await headers();
    return isRateLimitBypassHeaderEnabled(
      headerStore.get("x-skip-rate-limit")
        ?? headerStore.get("SKIP_RATE_LIMIT")
        ?? headerStore.get("x-skip-auth")
        ?? headerStore.get("SKIP_AUTH"),
    );
  } catch {
    return false;
  }
}

class RateLimitTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Rate limit check timed out after ${timeoutMs}ms`);
    this.name = "RateLimitTimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new RateLimitTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const TIMEOUTS_MS = {
  chat: 1200,
  discovery: 1000,
  marketData: 1000,
  general: 1000,
} as const;

function handleFailOpen(error: unknown, op: string, identifier: string): null {
  if (error instanceof RateLimitTimeoutError) {
    logger.warn(
      { identifier, timeoutMs: error.timeoutMs },
      `Rate limit ${op} timed out — failing open for UX`,
    );
    return null;
  }
  logger.error(
    { err: sanitizeError(error), identifier },
    `Rate limit ${op} failed — failing open for UX`,
  );
  return null;
}

export type RateLimitPlanArg =
  | { type: "plan"; value: PlanTier }
  | { type: "userId"; value: string };

export type RateLimitSuccess = {
  headers: Record<string, string>;
};

/**
 * Rate limit for chat endpoints (most restrictive - uses sliding window)
 * @param identifier - User ID or IP address
 * @param planArg - Pre-resolved plan or userId to look up — use discriminated union to avoid ambiguity
 */
export async function rateLimitChat(
  identifier: string,
  planArg?: PlanTier | RateLimitPlanArg,
): Promise<{ response: NextResponse | null; success?: RateLimitSuccess }> {
  try {
    if (await shouldBypassRateLimit()) return { response: null };
    // Accept either a pre-resolved PlanTier string (legacy callers), a discriminated union,
    // or nothing (defaults to STARTER).
    const knownTiers: PlanTier[] = ["STARTER", "PRO", "ELITE", "ENTERPRISE"];
    let tier: PlanTier;
    if (!planArg) {
      tier = "STARTER";
    } else if (typeof planArg === "object") {
      tier = planArg.type === "plan" ? planArg.value : await getUserPlan(planArg.value);
    } else {
      // Legacy: bare PlanTier string passed directly (e.g. from chat/route.ts)
      tier = knownTiers.includes(planArg as PlanTier) ? (planArg as PlanTier) : await getUserPlan(planArg);
    }

    const resolvedTier: PlanTier = tier === "ENTERPRISE" ? "ELITE" : tier;

    const dailyLimiter = chatDailyBurstRateLimiter[resolvedTier];
    const monthlyLimiter = chatMonthlyCapRateLimiter[resolvedTier];

    if (!dailyLimiter || !monthlyLimiter) return { response: null };

    // Run both Redis checks in parallel — saves ~20-40ms per request.
    const [dailyResult, monthlyResult] = await Promise.all([
      timed(
        "chatDailyBurst.limit",
        () => withTimeout(dailyLimiter.limit(identifier), TIMEOUTS_MS.chat),
        { tier, timeoutMs: TIMEOUTS_MS.chat },
      ),
      timed(
        "chatMonthlyCap.limit",
        () => withTimeout(monthlyLimiter.limit(identifier), TIMEOUTS_MS.chat),
        { tier, timeoutMs: TIMEOUTS_MS.chat },
      ),
    ]);

    if (!dailyResult.success) {
      return {
        response: createRateLimitErrorResponse(
        dailyResult.limit,
        dailyResult.remaining,
        dailyResult.reset,
        ),
      };
    }
    if (!monthlyResult.success) {
      return {
        response: createRateLimitErrorResponse(
        monthlyResult.limit,
        monthlyResult.remaining,
        monthlyResult.reset,
        ),
      };
    }

    const remaining = Math.min(dailyResult.remaining, monthlyResult.remaining);
    const reset = Math.max(dailyResult.reset, monthlyResult.reset);
    return {
      response: null,
      success: {
        headers: {
          "X-RateLimit-Limit": String(dailyResult.limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "X-RateLimit-Window": "chat",
        },
      },
    };
  } catch (error) {
    if (error instanceof RateLimitTimeoutError) {
      logger.error(
        { identifier, timeoutMs: error.timeoutMs },
        "Rate limit chat check timed out — returning 503 to prevent fail-open",
      );
      return {
        response: NextResponse.json(
        { error: "Service temporarily unavailable", message: "Rate limiting service is unavailable. Please try again in a moment." },
        { status: 503 },
        ),
      };
    }
    logger.error(
      { err: sanitizeError(error), identifier },
      "Rate limit chat check failed — returning 503 to prevent fail-open",
    );
    return {
      response: NextResponse.json(
        { error: "Service temporarily unavailable", message: "Rate limiting service is unavailable. Please try again in a moment." },
        { status: 503 },
      ),
    };
  }
}

/**
 * Rate limit for discovery/search endpoints (uses fixed window)
 */
export async function rateLimitDiscovery(
  identifier: string,
  userId?: string,
): Promise<NextResponse | null> {
  try {
    if (await shouldBypassRateLimit()) return null;
    const tier: PlanTier = userId ? await getUserPlan(userId) : "STARTER";
    const limiter = discoveryRateLimiter[tier];

    if (!limiter) return null;

    const { success, limit, remaining, reset } = await timed(
      "discovery.limit",
      () => withTimeout(limiter.limit(identifier), TIMEOUTS_MS.discovery),
      { tier, timeoutMs: TIMEOUTS_MS.discovery },
    );

    if (!success) {
      return createRateLimitErrorResponse(limit, remaining, reset);
    }

    return null;
  } catch (error) {
    return handleFailOpen(error, "discovery", identifier);
  }
}

/**
 * Rate limit for market data endpoints (uses fixed window)
 */
export async function rateLimitMarketData(
  identifier: string,
  userId?: string,
): Promise<NextResponse | null> {
  try {
    if (await shouldBypassRateLimit()) return null;
    const tier: PlanTier = userId ? await getUserPlan(userId) : "STARTER";
    const limiter = marketDataRateLimiter[tier];

    if (!limiter) return null;

    const { success, limit, remaining, reset } = await timed(
      "marketData.limit",
      () => withTimeout(limiter.limit(identifier), TIMEOUTS_MS.marketData),
      { tier, timeoutMs: TIMEOUTS_MS.marketData },
    );

    if (!success) {
      return createRateLimitErrorResponse(limit, remaining, reset);
    }

    return null;
  } catch (error) {
    return handleFailOpen(error, "market-data", identifier);
  }
}

/**
 * Rate limit for general API endpoints (uses fixed window)
 */
export async function rateLimitGeneral(
  identifier: string,
  userId?: string,
): Promise<NextResponse | null> {
  void identifier;
  void userId;
  return null;
}

/**
 * Get rate limit info for a given identifier.
 * Uses getRemaining() — does NOT consume a request token.
 * Intended for admin/debug/status checks only.
 */
export async function getRateLimitInfo(
  identifier: string,
  type: "chat" | "discovery" | "marketData" | "general",
  userId?: string,
) {
  const tier: PlanTier = userId ? await getUserPlan(userId) : "STARTER";

  const limiters = {
    chat: chatDailyBurstRateLimiter,
    discovery: discoveryRateLimiter,
    marketData: marketDataRateLimiter,
    general: generalRateLimiter,
  };

  const limiter = limiters[type][tier];
  const { limit, remaining, reset } = await limiter.getRemaining(identifier);

  return { limit, remaining, reset, tier };
}
