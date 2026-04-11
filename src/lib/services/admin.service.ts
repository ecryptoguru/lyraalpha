/**
 * Admin Data Service — Queries for all admin dashboard KPIs
 *
 * Uses existing tables (User, Subscription, AIRequestLog, Asset, MarketRegime, etc.)
 * Returns real data where available, structured for mock fallback where not.
 */

import { prisma } from "@/lib/prisma";
import { getCache, redis, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils/json";
import { Prisma } from "@/generated/prisma/client";

const logger = createLogger({ service: "admin-service" });

// ─── H5: Raw SQL Schema Dependencies ────────────────────────────────────────
// All raw SQL queries in this file use Prisma.sql tagged templates (injection-safe)
// but reference table/column names that Prisma won't validate at compile time.
// This constant documents every dependency so schema changes can be caught in review.
// If you rename any of these tables/columns in a migration, update the raw SQL too.
export const RAW_SQL_SCHEMA_DEPS = {
  User: ["id", "email", "createdAt", "plan"],
  AIRequestLog: [
    "userId", "createdAt", "tokensUsed", "totalCost", "model",
    "inputTokens", "outputTokens", "cachedInputTokens", "reasoningTokens",
    "wasFallback", "embeddingStatus", "inputQuery",
  ],
  WatchlistItem: ["userId", "createdAt"],
  UserActivityEvent: ["userId", "createdAt", "section", "pageSlug"],
  Subscription: ["plan", "status"],
  PaymentEvent: ["userId", "eventType", "processedAt", "provider"],
  AssetScore: ["assetId", "type", "value", "date"],
  Asset: [
    "id", "type", "symbol", "name", "compatibilityLabel", "compatibilityScore",
    "signalStrength", "sector",
  ],
  DiscoverySector: ["id", "tier", "complexity"],
  DiscoverySectorAsset: ["sectorId", "assetId", "mentionCount"],
  LearningCompletion: ["userId", "moduleSlug", "completedAt"],
  UserPreference: ["userId", "experimentGroup", "onboardingCompleted"],
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OverviewStats {
  totalUsers: number;
  activeSubscriptions: number;
  paidUsers: number;
  paidSubscriptions: number;
  planDistribution: Record<string, number>;
  mrr: number;
  arr: number;
  freeToPaidConversionRate: number;
  totalAssets: number;
  totalAIRequests: number;
  aiRequestsToday: number;
  aiRequestsLast7d: number;
  recentSignups7d: number;
  recentSignups30d: number;
  currentRegime: string | null;
}

export interface RevenueStats {
  mrr: number;
  arr: number;
  planDistribution: { plan: string; count: number; revenue: number }[];
  subscriptionsByStatus: Record<string, number>;
  recentPaymentEvents: {
    id: string;
    eventType: string;
    provider: string;
    processedAt: Date;
    userId: string | null;
  }[];
  userGrowthByMonth: { month: string; count: number }[];
}

export interface AICostStats {
  totalRequests: number;
  totalTokens: number;
  avgTokensPerRequest: number;
  totalCostUsd: number;
  avgCostPerRequestUsd: number;
  costPer1kTokensUsd: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  cacheEfficiencyPercent: number;
  fallbackRatePercent: number;
  modelRouteSharePercent: {
    gpt: number;
    other: number;
  };
  embeddingStatusBreakdown: {
    pending: number;
    processing: number;
    done: number;
    failed: number;
  };
  requestsByDay: { date: string; count: number; tokens: number; costUsd: number }[];
  topUsers: { userId: string; email: string; count: number; tokens: number; costUsd: number }[];
  modelDistribution: Record<string, number>;
  modelCostBreakdown: { model: string; count: number; tokens: number; costUsd: number }[];
  planModelBreakdown: { plan: string; model: string; count: number; costUsd: number }[];
}

export interface UsageStats {
  selectedRange: UsageRange;
  selectedRangeDays: number;
  assetTypeDistribution: Record<string, number>;
  topViewedAssets: { symbol: string; name: string; type: string; viewCount: number }[];
  discoveryItemCount: number;
  watchlistItemCount: number;
  onboardingCompletionRate: number;
  regionDistribution: Record<string, number>;
  experienceLevelDistribution: Record<string, number>;
  activationFunnel: {
    signedUp: number;
    onboarded: number;
    withAiRequest: number;
    withWatchlist: number;
    timeToFirstAiMedianMinutes: number;
  };
  retention: {
    dau: number;
    wau: number;
    mau: number;
    dauWauStickiness: number;
    wauMauStickiness: number;
  };
  cohortRetention: {
    cohortWeek: string;
    cohortSize: number;
    week1Retention: number;
    week2Retention: number;
    week4Retention: number;
  }[];
  sectionEngagement: {
    section: string;
    activeUsers: number;
    requests: number;
    totalActiveMinutes: number;
    avgActiveMinutesPerUser: number;
    avgRequestsPerUser: number;
  }[];
  intentDistribution: { intent: string; count: number }[];
  upgradeSignals14d: {
    proUsers: number;
    proActiveUsers: number;
    proUsersWithEliteIntent: number;
    eliteUpgradesDetected: number;
    estimatedUpgradeRateFromActivePro: number;
  };
  topUsersByActiveTime: {
    userId: string;
    email: string;
    plan: string;
    requests: number;
    activeMinutes: number;
    topSection: string;
  }[];
  beginnerKpis: {
    cohortUsers: number;
    onboardingCompletionRate: number;
    firstValueActionUsers: number;
    firstValueActionRate: number;
    d7EligibleUsers: number;
    d7ReturnedUsers: number;
    d7RetentionRate: number;
  };
  beginnerExperimentComparison: {
    control: {
      cohortUsers: number;
      onboardingCompletionRate: number;
      firstValueActionRate: number;
      d7RetentionRate: number;
    };
    treatment: {
      cohortUsers: number;
      onboardingCompletionRate: number;
      firstValueActionRate: number;
      d7RetentionRate: number;
    };
  };
  upgradeCtaExperiment: {
    impressions: {
      all: number;
      byBucket: { "0": number; "1": number; "2_plus": number };
    };
    clicks: {
      all: number;
      byBucket: { "0": number; "1": number; "2_plus": number };
    };
    ctrPercent: {
      all: number;
      byBucket: { "0": number; "1": number; "2_plus": number };
    };
    byVariant: {
      control: { impressions: number; clicks: number; ctrPercent: number };
      treatment: { impressions: number; clicks: number; ctrPercent: number };
    };
  };
  shareSheetEngagement: {
    opens: number;
    actionAttempts: number;
    successfulActions: number;
    openToAttemptRate: number;
    openToSuccessRate: number;
    topActions: { action: string; count: number }[];
    topSuccessActions: { action: string; count: number }[];
    topKinds: { kind: string; count: number }[];
    topPaths: { path: string; count: number }[];
    pathActionBreakdown: { path: string; action: string; count: number }[];
    kindActionBreakdown: { kind: string; action: string; count: number }[];
    pathKindBreakdown: { path: string; kind: string; count: number }[];
  };
  tierDistribution: { tier: string; count: number; requests: number }[];
  complexityDistribution: { complexity: string; count: number; requests: number }[];
  tierComplexityMatrix: { tier: string; complexity: string; count: number }[];
}

export type UsageRange = "7d" | "30d" | "90d";

export interface EngineStats {
  scoreDistributions: {
    type: string;
    avg: number;
    min: number;
    max: number;
    count: number;
  }[];
  compatibilityDistribution: {
    label: string;
    count: number;
    avgScore: number;
  }[];
  assetCoverage: {
    type: string;
    total: number;
    withScores: number;
    withSignalStrength: number;
  }[];
}

export interface RegimeStats {
  currentRegime: {
    state: string;
    breadthScore: number | null;
    vixValue: number | null;
    date: Date;
    region: string;
  } | null;
  regimeHistory: {
    date: Date;
    state: string;
    breadthScore: number | null;
    region: string;
  }[];
  multiHorizon: {
    date: Date;
    current: unknown;
    shortTerm: unknown;
    mediumTerm: unknown;
    longTerm: unknown;
    transitionProbability: number;
    transitionDirection: string;
    region: string;
  } | null;
  transitionCount30d: number;
  crossSectorCorrelation: {
    regime: string;
    dispersion: number;
    trend: number;
  } | null;
}

export interface InfraStats {
  cacheStats: { hits: number; misses: number; hitRate: number } | null;
  redisInfo: Record<string, string> | null;
  dbTableCounts: Record<string, number>;
  recentSyncInfo: string | null;
  embeddingPipelineHealth: {
    knowledgeDocs: { pending: number; processing: number; done: number; failed: number };
    aiRequestLogs: { pending: number; processing: number; done: number; failed: number };
  } | null;
}

// ─── Plan Pricing (matches upgrade page) ────────────────────────────────────

const PLAN_PRICES: Record<string, number> = {
  STARTER: 0,
  PRO: 14.99,
  ELITE: 39.99,
  ENTERPRISE: 499,
};

// ─── Overview ───────────────────────────────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const revenueStatuses = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

  const [
    totalUsers,
    planCounts,
    revenuePlanCounts,
    activeSubscriptions,
    totalAssets,
    totalAIRequests,
    aiRequestsToday,
    aiRequestsLast7d,
    recentSignups7d,
    recentSignups30d,
    latestRegime,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["plan"], _count: true }),
    prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: { in: [...revenueStatuses] } },
      _count: true,
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.asset.count(),
    prisma.aIRequestLog.count(),
    prisma.aIRequestLog.count({ where: { createdAt: { gte: today } } }),
    prisma.aIRequestLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.marketRegime.findFirst({ orderBy: { date: "desc" }, where: { assetId: null } }),
  ]);

  const planDistribution: Record<string, number> = {};
  for (const row of planCounts) {
    planDistribution[row.plan] = row._count;
  }

  const revenuePlanDistribution: Record<string, number> = {};
  for (const row of revenuePlanCounts) {
    revenuePlanDistribution[row.plan] = row._count;
  }

  const paidUsers = Object.entries(revenuePlanDistribution).reduce((sum, [plan, count]) => {
    if (plan === "STARTER") {
      return sum;
    }

    return sum + count;
  }, 0);
  const mrr = Object.entries(revenuePlanDistribution).reduce((sum, [plan, count]) => {
    return sum + count * (PLAN_PRICES[plan] ?? 0);
  }, 0);
  const freeToPaidConversionRate = totalUsers > 0 ? Number(((paidUsers / totalUsers) * 100).toFixed(1)) : 0;

  return {
    totalUsers,
    activeSubscriptions,
    paidUsers,
    paidSubscriptions: paidUsers,
    planDistribution,
    mrr,
    arr: Number((mrr * 12).toFixed(2)),
    freeToPaidConversionRate,
    totalAssets,
    totalAIRequests,
    aiRequestsToday,
    aiRequestsLast7d,
    recentSignups7d,
    recentSignups30d,
    currentRegime: latestRegime?.state ?? null,
  };
}

