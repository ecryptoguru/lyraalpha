import { Ratelimit } from "@upstash/ratelimit";
import { redis as sharedRedisClient } from "@/lib/redis";
import type { PlanTier } from "@/lib/ai/config";

const redis = sharedRedisClient;

// ─── Rate Limit Config (Single Source of Truth) ─────────────────────────────

type Duration = `${number}${"s" | "m" | "h" | "d"}`;
type TierLimits = Record<PlanTier, { requests: number; window: Duration }>;

const RATE_LIMIT_CONFIG = {
  chatDailyBurst: {
    STARTER:    { requests: 60,   window: "1d" as Duration },
    PRO:        { requests: 120,  window: "1d" as Duration },
    ELITE:      { requests: 300,  window: "1d" as Duration },
    ENTERPRISE: { requests: 1200, window: "1d" as Duration },
  },
  chatMonthlyCap: {
    STARTER:    { requests: 1000,  window: "30d" as Duration },
    PRO:        { requests: 4000,  window: "30d" as Duration },
    ELITE:      { requests: 12000, window: "30d" as Duration },
    ENTERPRISE: { requests: 50000, window: "30d" as Duration },
  },
  discovery: {
    STARTER:    { requests: 200,   window: "1h" as Duration },
    PRO:        { requests: 500,   window: "1h" as Duration },
    ELITE:      { requests: 2000,  window: "1h" as Duration },
    ENTERPRISE: { requests: 8000, window: "1h" as Duration },
  },
  marketdata: {
    STARTER:    { requests: 500,   window: "1h" as Duration },
    PRO:        { requests: 2000,  window: "1h" as Duration },
    ELITE:      { requests: 8000,  window: "1h" as Duration },
    ENTERPRISE: { requests: 32000, window: "1h" as Duration },
  },
  general: {
    STARTER:    { requests: 1000,  window: "1h" as Duration },
    PRO:        { requests: 5000,  window: "1h" as Duration },
    ELITE:      { requests: 20000, window: "1h" as Duration },
    ENTERPRISE: { requests: 80000, window: "1h" as Duration },
  },
} as const satisfies Record<string, TierLimits>;

export { RATE_LIMIT_CONFIG };

// ─── Factory: Generate Ratelimit instances from config ──────────────────────

type TierRateLimiters = Record<PlanTier, Ratelimit>;

const RATE_LIMIT_ANALYTICS_ENABLED: Partial<Record<keyof typeof RATE_LIMIT_CONFIG, boolean>> = {
  chatDailyBurst: true,
  chatMonthlyCap: true,
  discovery: true,
  marketdata: false,
  general: false,
};

const SLIDING_WINDOW_ENDPOINTS = new Set<keyof typeof RATE_LIMIT_CONFIG>(["chatDailyBurst", "chatMonthlyCap"]);

function buildLimiters(endpoint: keyof typeof RATE_LIMIT_CONFIG): TierRateLimiters {
  const tiers: PlanTier[] = ["STARTER", "PRO", "ELITE", "ENTERPRISE"];
  const result = {} as TierRateLimiters;

  const analyticsEnabled = RATE_LIMIT_ANALYTICS_ENABLED[endpoint] ?? true;
  const useSlidingWindow = SLIDING_WINDOW_ENDPOINTS.has(endpoint);

  for (const tier of tiers) {
    const { requests, window } = RATE_LIMIT_CONFIG[endpoint][tier];
    result[tier] = new Ratelimit({
      redis,
      limiter: useSlidingWindow
        ? Ratelimit.slidingWindow(requests, window)
        : Ratelimit.fixedWindow(requests, window),
      analytics: analyticsEnabled,
      prefix: `ratelimit:${endpoint}:${tier.toLowerCase()}`,
    });
  }

  return result;
}

export const chatDailyBurstRateLimiter = buildLimiters("chatDailyBurst");
export const chatMonthlyCapRateLimiter = buildLimiters("chatMonthlyCap");
export const discoveryRateLimiter = buildLimiters("discovery");
export const marketDataRateLimiter = buildLimiters("marketdata");
export const generalRateLimiter = buildLimiters("general");