// ─── Revenue ────────────────────────────────────────────────────────────────

export async function getRevenueStats(): Promise<RevenueStats> {
  const revenueStatuses = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

  const [subscriptionPlanCounts, subscriptionsByStatus, recentPaymentEvents, usersByMonth] =
    await Promise.all([
      prisma.subscription.groupBy({
        by: ["plan"],
        where: { status: { in: [...revenueStatuses] } },
        _count: true,
      }),
      prisma.subscription.groupBy({ by: ["status"], _count: true }),
      prisma.paymentEvent.findMany({
        orderBy: { processedAt: "desc" },
        take: 20,
        select: {
          id: true,
          eventType: true,
          provider: true,
          processedAt: true,
          userId: true,
        },
      }),
      prisma.$queryRaw<{ month: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char("createdAt", 'YYYY-MM') as month, COUNT(*)::bigint as count
        FROM "User"
        GROUP BY to_char("createdAt", 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `),
    ]);

  const planDistribution = subscriptionPlanCounts.map((row) => ({
    plan: row.plan,
    count: row._count,
    revenue: row._count * (PLAN_PRICES[row.plan] ?? 0),
  }));

  const mrr = planDistribution.reduce((sum, row) => sum + row.revenue, 0);

  const statusMap: Record<string, number> = {};
  for (const row of subscriptionsByStatus) {
    statusMap[row.status] = row._count;
  }

  const userGrowthByMonth = usersByMonth.map((row) => ({
    month: row.month,
    count: Number(row.count),
  }));

  return {
    mrr,
    arr: mrr * 12,
    planDistribution,
    subscriptionsByStatus: statusMap,
    recentPaymentEvents,
    userGrowthByMonth,
  };
}

// ─── AI Costs ───────────────────────────────────────────────────────────────

export async function getAICostStats(): Promise<AICostStats> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [totalRequests, tokenAgg, requestsByDay, topUsers, modelDist, fallbackAgg, embeddingAgg, planModelAgg] =
    await Promise.all([
      prisma.aIRequestLog.count(),
      prisma.$queryRaw<
        Array<{
          totalTokens: bigint;
          avgTokensPerRequest: number;
          totalCostUsd: number;
          avgCostPerRequestUsd: number;
          inputTokens: bigint;
          outputTokens: bigint;
          cachedInputTokens: bigint;
          reasoningTokens: bigint;
        }>
      >(Prisma.sql`
        SELECT
          COALESCE(SUM("tokensUsed"), 0)::bigint AS "totalTokens",
          COALESCE(AVG("tokensUsed"), 0)::double precision AS "avgTokensPerRequest",
          COALESCE(SUM("totalCost"), 0)::double precision AS "totalCostUsd",
          COALESCE(AVG("totalCost"), 0)::double precision AS "avgCostPerRequestUsd",
          COALESCE(SUM("inputTokens"), 0)::bigint AS "inputTokens",
          COALESCE(SUM("outputTokens"), 0)::bigint AS "outputTokens",
          COALESCE(SUM("cachedInputTokens"), 0)::bigint AS "cachedInputTokens",
          COALESCE(SUM("reasoningTokens"), 0)::bigint AS "reasoningTokens"
        FROM "AIRequestLog"
      `),
      prisma.$queryRaw<{ date: string; count: bigint; tokens: bigint; costUsd: number }[]>(Prisma.sql`
        SELECT to_char("createdAt", 'YYYY-MM-DD') as date,
               COUNT(*)::bigint as count,
               COALESCE(SUM("tokensUsed"), 0)::bigint as tokens,
               COALESCE(SUM("totalCost"), 0)::double precision as "costUsd"
        FROM "AIRequestLog"
        WHERE "createdAt" >= ${fourteenDaysAgo}
        GROUP BY to_char("createdAt", 'YYYY-MM-DD')
        ORDER BY date DESC
      `),
      prisma.$queryRaw<{ userId: string; email: string; count: bigint; tokens: bigint; costUsd: number }[]>(Prisma.sql`
        SELECT a."userId", u."email",
               COUNT(*)::bigint as count,
               COALESCE(SUM(a."tokensUsed"), 0)::bigint as tokens,
               COALESCE(SUM(a."totalCost"), 0)::double precision as "costUsd"
        FROM "AIRequestLog" a
        JOIN "User" u ON u."id" = a."userId"
        GROUP BY a."userId", u."email"
        ORDER BY "costUsd" DESC, tokens DESC
        LIMIT 15
      `),
      prisma.$queryRaw<{ model: string; count: bigint; tokens: bigint; costUsd: number }[]>(Prisma.sql`
        SELECT
          COALESCE(model, 'unknown') as model,
          COUNT(*)::bigint as count,
          COALESCE(SUM("tokensUsed"), 0)::bigint as tokens,
          COALESCE(SUM("totalCost"), 0)::double precision as "costUsd"
        FROM "AIRequestLog"
        GROUP BY COALESCE(model, 'unknown')
        ORDER BY "costUsd" DESC, tokens DESC
      `),
      prisma.$queryRaw<Array<{ fallbackCount: bigint }>>(Prisma.sql`
        SELECT COALESCE(SUM(CASE WHEN "wasFallback" = true THEN 1 ELSE 0 END), 0)::bigint AS "fallbackCount"
        FROM "AIRequestLog"
      `),
      prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
        SELECT COALESCE("embeddingStatus"::text, 'UNKNOWN') AS status,
               COUNT(*)::bigint as count
        FROM "AIRequestLog"
        GROUP BY COALESCE("embeddingStatus"::text, 'UNKNOWN')
      `),
      prisma.$queryRaw<Array<{ plan: string; model: string; count: bigint; costUsd: number }>>(Prisma.sql`
        SELECT
          COALESCE(u.plan::text, 'UNKNOWN') as plan,
          COALESCE(a.model, 'unknown') as model,
          COUNT(*)::bigint as count,
          COALESCE(SUM(a."totalCost"), 0)::double precision as "costUsd"
        FROM "AIRequestLog" a
        JOIN "User" u ON u."id" = a."userId"
        GROUP BY COALESCE(u.plan::text, 'UNKNOWN'), COALESCE(a.model, 'unknown')
        ORDER BY plan ASC, "costUsd" DESC
      `),
    ]);

  const modelDistribution: Record<string, number> = {};
  for (const row of modelDist) {
    modelDistribution[row.model ?? "unknown"] = Number(row.count);
  }

  const totals = tokenAgg[0] ?? {
    totalTokens: BigInt(0),
    avgTokensPerRequest: 0,
    totalCostUsd: 0,
    avgCostPerRequestUsd: 0,
    inputTokens: BigInt(0),
    outputTokens: BigInt(0),
    cachedInputTokens: BigInt(0),
    reasoningTokens: BigInt(0),
  };

  const fallbackCount = Number(fallbackAgg[0]?.fallbackCount ?? 0);
  const totalRequestsSafe = Math.max(1, totalRequests);
  const fallbackRatePercent = (fallbackCount / totalRequestsSafe) * 100;

  const totalInputTokens = Number(totals.inputTokens ?? 0);
  const totalCachedInputTokens = Number(totals.cachedInputTokens ?? 0);
  const cacheEfficiencyPercent = totalInputTokens > 0
    ? (totalCachedInputTokens / totalInputTokens) * 100
    : 0;

  const totalTokensNum = Number(totals.totalTokens ?? 0);
  const totalCostUsdNum = Number(totals.totalCostUsd ?? 0);
  const costPer1kTokensUsd = totalTokensNum > 0
    ? (totalCostUsdNum / totalTokensNum) * 1000
    : 0;

  let gptCount = 0;
  let otherCount = 0;
  for (const row of modelDist) {
    const model = (row.model ?? "unknown").toLowerCase();
    const count = Number(row.count ?? 0);
    if (model.includes("gpt")) {
      gptCount += count;
    } else {
      otherCount += count;
    }
  }

  const routeDenominator = Math.max(1, gptCount + otherCount);
  const modelRouteSharePercent = {
    gpt: (gptCount / routeDenominator) * 100,
    other: (otherCount / routeDenominator) * 100,
  };

  const embeddingStatusMap: Record<string, number> = {};
  for (const row of embeddingAgg) {
    embeddingStatusMap[(row.status || "UNKNOWN").toUpperCase()] = Number(row.count ?? 0);
  }

  const embeddingStatusBreakdown = {
    pending: embeddingStatusMap.PENDING ?? 0,
    processing: embeddingStatusMap.PROCESSING ?? 0,
    done: embeddingStatusMap.DONE ?? 0,
    failed: embeddingStatusMap.FAILED ?? 0,
  };

  return {
    totalRequests,
    totalTokens: totalTokensNum,
    avgTokensPerRequest: Math.round(Number(totals.avgTokensPerRequest ?? 0)),
    totalCostUsd: totalCostUsdNum,
    avgCostPerRequestUsd: Number(totals.avgCostPerRequestUsd ?? 0),
    costPer1kTokensUsd,
    inputTokens: totalInputTokens,
    outputTokens: Number(totals.outputTokens ?? 0),
    cachedInputTokens: totalCachedInputTokens,
    reasoningTokens: Number(totals.reasoningTokens ?? 0),
    cacheEfficiencyPercent,
    fallbackRatePercent,
    modelRouteSharePercent,
    embeddingStatusBreakdown,
    requestsByDay: requestsByDay.map((r) => ({
      date: r.date,
      count: Number(r.count),
      tokens: Number(r.tokens),
      costUsd: Number(r.costUsd ?? 0),
    })),
    topUsers: topUsers.map((r) => ({
      userId: r.userId,
      email: r.email,
      count: Number(r.count),
      tokens: Number(r.tokens),
      costUsd: Number(r.costUsd ?? 0),
    })),
    modelDistribution,
    modelCostBreakdown: modelDist.map((r) => ({
      model: r.model ?? "unknown",
      count: Number(r.count),
      tokens: Number(r.tokens),
      costUsd: Number(r.costUsd ?? 0),
    })),
    planModelBreakdown: planModelAgg.map((r) => ({
      plan: r.plan,
      model: r.model,
      count: Number(r.count ?? 0),
      costUsd: Number(r.costUsd ?? 0),
    })),
  };
}

// ─── Usage ──────────────────────────────────────────────────────────────────

const USAGE_RANGE_DAYS: Record<UsageRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

type BeginnerExperimentRow = {
  variant: "control" | "treatment";
  cohortUsers: bigint;
  onboardedUsers: bigint;
  firstValueUsers: bigint;
  d7EligibleUsers: bigint;
  d7ReturnedUsers: bigint;
};

async function getUpgradeCtaExperimentSummary() {
  const buckets: Array<"0" | "1" | "2_plus"> = ["0", "1", "2_plus"];
  const variants: Array<"control" | "treatment"> = ["control", "treatment"];

  const impressionsByBucket = { "0": 0, "1": 0, "2_plus": 0 };
  const clicksByBucket = { "0": 0, "1": 0, "2_plus": 0 };
  const variantRollup = {
    control: { impressions: 0, clicks: 0, ctrPercent: 0 },
    treatment: { impressions: 0, clicks: 0, ctrPercent: 0 },
  };

  try {
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `ux:cta-events:${d.toISOString().slice(0, 10)}`;
      const hash = (await redis.hgetall(key)) as Record<string, string> | null;
      const safeHash: Record<string, string> = hash ?? {};

      for (const [field, rawCount] of Object.entries(safeHash)) {
        const count = Number(rawCount) || 0;
        if (count <= 0) continue;

        const parts = field.split(":");
        if (parts.length < 4) continue;

        const eventType = parts[parts.length - 3] as "impression" | "click";
        const bucket = parts[parts.length - 2] as "0" | "1" | "2_plus";
        const variant = parts[parts.length - 1] as "control" | "treatment";

        if (!buckets.includes(bucket) || !variants.includes(variant)) continue;

        if (eventType === "impression") {
          impressionsByBucket[bucket] += count;
          variantRollup[variant].impressions += count;
        }

        if (eventType === "click") {
          clicksByBucket[bucket] += count;
          variantRollup[variant].clicks += count;
        }
      }
    }
  } catch {
    // Return zeroed telemetry summary when Redis is unavailable.
  }

  const impressionsAll = impressionsByBucket["0"] + impressionsByBucket["1"] + impressionsByBucket["2_plus"];
  const clicksAll = clicksByBucket["0"] + clicksByBucket["1"] + clicksByBucket["2_plus"];

  const ctrByBucket = {
    "0": impressionsByBucket["0"] > 0 ? Number(((clicksByBucket["0"] / impressionsByBucket["0"]) * 100).toFixed(2)) : 0,
    "1": impressionsByBucket["1"] > 0 ? Number(((clicksByBucket["1"] / impressionsByBucket["1"]) * 100).toFixed(2)) : 0,
    "2_plus": impressionsByBucket["2_plus"] > 0
      ? Number(((clicksByBucket["2_plus"] / impressionsByBucket["2_plus"]) * 100).toFixed(2))
      : 0,
  };

  for (const variant of variants) {
    variantRollup[variant].ctrPercent =
      variantRollup[variant].impressions > 0
        ? Number(((variantRollup[variant].clicks / variantRollup[variant].impressions) * 100).toFixed(2))
        : 0;
  }

  return {
    impressions: {
      all: impressionsAll,
      byBucket: impressionsByBucket,
    },
    clicks: {
      all: clicksAll,
      byBucket: clicksByBucket,
    },
    ctrPercent: {
      all: impressionsAll > 0 ? Number(((clicksAll / impressionsAll) * 100).toFixed(2)) : 0,
      byBucket: ctrByBucket,
    },
    byVariant: variantRollup,
  };
}

async function getShareSheetEngagementSummary(days: number) {
  const actions = new Map<string, number>();
  const successActions = new Map<string, number>();
  const kinds = new Map<string, number>();
  const paths = new Map<string, number>();
  const pathAction = new Map<string, number>();
  const kindAction = new Map<string, number>();
  const pathKind = new Map<string, number>();
  let opens = 0;
  let actionAttempts = 0;
  let successfulActions = 0;

  try {
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `ux:share-events:${d.toISOString().slice(0, 10)}`;
      const hash = (await redis.hgetall(key)) as Record<string, string> | null;
      const safeHash: Record<string, string> = hash ?? {};

      for (const [field, rawCount] of Object.entries(safeHash)) {
        const count = Number(rawCount) || 0;
        if (count <= 0) continue;

        const parts = field.split(":");
        if (parts.length < 4) continue;

        const [action, kind] = parts;
        const path = parts.slice(3).join(":");

        actions.set(action, (actions.get(action) ?? 0) + count);
        kinds.set(kind, (kinds.get(kind) ?? 0) + count);
        paths.set(path, (paths.get(path) ?? 0) + count);
        pathAction.set(`${path}:::${action}`, (pathAction.get(`${path}:::${action}`) ?? 0) + count);
        kindAction.set(`${kind}:::${action}`, (kindAction.get(`${kind}:::${action}`) ?? 0) + count);
        pathKind.set(`${path}:::${kind}`, (pathKind.get(`${path}:::${kind}`) ?? 0) + count);

        if (action === "sheet_open") {
          opens += count;
        }

        if (action.endsWith("_attempt")) {
          actionAttempts += count;
        }

        if (action.endsWith("_success")) {
          successfulActions += count;
          successActions.set(action, (successActions.get(action) ?? 0) + count);
        }
      }
    }
  } catch {
    // Return zeroed telemetry summary when Redis is unavailable.
  }

  const toSortedRows = (map: Map<string, number>, keyName: "action" | "kind" | "path") =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ [keyName]: value, count }));

  const toCompositeRows = <T extends "pathAction" | "kindAction" | "pathKind">(
    map: Map<string, number>,
    kind: T,
  ) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => {
        const [left, right] = value.split(":::");
        if (kind === "pathAction") {
          return { path: left, action: right, count };
        }
        if (kind === "kindAction") {
          return { kind: left, action: right, count };
        }
        return { path: left, kind: right, count };
      });

  return {
    opens,
    actionAttempts,
    successfulActions,
    openToAttemptRate: opens > 0 ? Number(((actionAttempts / opens) * 100).toFixed(2)) : 0,
    openToSuccessRate: opens > 0 ? Number(((successfulActions / opens) * 100).toFixed(2)) : 0,
    topActions: toSortedRows(actions, "action") as { action: string; count: number }[],
    topSuccessActions: toSortedRows(successActions, "action") as { action: string; count: number }[],
    topKinds: toSortedRows(kinds, "kind") as { kind: string; count: number }[],
    topPaths: toSortedRows(paths, "path") as { path: string; count: number }[],
    pathActionBreakdown: toCompositeRows(pathAction, "pathAction") as { path: string; action: string; count: number }[],
    kindActionBreakdown: toCompositeRows(kindAction, "kindAction") as { kind: string; action: string; count: number }[],
    pathKindBreakdown: toCompositeRows(pathKind, "pathKind") as { path: string; kind: string; count: number }[],
  };
}

export async function getUsageStats(range: UsageRange = "30d"): Promise<UsageStats> {
  const selectedRangeDays = USAGE_RANGE_DAYS[range];
  const cacheKey = `admin:usage:${range}`;
  const cached = await getCache<UsageStats>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const rangeStart = new Date(now.getTime() - selectedRangeDays * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    assetTypeCounts,
    discoveryItemCount,
    watchlistItemCount,
    onboardingStats,
    regionCounts,
    experienceCounts,
    signedUpInRange,
    onboardedInRange,
    withAiRequestInRange,
    withWatchlistInRange,
    firstAiLagMedian,
    dauRows,
    wauRows,
    mauRows,
    cohortRetentionRows,
    sectionEngagementRows,
    intentDistributionRows,
    proUsers,
    proActiveUsers,
    proUsersWithEliteIntent,
    eliteUpgradesDetected,
    topUsersByActiveTimeRows,
    firstValueUsersInRangeRows,
    d7EligibleUsersRows,
    d7ReturnedUsersRows,
    beginnerExperimentRows,
    upgradeCtaExperiment,
    shareSheetEngagement,
    tierDistributionRows,
    complexityDistributionRows,
    tierComplexityMatrixRows,
  ] = await Promise.all([
    prisma.asset.groupBy({ by: ["type"], _count: true }),
    prisma.discoveryFeedItem.count(),
    prisma.watchlistItem.count(),
    prisma.userPreference.aggregate({
      _count: { _all: true },
      where: { onboardingCompleted: true },
    }),
    prisma.userPreference.groupBy({ by: ["preferredRegion"], _count: true }),
    prisma.userPreference.groupBy({ by: ["experienceLevel"], _count: true }),
    prisma.user.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.userPreference.count({ where: { onboardingCompleted: true, onboardingCompletedAt: { gte: rangeStart } } }),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "AIRequestLog"
      WHERE "createdAt" >= ${rangeStart}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "WatchlistItem"
      WHERE "createdAt" >= ${rangeStart}
    `),
    prisma.$queryRaw<{ medianMinutes: number | null }[]>(Prisma.sql`
      WITH first_requests AS (
        SELECT u."id" AS "userId",
               EXTRACT(EPOCH FROM (MIN(r."createdAt") - u."createdAt")) / 60.0 AS minutes
        FROM "User" u
        JOIN "AIRequestLog" r ON r."userId" = u."id"
        WHERE u."createdAt" >= ${rangeStart}
        GROUP BY u."id"
      )
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes)::numeric, 2) AS "medianMinutes"
      FROM first_requests
    `),
    // DAU: unique users with session activity in last 24h (true session-based)
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "UserActivityEvent"
      WHERE "createdAt" >= ${oneDayAgo}
    `),
    // WAU: unique users with session activity in last 7 days
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "UserActivityEvent"
      WHERE "createdAt" >= ${sevenDaysAgo}
    `),
    // MAU: unique users with session activity in last 30 days
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "UserActivityEvent"
      WHERE "createdAt" >= ${thirtyDaysAgo}
    `),
    prisma.$queryRaw<
      {
        cohortWeek: string;
        cohortSize: bigint;
        week1Retention: number;
        week2Retention: number;
        week4Retention: number;
      }[]
    >(Prisma.sql`
      WITH cohorts AS (
        SELECT u."id" AS "userId",
               date_trunc('week', u."createdAt") AS cohort_week
        FROM "User" u
        WHERE u."createdAt" >= NOW() - INTERVAL '12 weeks'
      ),
      activity AS (
        SELECT DISTINCT r."userId", date_trunc('week', r."createdAt") AS active_week
        FROM "AIRequestLog" r
      )
      SELECT
        to_char(c.cohort_week, 'YYYY-MM-DD') AS "cohortWeek",
        COUNT(*)::bigint AS "cohortSize",
        ROUND((COUNT(*) FILTER (WHERE a1."userId" IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS "week1Retention",
        ROUND((COUNT(*) FILTER (WHERE a2."userId" IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS "week2Retention",
        ROUND((COUNT(*) FILTER (WHERE a4."userId" IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS "week4Retention"
      FROM cohorts c
      LEFT JOIN activity a1 ON a1."userId" = c."userId" AND a1.active_week = c.cohort_week + INTERVAL '1 week'
      LEFT JOIN activity a2 ON a2."userId" = c."userId" AND a2.active_week = c.cohort_week + INTERVAL '2 week'
      LEFT JOIN activity a4 ON a4."userId" = c."userId" AND a4.active_week = c.cohort_week + INTERVAL '4 week'
      GROUP BY c.cohort_week
      ORDER BY c.cohort_week DESC
      LIMIT 8
    `),
    prisma.$queryRaw<
      {
        section: string;
        activeUsers: bigint;
        requests: bigint;
        totalActiveMinutes: number;
        avgActiveMinutesPerUser: number;
        avgRequestsPerUser: number;
      }[]
    >(Prisma.sql`
      WITH labeled AS (
        SELECT
          r."userId",
          r."createdAt",
          CASE
            WHEN LOWER(r."inputQuery") ~ '(watchlist|portfolio|allocation|position|holdings?)' THEN 'PORTFOLIO'
            WHEN LOWER(r."inputQuery") ~ '(timeline|event|news|impact|regime)' THEN 'TIMELINE'
            WHEN LOWER(r."inputQuery") ~ '(discover|discovery|theme|sector)' THEN 'DISCOVERY'
            WHEN LOWER(r."inputQuery") ~ '(learn|module|lesson|quiz|tutorial)' THEN 'LEARNING'
            WHEN LOWER(r."inputQuery") ~ '(crypto|bitcoin|ethereum|etf|stock|asset|signal|momentum|volatility|liquidity|trust)' THEN 'MARKET_INTEL'
            ELSE 'LYRA_INTEL'
          END AS section
        FROM "AIRequestLog" r
        WHERE r."createdAt" >= ${rangeStart}
      ),
      ordered AS (
        SELECT
          section,
          "userId",
          "createdAt",
          LAG("createdAt") OVER (PARTITION BY section, "userId" ORDER BY "createdAt") AS prev_at
        FROM labeled
      ),
      durations AS (
        SELECT
          section,
          "userId",
          CASE
            WHEN prev_at IS NULL THEN 0.5
            WHEN EXTRACT(EPOCH FROM ("createdAt" - prev_at)) BETWEEN 0 AND 900
              THEN LEAST(EXTRACT(EPOCH FROM ("createdAt" - prev_at)) / 60.0, 5.0)
            ELSE 0.5
          END AS active_minutes
        FROM ordered
      )
      SELECT
        d.section,
        COUNT(DISTINCT d."userId")::bigint AS "activeUsers",
        COUNT(*)::bigint AS requests,
        ROUND(SUM(d.active_minutes)::numeric, 2) AS "totalActiveMinutes",
        ROUND((SUM(d.active_minutes) / NULLIF(COUNT(DISTINCT d."userId"), 0))::numeric, 2) AS "avgActiveMinutesPerUser",
        ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT d."userId"), 0))::numeric, 2) AS "avgRequestsPerUser"
      FROM durations d
      GROUP BY d.section
      ORDER BY "totalActiveMinutes" DESC
    `),
    prisma.$queryRaw<{ intent: string; count: bigint }[]>(Prisma.sql`
      SELECT
        CASE
          WHEN LOWER("inputQuery") ~ '(what|why|explain|understand|learn)' THEN 'UNDERSTAND_MARKET'
          WHEN LOWER("inputQuery") ~ '(buy|sell|entry|exit|target|risk|hedge)' THEN 'DECISION_SUPPORT'
          WHEN LOWER("inputQuery") ~ '(compare|vs|better|best|rank)' THEN 'COMPARE_OPTIONS'
          WHEN LOWER("inputQuery") ~ '(watchlist|portfolio|allocation|rebalance)' THEN 'PORTFOLIO_ACTION'
          WHEN LOWER("inputQuery") ~ '(news|timeline|event|impact)' THEN 'EVENT_MONITORING'
          ELSE 'GENERAL_EXPLORATION'
        END AS intent,
        COUNT(*)::bigint AS count
      FROM "AIRequestLog"
      WHERE "createdAt" >= ${rangeStart}
      GROUP BY 1
      ORDER BY count DESC
    `),
    prisma.user.count({ where: { plan: "PRO" } }),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT u."id")::bigint AS count
      FROM "User" u
      JOIN "AIRequestLog" r ON r."userId" = u."id"
      WHERE u."plan" = 'PRO' AND r."createdAt" >= ${fourteenDaysAgo}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT u."id")::bigint AS count
      FROM "User" u
      JOIN "AIRequestLog" r ON r."userId" = u."id"
      WHERE u."plan" = 'PRO'
        AND r."createdAt" >= ${fourteenDaysAgo}
        AND LOWER(r."inputQuery") ~ '(crypto|onchain|institutional|correlation|advanced|elite)'
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "PaymentEvent"
      WHERE "processedAt" >= ${fourteenDaysAgo}
        AND "userId" IS NOT NULL
        AND (
          LOWER("eventType") LIKE '%upgrade%'
          OR LOWER("eventType") LIKE '%updated%'
          OR LOWER("payload"::text) LIKE '%"elite"%'
        )
        AND LOWER("payload"::text) LIKE '%"pro"%'
        AND LOWER("payload"::text) LIKE '%"elite"%'
    `),
    prisma.$queryRaw<
      {
        userId: string;
        email: string;
        plan: string;
        requests: bigint;
        activeMinutes: number;
        topSection: string;
      }[]
    >(Prisma.sql`
      WITH labeled AS (
        SELECT
          r."userId",
          u."email",
          u."plan"::text AS plan,
          r."createdAt",
          CASE
            WHEN LOWER(r."inputQuery") ~ '(watchlist|portfolio|allocation|position|holdings?)' THEN 'PORTFOLIO'
            WHEN LOWER(r."inputQuery") ~ '(timeline|event|news|impact|regime)' THEN 'TIMELINE'
            WHEN LOWER(r."inputQuery") ~ '(discover|discovery|theme|sector)' THEN 'DISCOVERY'
            WHEN LOWER(r."inputQuery") ~ '(learn|module|lesson|quiz|tutorial)' THEN 'LEARNING'
            WHEN LOWER(r."inputQuery") ~ '(crypto|bitcoin|ethereum|etf|stock|asset|signal|momentum|volatility|liquidity|trust)' THEN 'MARKET_INTEL'
            ELSE 'LYRA_INTEL'
          END AS section
        FROM "AIRequestLog" r
        JOIN "User" u ON u."id" = r."userId"
        WHERE r."createdAt" >= ${rangeStart}
      ),
      ordered AS (
        SELECT
          *,
          LAG("createdAt") OVER (PARTITION BY "userId", section ORDER BY "createdAt") AS prev_at
        FROM labeled
      ),
      durations AS (
        SELECT
          "userId",
          email,
          plan,
          section,
          CASE
            WHEN prev_at IS NULL THEN 0.5
            WHEN EXTRACT(EPOCH FROM ("createdAt" - prev_at)) BETWEEN 0 AND 900
              THEN LEAST(EXTRACT(EPOCH FROM ("createdAt" - prev_at)) / 60.0, 5.0)
            ELSE 0.5
          END AS active_minutes
        FROM ordered
      ),
      section_rank AS (
        SELECT
          "userId",
          section,
          SUM(active_minutes) AS section_minutes,
          ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY SUM(active_minutes) DESC) AS rn
        FROM durations
        GROUP BY "userId", section
      )
      SELECT
        d."userId",
        d.email,
        d.plan,
        COUNT(*)::bigint AS requests,
        ROUND(SUM(d.active_minutes)::numeric, 2) AS "activeMinutes",
        COALESCE(sr.section, 'LYRA_INTEL') AS "topSection"
      FROM durations d
      LEFT JOIN section_rank sr ON sr."userId" = d."userId" AND sr.rn = 1
      GROUP BY d."userId", d.email, d.plan, sr.section
      ORDER BY "activeMinutes" DESC
      LIMIT 20
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT u."id")::bigint AS count
      FROM "User" u
      WHERE u."createdAt" >= ${rangeStart}
        AND (
          EXISTS (
            SELECT 1
            FROM "AIRequestLog" r
            WHERE r."userId" = u."id"
          )
          OR EXISTS (
            SELECT 1
            FROM "WatchlistItem" w
            WHERE w."userId" = u."id"
          )
        )
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= ${fourteenDaysAgo}
        AND "createdAt" < ${sevenDaysAgo}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "User" u
      WHERE u."createdAt" >= ${fourteenDaysAgo}
        AND u."createdAt" < ${sevenDaysAgo}
        AND (
          EXISTS (
            SELECT 1
            FROM "AIRequestLog" r
            WHERE r."userId" = u."id"
              AND r."createdAt" >= (u."createdAt" + INTERVAL '7 day')
              AND r."createdAt" < (u."createdAt" + INTERVAL '8 day')
          )
          OR EXISTS (
            SELECT 1
            FROM "WatchlistItem" w
            WHERE w."userId" = u."id"
              AND w."createdAt" >= (u."createdAt" + INTERVAL '7 day')
              AND w."createdAt" < (u."createdAt" + INTERVAL '8 day')
          )
        )
    `),
    prisma.$queryRaw<BeginnerExperimentRow[]>(Prisma.sql`
      WITH cohort AS (
        SELECT
          u."id",
          CASE
            WHEN MOD(ABS(HASHTEXT(u."id"::text)), 2) = 0 THEN 'control'
            ELSE 'treatment'
          END AS variant,
          u."createdAt"
        FROM "User" u
        WHERE u."createdAt" >= ${rangeStart}
      )
      SELECT
        c.variant::text AS variant,
        COUNT(*)::bigint AS "cohortUsers",
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "UserPreference" p
            WHERE p."userId" = c."id"
              AND p."onboardingCompleted" = true
          )
        )::bigint AS "onboardedUsers",
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "AIRequestLog" r
            WHERE r."userId" = c."id"
          )
          OR EXISTS (
            SELECT 1
            FROM "WatchlistItem" w
            WHERE w."userId" = c."id"
          )
        )::bigint AS "firstValueUsers",
        COUNT(*) FILTER (
          WHERE c."createdAt" >= ${fourteenDaysAgo}
            AND c."createdAt" < ${sevenDaysAgo}
        )::bigint AS "d7EligibleUsers",
        COUNT(*) FILTER (
          WHERE c."createdAt" >= ${fourteenDaysAgo}
            AND c."createdAt" < ${sevenDaysAgo}
            AND (
              EXISTS (
                SELECT 1
                FROM "AIRequestLog" r
                WHERE r."userId" = c."id"
                  AND r."createdAt" >= (c."createdAt" + INTERVAL '7 day')
                  AND r."createdAt" < (c."createdAt" + INTERVAL '8 day')
              )
              OR EXISTS (
                SELECT 1
                FROM "WatchlistItem" w
                WHERE w."userId" = c."id"
                  AND w."createdAt" >= (c."createdAt" + INTERVAL '7 day')
                  AND w."createdAt" < (c."createdAt" + INTERVAL '8 day')
              )
            )
        )::bigint AS "d7ReturnedUsers"
      FROM cohort c
      GROUP BY c.variant
    `),
    getUpgradeCtaExperimentSummary(),
    getShareSheetEngagementSummary(selectedRangeDays),
    prisma.$queryRaw<{ tier: string; count: bigint; requests: bigint }[]>(Prisma.sql`
      SELECT COALESCE(u.plan::text, 'UNKNOWN') as tier,
             COUNT(DISTINCT u."id")::bigint as count,
             COUNT(r."id")::bigint as requests
      FROM "User" u
      LEFT JOIN "AIRequestLog" r ON r."userId" = u."id" AND r."createdAt" >= ${rangeStart}
      GROUP BY u.plan
      ORDER BY requests DESC
    `),
    prisma.$queryRaw<{ complexity: string; count: bigint; requests: bigint }[]>(Prisma.sql`
      SELECT COALESCE(r.complexity::text, 'UNKNOWN') as complexity,
             COUNT(DISTINCT r."userId")::bigint as count,
             COUNT(r."id")::bigint as requests
      FROM "AIRequestLog" r
      WHERE r."createdAt" >= ${rangeStart}
      GROUP BY r.complexity
      ORDER BY requests DESC
    `),
    prisma.$queryRaw<{ tier: string; complexity: string; count: bigint }[]>(Prisma.sql`
      SELECT COALESCE(u.plan::text, 'UNKNOWN') as tier,
             COALESCE(r.complexity::text, 'UNKNOWN') as complexity,
             COUNT(r."id")::bigint as count
      FROM "AIRequestLog" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE r."createdAt" >= ${rangeStart}
      GROUP BY u.plan, r.complexity
      ORDER BY tier ASC, count DESC
    `),
  ]);

  const totalPrefs = await prisma.userPreference.count();

  const assetTypeDistribution: Record<string, number> = {};
  for (const row of assetTypeCounts) {
    assetTypeDistribution[row.type] = row._count;
  }

  const regionDistribution: Record<string, number> = {};
  for (const row of regionCounts) {
    regionDistribution[row.preferredRegion] = row._count;
  }

  const experienceLevelDistribution: Record<string, number> = {};
  for (const row of experienceCounts) {
    experienceLevelDistribution[row.experienceLevel] = row._count;
  }

  // Top assets by AI request mentions (proxy for "most viewed")
  const topAssets = await prisma.$queryRaw<
    { symbol: string; name: string; type: string; viewCount: bigint }[]
  >(Prisma.sql`
    SELECT a."symbol", a."name", a."type"::text,
           COUNT(*)::bigint as "viewCount"
    FROM "AIRequestLog" r
    JOIN "Asset" a ON (
      LOWER(TRIM(r."inputQuery")) = LOWER(a."symbol")
      OR LOWER(r."inputQuery") LIKE LOWER(a."symbol") || ' %'
      OR LOWER(r."inputQuery") LIKE '% ' || LOWER(a."symbol") || ' %'
      OR LOWER(r."inputQuery") LIKE '% ' || LOWER(a."symbol")
    )
    GROUP BY a."symbol", a."name", a."type"
    ORDER BY "viewCount" DESC
    LIMIT 10
  `);

  const dau = Number(dauRows[0]?.count ?? 0);
  const wau = Number(wauRows[0]?.count ?? 0);
  const mau = Number(mauRows[0]?.count ?? 0);
  const firstValueActionUsers = Number(firstValueUsersInRangeRows[0]?.count ?? 0);
  const d7EligibleUsers = Number(d7EligibleUsersRows[0]?.count ?? 0);
  const d7ReturnedUsers = Number(d7ReturnedUsersRows[0]?.count ?? 0);
  const proActiveUsersCount = Number(proActiveUsers[0]?.count ?? 0);
  const proEliteIntentUsersCount = Number(proUsersWithEliteIntent[0]?.count ?? 0);
  const eliteUpgradesDetectedCount = Number(eliteUpgradesDetected[0]?.count ?? 0);
  const onboardingCompletionRateInRange =
    signedUpInRange > 0 ? Number(((onboardedInRange / signedUpInRange) * 100).toFixed(2)) : 0;
  const firstValueActionRate =
    signedUpInRange > 0 ? Number(((firstValueActionUsers / signedUpInRange) * 100).toFixed(2)) : 0;
  const d7RetentionRate =
    d7EligibleUsers > 0 ? Number(((d7ReturnedUsers / d7EligibleUsers) * 100).toFixed(2)) : 0;

  const experimentDefaults = {
    control: {
      cohortUsers: 0,
      onboardingCompletionRate: 0,
      firstValueActionRate: 0,
      d7RetentionRate: 0,
    },
    treatment: {
      cohortUsers: 0,
      onboardingCompletionRate: 0,
      firstValueActionRate: 0,
      d7RetentionRate: 0,
    },
  };

  const beginnerExperimentComparison = beginnerExperimentRows.reduce(
    (acc, row) => {
      const cohortUsers = Number(row.cohortUsers ?? 0);
      const onboardedUsers = Number(row.onboardedUsers ?? 0);
      const firstValueUsers = Number(row.firstValueUsers ?? 0);
      const d7Eligible = Number(row.d7EligibleUsers ?? 0);
      const d7Returned = Number(row.d7ReturnedUsers ?? 0);

      acc[row.variant] = {
        cohortUsers,
        onboardingCompletionRate: cohortUsers > 0 ? Number(((onboardedUsers / cohortUsers) * 100).toFixed(2)) : 0,
        firstValueActionRate: cohortUsers > 0 ? Number(((firstValueUsers / cohortUsers) * 100).toFixed(2)) : 0,
        d7RetentionRate: d7Eligible > 0 ? Number(((d7Returned / d7Eligible) * 100).toFixed(2)) : 0,
      };

      return acc;
    },
    experimentDefaults,
  );

  const result = {
    selectedRange: range,
    selectedRangeDays,
    assetTypeDistribution,
    topViewedAssets: topAssets.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      type: r.type,
      viewCount: Number(r.viewCount),
    })),
    discoveryItemCount,
    watchlistItemCount,
    onboardingCompletionRate: totalPrefs > 0
      ? Math.round((onboardingStats._count._all / totalPrefs) * 100)
      : 0,
    regionDistribution,
    experienceLevelDistribution,
    activationFunnel: {
      signedUp: signedUpInRange,
      onboarded: onboardedInRange,
      withAiRequest: Number(withAiRequestInRange[0]?.count ?? 0),
      withWatchlist: Number(withWatchlistInRange[0]?.count ?? 0),
      timeToFirstAiMedianMinutes: Number(firstAiLagMedian[0]?.medianMinutes ?? 0),
    },
    retention: {
      dau,
      wau,
      mau,
      dauWauStickiness: wau > 0 ? Number(((dau / wau) * 100).toFixed(2)) : 0,
      wauMauStickiness: mau > 0 ? Number(((wau / mau) * 100).toFixed(2)) : 0,
    },
    cohortRetention: cohortRetentionRows.map((r) => ({
      cohortWeek: r.cohortWeek,
      cohortSize: Number(r.cohortSize),
      week1Retention: Number(r.week1Retention ?? 0),
      week2Retention: Number(r.week2Retention ?? 0),
      week4Retention: Number(r.week4Retention ?? 0),
    })),
    sectionEngagement: sectionEngagementRows.map((r) => ({
      section: r.section,
      activeUsers: Number(r.activeUsers),
      requests: Number(r.requests),
      totalActiveMinutes: Number(r.totalActiveMinutes ?? 0),
      avgActiveMinutesPerUser: Number(r.avgActiveMinutesPerUser ?? 0),
      avgRequestsPerUser: Number(r.avgRequestsPerUser ?? 0),
    })),
    intentDistribution: intentDistributionRows.map((r) => ({
      intent: r.intent,
      count: Number(r.count),
    })),
    upgradeSignals14d: {
      proUsers,
      proActiveUsers: proActiveUsersCount,
      proUsersWithEliteIntent: proEliteIntentUsersCount,
      eliteUpgradesDetected: eliteUpgradesDetectedCount,
      estimatedUpgradeRateFromActivePro:
        proActiveUsersCount > 0
          ? Number(((eliteUpgradesDetectedCount / proActiveUsersCount) * 100).toFixed(2))
          : 0,
    },
    topUsersByActiveTime: topUsersByActiveTimeRows.map((r) => ({
      userId: r.userId,
      email: r.email,
      plan: r.plan,
      requests: Number(r.requests),
      activeMinutes: Number(r.activeMinutes ?? 0),
      topSection: r.topSection,
    })),
    beginnerKpis: {
      cohortUsers: signedUpInRange,
      onboardingCompletionRate: onboardingCompletionRateInRange,
      firstValueActionUsers,
      firstValueActionRate,
      d7EligibleUsers,
      d7ReturnedUsers,
      d7RetentionRate,
    },
    beginnerExperimentComparison,
    upgradeCtaExperiment,
    shareSheetEngagement,
    tierDistribution: tierDistributionRows.map((r) => ({
      tier: r.tier,
      count: Number(r.count),
      requests: Number(r.requests),
    })),
    complexityDistribution: complexityDistributionRows.map((r) => ({
      complexity: r.complexity,
      count: Number(r.count),
      requests: Number(r.requests),
    })),
    tierComplexityMatrix: tierComplexityMatrixRows.map((r) => ({
      tier: r.tier,
      complexity: r.complexity,
      count: Number(r.count),
    })),
  };

  await setCache(cacheKey, result, 30).catch((err) => {
    logger.debug({ err }, "Failed to cache admin stats (non-critical)");
  });
  return result;
}

// ─── Engines ────────────────────────────────────────────────────────────────

export async function getEngineStats(): Promise<EngineStats> {
  const [scoreDistributions, compatibilityDist, assetCoverage] = await Promise.all([
    prisma.$queryRaw<
      { type: string; avg: number; min: number; max: number; count: bigint }[]
    >(Prisma.sql`
      SELECT s."type"::text,
             ROUND(AVG(s."value")::numeric, 2) as avg,
             ROUND(MIN(s."value")::numeric, 2) as min,
             ROUND(MAX(s."value")::numeric, 2) as max,
             COUNT(DISTINCT s."assetId")::bigint as count
      FROM "AssetScore" s
      WHERE s."date"::date = (
        SELECT MAX("date"::date) FROM "AssetScore" WHERE "type" = s."type"
      )
      GROUP BY s."type"
    `),
    prisma.$queryRaw<{ label: string; count: bigint; avgScore: number }[]>(Prisma.sql`
      SELECT "compatibilityLabel" as label,
             COUNT(*)::bigint as count,
             ROUND(AVG("compatibilityScore")::numeric, 2) as "avgScore"
      FROM "Asset"
      WHERE "compatibilityLabel" IS NOT NULL
      GROUP BY "compatibilityLabel"
      ORDER BY "avgScore" DESC
    `),
    prisma.$queryRaw<
      { type: string; total: bigint; withScores: bigint; withSignalStrength: bigint }[]
    >(Prisma.sql`
      WITH scored_assets AS (
        SELECT DISTINCT "assetId"
        FROM "AssetScore"
      )
      SELECT a."type"::text,
             COUNT(*)::bigint as total,
             COUNT(sa."assetId")::bigint as "withScores",
             COUNT(CASE WHEN a."signalStrength" IS NOT NULL THEN 1 END)::bigint as "withSignalStrength"
      FROM "Asset" a
      LEFT JOIN scored_assets sa ON sa."assetId" = a."id"
      GROUP BY a."type"
    `),
  ]);

  return {
    scoreDistributions: scoreDistributions.map((r) => ({
      type: r.type,
      avg: Number(r.avg),
      min: Number(r.min),
      max: Number(r.max),
      count: Number(r.count),
    })),
    compatibilityDistribution: compatibilityDist.map((r) => ({
      label: r.label,
      count: Number(r.count),
      avgScore: Number(r.avgScore),
    })),
    assetCoverage: assetCoverage.map((r) => ({
      type: r.type,
      total: Number(r.total),
      withScores: Number(r.withScores),
      withSignalStrength: Number(r.withSignalStrength),
    })),
  };
}

// ─── Regime ─────────────────────────────────────────────────────────────────

export async function getRegimeStats(): Promise<RegimeStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [currentRegime, regimeHistory, latestRegimeWithContext, latestRegimeWithMetrics] = await Promise.all([
    prisma.marketRegime.findFirst({
      where: { assetId: null },
      orderBy: { date: "desc" },
      select: { state: true, breadthScore: true, vixValue: true, date: true, region: true },
    }),
    prisma.marketRegime.findMany({
      where: { assetId: null, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "asc" },
      select: { date: true, state: true, breadthScore: true, region: true },
      take: 60,
    }),
    // Replaces stale MultiHorizonRegime — read freshest valid JSON row from MarketRegime
    prisma.marketRegime.findFirst({
      where: { context: { startsWith: "{" } },
      orderBy: { date: "desc" },
      select: { date: true, context: true, region: true },
    }),
    prisma.marketRegime.findFirst({
      where: { assetId: null },
      orderBy: { date: "desc" },
      select: { correlationMetrics: true },
    }),
  ]);

  // Parse the freshest valid JSON context for the multiHorizon-shaped response
  let multiHorizon: RegimeStats["multiHorizon"] = null;
  if (latestRegimeWithContext?.context) {
    const ctx = safeJsonParse(latestRegimeWithContext.context);
    if (ctx) {
      multiHorizon = {
        date: latestRegimeWithContext.date,
        current: ctx,
        shortTerm: ctx,
        mediumTerm: ctx,
        longTerm: ctx,
        transitionProbability: 0,
        transitionDirection: "STABLE",
        region: latestRegimeWithContext.region,
      };
    }
  }

  // Count regime transitions in last 30 days
  let transitionCount30d = 0;
  for (let i = 1; i < regimeHistory.length; i++) {
    if (regimeHistory[i].state !== regimeHistory[i - 1].state) {
      transitionCount30d++;
    }
  }

  // Read real cross-sector correlation from MarketRegime.correlationMetrics.crossSector
  let crossSectorCorrelation: { regime: string; dispersion: number; trend: number } | null = null;
  try {
    const metrics = latestRegimeWithMetrics?.correlationMetrics as Record<string, unknown> | null;
    const cs = metrics?.crossSector as Record<string, unknown> | undefined;
    if (cs) {
      crossSectorCorrelation = {
        regime: (cs.regime as string) ?? currentRegime?.state ?? "NEUTRAL",
        dispersion: typeof cs.dispersion === "number" ? cs.dispersion : 50,
        trend: typeof cs.avgCorrelation === "number" ? cs.avgCorrelation * 100 : (currentRegime?.breadthScore ?? 50),
      };
    }
  } catch {
    // fallback: null
  }

  return {
    currentRegime,
    regimeHistory,
    multiHorizon,
    transitionCount30d,
    crossSectorCorrelation,
  };
}

// ─── Infrastructure ─────────────────────────────────────────────────────────

export async function getInfraStats(): Promise<InfraStats> {
  let cacheStats: InfraStats["cacheStats"] = null;
  let redisInfo: Record<string, string> | null = null;

  try {
    if (redis) {
      const stats = (await redis.hgetall("cache:stats")) as Record<string, string> | null;
      if (stats && Object.keys(stats).length > 0) {
        const hits = parseInt(stats.hits || stats.hit || "0", 10);
        const misses = parseInt(stats.misses || stats.miss || "0", 10);
        const total = hits + misses;
        cacheStats = {
          hits,
          misses,
          hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
        };
      }

      if (typeof (redis as unknown as { info?: () => Promise<string> }).info === "function") {
        const info = await (redis as unknown as { info: () => Promise<string> }).info();
        const lines = info.split("\r\n");
        const infoMap: Record<string, string> = {};
        for (const line of lines) {
          const [key, val] = line.split(":");
          if (key && val) infoMap[key] = val;
        }
        redisInfo = {
          used_memory_human: infoMap.used_memory_human || "N/A",
          maxmemory_human: infoMap.maxmemory_human || "N/A",
          connected_clients: infoMap.connected_clients || "N/A",
        };
      } else {
        redisInfo = {
          used_memory_human: "N/A",
          maxmemory_human: "N/A",
          connected_clients: "N/A",
        };
      }
    }
  } catch {
    // Redis may not be available
  }

  const [userCount, assetCount, aiLogCount, priceHistoryCount, eventCount, aiRequestLogStatus, assetScoreCount, watchlistCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.asset.count(),
      prisma.aIRequestLog.count(),
      prisma.priceHistory.count(),
      prisma.institutionalEvent.count(),
      prisma.aIRequestLog.groupBy({
        by: ["embeddingStatus"],
        _count: true,
      }),
      prisma.assetScore.count(),
      prisma.watchlistItem.count(),
    ]);

  // Process embedding status counts
  const aiRequestLogMap: Record<string, number> = {};
  for (const row of aiRequestLogStatus) {
    aiRequestLogMap[row.embeddingStatus] = row._count;
  }

  const embeddingPipelineHealth = {
    knowledgeDocs: {
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
    },
    aiRequestLogs: {
      pending: aiRequestLogMap.PENDING ?? 0,
      processing: aiRequestLogMap.PROCESSING ?? 0,
      done: aiRequestLogMap.DONE ?? 0,
      failed: aiRequestLogMap.FAILED ?? 0,
    },
  };

  return {
    cacheStats,
    redisInfo,
    dbTableCounts: {
      users: userCount,
      assets: assetCount,
      aiRequestLogs: aiLogCount,
      priceHistory: priceHistoryCount,
      institutionalEvents: eventCount,
      assetScores: assetScoreCount,
      watchlistItems: watchlistCount,
    },
    recentSyncInfo: null,
    embeddingPipelineHealth,
  };
}

// ─── Users ──────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  plan: string;
  credits: number;
  createdAt: Date;
  aiRequestCount: number;
  totalTokens: number;
  watchlistCount: number;
  onboardingCompleted: boolean;
  region: string | null;
}

export interface UsersStats {
  users: UserRow[];
  totalCount: number;
  planBreakdown: Record<string, number>;
}

export async function getUsersStats(page = 1, pageSize = 50): Promise<UsersStats> {
  const skip = (page - 1) * pageSize;

  const [totalCount, planCounts, rawUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["plan"], _count: true }),
    prisma.$queryRaw<
      {
        id: string;
        email: string;
        plan: string;
        credits: bigint;
        createdAt: Date;
        aiRequestCount: bigint;
        totalTokens: bigint;
        watchlistCount: bigint;
        onboardingCompleted: boolean;
        region: string | null;
      }[]
    >(Prisma.sql`
      SELECT
        u."id", u."email", u."plan"::text, u."credits"::bigint AS "credits", u."createdAt",
        COALESCE(ai.cnt, 0)::bigint AS "aiRequestCount",
        COALESCE(ai.tokens, 0)::bigint AS "totalTokens",
        COALESCE(wl.cnt, 0)::bigint AS "watchlistCount",
        COALESCE(up."onboardingCompleted", false) AS "onboardingCompleted",
        up."preferredRegion"::text AS "region"
      FROM "User" u
      LEFT JOIN (
        SELECT "userId", COUNT(*)::bigint AS cnt, COALESCE(SUM("tokensUsed"), 0)::bigint AS tokens
        FROM "AIRequestLog" GROUP BY "userId"
      ) ai ON ai."userId" = u."id"
      LEFT JOIN (
        SELECT "userId", COUNT(*)::bigint AS cnt FROM "WatchlistItem" GROUP BY "userId"
      ) wl ON wl."userId" = u."id"
      LEFT JOIN "UserPreference" up ON up."userId" = u."id"
      ORDER BY u."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `),
  ]);

  const planBreakdown: Record<string, number> = {};
  for (const row of planCounts) {
    planBreakdown[row.plan] = row._count;
  }

  return {
    users: rawUsers.map((r) => ({
      id: r.id,
      email: r.email,
      plan: r.plan,
      credits: Number(r.credits),
      createdAt: r.createdAt,
      aiRequestCount: Number(r.aiRequestCount),
      totalTokens: Number(r.totalTokens),
      watchlistCount: Number(r.watchlistCount),
      onboardingCompleted: r.onboardingCompleted,
      region: r.region,
    })),
    totalCount,
    planBreakdown,
  };
}

// ─── Growth ─────────────────────────────────────────────────────────────────

export interface GrowthStats {
  selectedRange: UsageRange;
  selectedRangeDays: number;
  signupsByWeek: { week: string; count: number }[];
  signupsByMonth: { month: string; count: number }[];
  planConversions: { fromPlan: string; toPlan: string; count: number }[];
  onboardingFunnel: {
    totalUsers: number;
    withPreferences: number;
    onboardingCompleted: number;
    withAIRequest: number;
    withWatchlist: number;
  };
  retentionProxy: {
    activeLastDay: number;
    activeLast7d: number;
    activeLast30d: number;
    totalUsers: number;
  };
  beginnerKpis: {
    cohortWindowDays: number;
    cohortUsers: number;
    onboardingCompletionRate: number;
    firstValueActionUsers: number;
    firstValueActionRate: number;
    d7EligibleUsers: number;
    d7ReturnedUsers: number;
    d7RetentionRate: number;
  };
  viralStats: {
    totalReferrals: number;
    activatedReferrals: number;
    completedReferrals: number;
    kFactor: number;
    referralConversionRate: number;
    convertedReferrals: number;
    referredUsersInRange: number;
    newReferralsInRange: number;
  };
}

export async function getGrowthStats(range: UsageRange = "30d"): Promise<GrowthStats> {
  const now = new Date();
  const selectedRangeDays = USAGE_RANGE_DAYS[range];
  const selectedRangeStart = new Date(now.getTime() - selectedRangeDays * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    signupsByWeek,
    signupsByMonth,
    totalUsers,
    withPreferences,
    onboardingCompleted,
    withAIRequest,
    withWatchlist,
    activeLastDay,
    activeLast7d,
    activeLast30d,
    signupsInRange,
    onboardingCompletedInRange,
    firstValueUsersInRange,
    d7EligibleUsers,
    d7ReturnedUsers,
    referralCounts,
    referredUsersInRange,
    referredPaidUsersInRange,
    newReferralsInRange,
  ] = await Promise.all([
    prisma.$queryRaw<{ week: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week,
             COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
      GROUP BY date_trunc('week', "createdAt")
      ORDER BY week
    `),
    prisma.$queryRaw<{ month: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char("createdAt", 'YYYY-MM') AS month,
             COUNT(*)::bigint AS count
      FROM "User"
      GROUP BY to_char("createdAt", 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `),
    prisma.user.count(),
    prisma.userPreference.count(),
    prisma.userPreference.count({ where: { onboardingCompleted: true } }),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "AIRequestLog"
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "WatchlistItem"
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "AIRequestLog"
      WHERE "createdAt" >= ${oneDayAgo}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "AIRequestLog"
      WHERE "createdAt" >= ${sevenDaysAgo}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "AIRequestLog"
      WHERE "createdAt" >= ${thirtyDaysAgo}
    `),
    prisma.user.count({ where: { createdAt: { gte: selectedRangeStart } } }),
    prisma.userPreference.count({
      where: {
        onboardingCompleted: true,
        onboardingCompletedAt: { gte: selectedRangeStart },
      },
    }),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT u."id")::bigint AS count
      FROM "User" u
      WHERE u."createdAt" >= ${selectedRangeStart}
        AND (
          EXISTS (
            SELECT 1
            FROM "AIRequestLog" r
            WHERE r."userId" = u."id"
          )
          OR EXISTS (
            SELECT 1
            FROM "WatchlistItem" w
            WHERE w."userId" = u."id"
          )
        )
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= ${fourteenDaysAgo}
        AND "createdAt" < ${sevenDaysAgo}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "User" u
      WHERE u."createdAt" >= ${fourteenDaysAgo}
        AND u."createdAt" < ${sevenDaysAgo}
        AND (
          EXISTS (
            SELECT 1
            FROM "AIRequestLog" r
            WHERE r."userId" = u."id"
              AND r."createdAt" >= (u."createdAt" + INTERVAL '7 day')
              AND r."createdAt" < (u."createdAt" + INTERVAL '8 day')
          )
          OR EXISTS (
            SELECT 1
            FROM "WatchlistItem" w
            WHERE w."userId" = u."id"
              AND w."createdAt" >= (u."createdAt" + INTERVAL '7 day')
              AND w."createdAt" < (u."createdAt" + INTERVAL '8 day')
          )
        )
    `),
    prisma.referral.groupBy({ by: ["status"], _count: true }),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT r."refereeId")::bigint AS count
      FROM "Referral" r
      WHERE r."createdAt" >= ${selectedRangeStart}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT u."id")::bigint AS count
      FROM "Referral" r
      JOIN "User" u ON u."id" = r."refereeId"
      WHERE r."createdAt" >= ${selectedRangeStart}
        AND u."plan" IN ('PRO', 'ELITE', 'ENTERPRISE')
    `),
    prisma.referral.count({ where: { createdAt: { gte: selectedRangeStart } } }),
  ]);

  const firstValueActionUsers = Number(firstValueUsersInRange[0]?.count ?? 0);
  const d7Eligible = Number(d7EligibleUsers[0]?.count ?? 0);
  const d7Returned = Number(d7ReturnedUsers[0]?.count ?? 0);
  const onboardingCompletionRate =
    signupsInRange > 0 ? Number(((onboardingCompletedInRange / signupsInRange) * 100).toFixed(2)) : 0;
  const firstValueActionRate =
    signupsInRange > 0 ? Number(((firstValueActionUsers / signupsInRange) * 100).toFixed(2)) : 0;
  const d7RetentionRate = d7Eligible > 0 ? Number(((d7Returned / d7Eligible) * 100).toFixed(2)) : 0;

  // Viral stats from referral counts
  const referralMap: Record<string, number> = {};
  for (const row of referralCounts) referralMap[row.status] = row._count;
  const totalReferrals = Object.values(referralMap).reduce((a, b) => a + b, 0);
  const activatedReferrals = referralMap.ACTIVATED ?? 0;
  const completedReferrals = referralMap.COMPLETED ?? 0;
  const referredUsersInRangeCount = Number(referredUsersInRange[0]?.count ?? 0);
  const referredPaidUsersInRangeCount = Number(referredPaidUsersInRange[0]?.count ?? 0);
  const kFactor = signupsInRange > 0 ? Number((referredUsersInRangeCount / signupsInRange).toFixed(2)) : 0;
  const referralConversionRate = referredUsersInRangeCount > 0
    ? Number(((referredPaidUsersInRangeCount / referredUsersInRangeCount) * 100).toFixed(1))
    : 0;

  return {
    selectedRange: range,
    selectedRangeDays,
    signupsByWeek: signupsByWeek.map((r) => ({ week: r.week, count: Number(r.count) })),
    signupsByMonth: [...signupsByMonth].reverse().map((r) => ({ month: r.month, count: Number(r.count) })),
    planConversions: [],
    onboardingFunnel: {
      totalUsers,
      withPreferences,
      onboardingCompleted,
      withAIRequest: Number(withAIRequest[0]?.count ?? 0),
      withWatchlist: Number(withWatchlist[0]?.count ?? 0),
    },
    retentionProxy: {
      activeLastDay: Number(activeLastDay[0]?.count ?? 0),
      activeLast7d: Number(activeLast7d[0]?.count ?? 0),
      activeLast30d: Number(activeLast30d[0]?.count ?? 0),
      totalUsers,
    },
    viralStats: {
      totalReferrals,
      activatedReferrals,
      completedReferrals,
      kFactor,
      referralConversionRate,
      convertedReferrals: referredPaidUsersInRangeCount,
      referredUsersInRange: referredUsersInRangeCount,
      newReferralsInRange,
    },
    beginnerKpis: {
      cohortWindowDays: selectedRangeDays,
      cohortUsers: signupsInRange,
      onboardingCompletionRate,
      firstValueActionUsers,
      firstValueActionRate,
      d7EligibleUsers: d7Eligible,
      d7ReturnedUsers: d7Returned,
      d7RetentionRate,
    },
  };
}

// ─── Myra Support Stats ─────────────────────────────────────────────────────

export interface MyraStats {
  totalConversations: number;
  openConversations: number;
  resolvedConversations: number;
  pendingConversations: number;
  totalMessages: number;
  aiAutoReplies: number;
  agentReplies: number;
  userMessages: number;
  avgMessagesPerConversation: number;
  aiAutoReplyRate: number;
  conversationsByPlan: { plan: string; count: number }[];
  conversationsByDay: { date: string; count: number }[];
  avgResolutionMinutes: number;
  unreadMessages: number;
}

export async function getMyraStats(): Promise<MyraStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    statusCounts,
    messageCounts,
    byPlan,
    byDay,
    avgResolution,
    unreadCount,
  ] = await Promise.all([
    prisma.supportConversation.groupBy({ by: ["status"], _count: true }),
    prisma.$queryRaw<{ senderRole: string; senderId: string; count: bigint }[]>(Prisma.sql`
      SELECT sm."senderRole"::text, sm."senderId", COUNT(*)::bigint as count
      FROM "SupportMessage" sm
      GROUP BY sm."senderRole", sm."senderId"
    `),
    prisma.$queryRaw<{ plan: string; count: bigint }[]>(Prisma.sql`
      SELECT sc."plan"::text as plan, COUNT(*)::bigint as count
      FROM "SupportConversation" sc
      GROUP BY sc."plan"
      ORDER BY count DESC
    `),
    prisma.$queryRaw<{ date: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char("createdAt", 'YYYY-MM-DD') as date, COUNT(*)::bigint as count
      FROM "SupportConversation"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY to_char("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `),
    prisma.$queryRaw<{ avgMinutes: number | null }[]>(Prisma.sql`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 60.0)::numeric, 2) AS "avgMinutes"
      FROM "SupportConversation"
      WHERE "closedAt" IS NOT NULL
    `),
    prisma.supportMessage.count({ where: { readAt: null, senderRole: "USER" } }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) statusMap[row.status] = row._count;

  const totalConversations = Object.values(statusMap).reduce((a, b) => a + b, 0);

  let totalMessages = 0;
  let aiAutoReplies = 0;
  let agentReplies = 0;
  let userMessages = 0;
  for (const row of messageCounts) {
    const count = Number(row.count);
    totalMessages += count;
    if (row.senderRole === "USER") userMessages += count;
    else if (row.senderId === "AI_ASSISTANT") aiAutoReplies += count;
    else agentReplies += count;
  }

  return {
    totalConversations,
    openConversations: statusMap.OPEN ?? 0,
    resolvedConversations: statusMap.RESOLVED ?? 0,
    pendingConversations: statusMap.PENDING ?? 0,
    totalMessages,
    aiAutoReplies,
    agentReplies,
    userMessages,
    avgMessagesPerConversation: totalConversations > 0
      ? Number((totalMessages / totalConversations).toFixed(2))
      : 0,
    aiAutoReplyRate: (aiAutoReplies + agentReplies) > 0
      ? Number(((aiAutoReplies / (aiAutoReplies + agentReplies)) * 100).toFixed(2))
      : 0,
    conversationsByPlan: byPlan.map((r) => ({ plan: r.plan, count: Number(r.count) })),
    conversationsByDay: byDay.map((r) => ({ date: r.date, count: Number(r.count) })),
    avgResolutionMinutes: Number(avgResolution[0]?.avgMinutes ?? 0),
    unreadMessages: unreadCount,
  };
}

// ─── Credits Stats ───────────────────────────────────────────────────────────

export interface CreditStats {
  totalTransactions: number;
  totalCreditsIssued: number;
  totalCreditsSpent: number;
  totalCreditsPurchased: number;
  totalCreditsFromSubscription: number;
  totalCreditsFromReferral: number;
  totalCreditsBonus: number;
  usersWithTransactions: number;
  avgCreditsSpentPerUser: number;
  liveActiveBalances: {
    total: number;
    monthly: number;
    bonus: number;
    purchased: number;
  };
  expiringNext30Days: {
    total: number;
    bonus: number;
    purchased: number;
    lots: number;
  };
  transactionsByType: { type: string; count: number; totalAmount: number }[];
  spendByDay: { date: string; spent: number; issued: number }[];
  topSpenders: { userId: string; email: string; plan: string; spent: number; balance: number }[];
  creditPackages: { name: string; credits: number; priceUsd: number; isActive: boolean }[];
  referralStats: {
    totalReferrals: number;
    activatedReferrals: number;
    completedReferrals: number;
    activationRate: number;
  };
}

export async function getCreditStats(): Promise<CreditStats> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    txByType,
    spendByDay,
    topSpenders,
    packages,
    referralCounts,
    usersWithTransactionsResult,
    activeLotsByBucket,
    expiringLotsByBucket,
  ] = await Promise.all([
    prisma.$queryRaw<{ type: string; count: bigint; totalAmount: bigint }[]>(Prisma.sql`
      SELECT "type"::text, COUNT(*)::bigint as count, COALESCE(SUM("amount"), 0)::bigint as "totalAmount"
      FROM "CreditTransaction"
      GROUP BY "type"
      ORDER BY count DESC
    `),
    prisma.$queryRaw<{ date: string; spent: bigint; issued: bigint }[]>(Prisma.sql`
      SELECT
        to_char("createdAt", 'YYYY-MM-DD') as date,
        COALESCE(SUM(CASE WHEN "amount" < 0 THEN ABS("amount") ELSE 0 END), 0)::bigint as spent,
        COALESCE(SUM(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END), 0)::bigint as issued
      FROM "CreditTransaction"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY to_char("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `),
    prisma.$queryRaw<{ userId: string; email: string; plan: string; spent: bigint; balance: bigint }[]>(Prisma.sql`
      SELECT
        u."id" as "userId",
        u."email",
        u."plan"::text as plan,
        COALESCE(SUM(CASE WHEN ct."amount" < 0 THEN ABS(ct."amount") ELSE 0 END), 0)::bigint as spent,
        u."credits"::bigint as balance
      FROM "User" u
      JOIN "CreditTransaction" ct ON ct."userId" = u."id"
      GROUP BY u."id", u."email", u."plan", u."credits"
      ORDER BY spent DESC
      LIMIT 15
    `),
    prisma.creditPackage.findMany({
      orderBy: { sortOrder: "asc" },
      select: { name: true, credits: true, bonusCredits: true, priceUsd: true, isActive: true },
    }),
    prisma.referral.groupBy({ by: ["status"], _count: true }),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::bigint as count
      FROM "CreditTransaction"
    `),
    prisma.creditLot.groupBy({
      by: ["bucket"],
      where: {
        remainingAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      _sum: { remainingAmount: true },
    }),
    prisma.creditLot.groupBy({
      by: ["bucket"],
      where: {
        remainingAmount: { gt: 0 },
        expiresAt: { gt: now, lte: thirtyDaysFromNow },
      },
      _sum: { remainingAmount: true },
      _count: { _all: true },
    }),
  ]);

  const typeMap: Record<string, { count: number; totalAmount: number }> = {};
  let totalCreditsIssued = 0;
  let totalCreditsSpent = 0;
  let totalCreditsPurchased = 0;
  let totalCreditsFromSubscription = 0;
  let totalCreditsFromReferral = 0;
  let totalCreditsBonus = 0;
  let totalTransactions = 0;

  for (const row of txByType) {
    const count = Number(row.count);
    const amount = Number(row.totalAmount);
    typeMap[row.type] = { count, totalAmount: amount };
    totalTransactions += count;
    if (amount > 0) totalCreditsIssued += amount;
    else totalCreditsSpent += Math.abs(amount);
    if (row.type === "PURCHASE") totalCreditsPurchased += amount;
    if (row.type === "SUBSCRIPTION_MONTHLY") totalCreditsFromSubscription += amount;
    if (row.type === "REFERRAL_BONUS" || row.type === "REFERRAL_REDEEMED") totalCreditsFromReferral += amount;
    if (row.type === "BONUS") totalCreditsBonus += amount;
  }

  const usersWithTransactions = Number(usersWithTransactionsResult[0]?.count ?? 0);
  const avgCreditsSpentPerUser = usersWithTransactions > 0
    ? Number((totalCreditsSpent / usersWithTransactions).toFixed(2))
    : 0;

  const referralMap: Record<string, number> = {};
  for (const row of referralCounts) referralMap[row.status] = row._count;
  const totalReferrals = Object.values(referralMap).reduce((a, b) => a + b, 0);
  const activatedReferrals = referralMap.ACTIVATED ?? 0;
  const completedReferrals = referralMap.COMPLETED ?? 0;
  const liveBalanceMap = activeLotsByBucket.reduce<Record<string, number>>((acc: Record<string, number>, row: { bucket: string; _sum: { remainingAmount: number | null } }) => {
    acc[row.bucket] = Number(row._sum.remainingAmount ?? 0);
    return acc;
  }, {});
  const expiringBalanceMap = expiringLotsByBucket.reduce<Record<string, number>>((acc: Record<string, number>, row: { bucket: string; _sum: { remainingAmount: number | null }; _count: { _all: number } }) => {
    acc[row.bucket] = Number(row._sum.remainingAmount ?? 0);
    return acc;
  }, {});
  const expiringLotsCount = expiringLotsByBucket.reduce((sum: number, row: { _count: { _all: number } }) => sum + row._count._all, 0);

  return {
    totalTransactions,
    totalCreditsIssued,
    totalCreditsSpent,
    totalCreditsPurchased,
    totalCreditsFromSubscription,
    totalCreditsFromReferral,
    totalCreditsBonus,
    usersWithTransactions,
    avgCreditsSpentPerUser,
    liveActiveBalances: {
      total: Object.values(liveBalanceMap).reduce((sum: number, value) => sum + Number(value), 0),
      monthly: liveBalanceMap.MONTHLY ?? 0,
      bonus: liveBalanceMap.BONUS ?? 0,
      purchased: liveBalanceMap.PURCHASED ?? 0,
    },
    expiringNext30Days: {
      total: Object.values(expiringBalanceMap).reduce((sum: number, value) => sum + Number(value), 0),
      bonus: expiringBalanceMap.BONUS ?? 0,
      purchased: expiringBalanceMap.PURCHASED ?? 0,
      lots: expiringLotsCount,
    },
    transactionsByType: Object.entries(typeMap).map(([type, v]) => ({
      type,
      count: v.count,
      totalAmount: v.totalAmount,
    })),
    spendByDay: spendByDay.map((r: { date: string; spent: bigint; issued: bigint }) => ({
      date: r.date,
      spent: Number(r.spent),
      issued: Number(r.issued),
    })),
    topSpenders: topSpenders.map((r: { userId: string; email: string; plan: string; spent: bigint; balance: bigint }) => ({
      userId: r.userId,
      email: r.email,
      plan: r.plan,
      spent: Number(r.spent),
      balance: Number(r.balance),
    })),
    creditPackages: packages.map((p: { name: string; credits: number; bonusCredits: number; priceUsd: number; isActive: boolean }) => ({
      name: p.name,
      credits: p.credits + p.bonusCredits,
      priceUsd: p.priceUsd,
      isActive: p.isActive,
    })),
    referralStats: {
      totalReferrals,
      activatedReferrals,
      completedReferrals,
      activationRate: totalReferrals > 0
        ? Number((((activatedReferrals + completedReferrals) / totalReferrals) * 100).toFixed(2))
        : 0,
    },
  };
}

// ─── Billing ────────────────────────────────────────────────────────────────

export interface BillingStats {
  activeSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  subscriptionsByPlan: { plan: string; count: number }[];
  recentCancellations: {
    id: string;
    userId: string;
    plan: string;
    provider: string;
    updatedAt: Date;
  }[];
  recentLogs: {
    id: string;
    timestamp: Date;
    userId: string;
    eventType: string;
    previousState: string | null;
    newState: string;
    amount: number | null;
    currency: string | null;
    stripeObjectId: string | null;
    user: { email: string; plan: string } | null;
  }[];
  paymentEventsByType: Record<string, number>;
  monthlyPaymentEvents: { month: string; count: number }[];
  churnRate: number;
}

export async function getBillingStats(): Promise<BillingStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    statusCounts,
    subsByPlan,
    recentCancellations,
    eventsByType,
    monthlyEvents,
    activeStart,
    canceledInPeriod,
    recentLogs,
  ] = await Promise.all([
    prisma.subscription.groupBy({ by: ["status"], _count: true }),
    prisma.subscription.groupBy({
      by: ["plan"],
      _count: true,
      where: { status: "ACTIVE" },
    }),
    prisma.subscription.findMany({
      where: { status: "CANCELED" },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: {
        id: true,
        userId: true,
        plan: true,
        provider: true,
        updatedAt: true,
      },
    }),
    prisma.paymentEvent.groupBy({ by: ["eventType"], _count: true }),
    prisma.$queryRaw<{ month: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char("processedAt", 'YYYY-MM') AS month,
             COUNT(*)::bigint AS count
      FROM "PaymentEvent"
      GROUP BY to_char("processedAt", 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `),
    // For churn rate: active subs at start of period
    prisma.subscription.count({
      where: {
        OR: [
          { status: "ACTIVE" },
          { status: "CANCELED", updatedAt: { gte: thirtyDaysAgo } },
        ],
      },
    }),
    prisma.subscription.count({
      where: { status: "CANCELED", updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.billingAuditLog.findMany({
      take: 50,
      orderBy: { timestamp: "desc" },
      include: {
        user: {
          select: { email: true, plan: true },
        },
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) statusMap[row.status] = row._count;

  const eventTypeMap: Record<string, number> = {};
  for (const row of eventsByType) eventTypeMap[row.eventType] = row._count;

  return {
    activeSubscriptions: statusMap.ACTIVE ?? 0,
    canceledSubscriptions: statusMap.CANCELED ?? 0,
    pastDueSubscriptions: statusMap.PAST_DUE ?? 0,
    subscriptionsByPlan: subsByPlan.map((r) => ({ plan: r.plan, count: r._count })),
    recentCancellations,
    recentLogs,
    paymentEventsByType: eventTypeMap,
    monthlyPaymentEvents: [...monthlyEvents].reverse().map((r) => ({
      month: r.month,
      count: Number(r.count),
    })),
    churnRate: activeStart > 0 ? Math.round((canceledInPeriod / activeStart) * 100) : 0,
  };
}
