/**
 * Portfolio Service — Orchestrates all 5 portfolio intelligence engines.
 * Called by on-demand API routes and the daily cron job.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { delCache } from "@/lib/redis";
import { dashboardHomeCachePrefix, portfolioAnalyticsCacheKey, portfolioHealthCacheKey } from "@/lib/cache-keys";
import { computePortfolioHealth, type HoldingInput } from "@/lib/engines/portfolio-health";
import { computePortfolioFragility, type FragilityHoldingInput } from "@/lib/engines/portfolio-fragility";
import { buildPortfolioIntelligence, type PortfolioIntelligenceResult } from "@/lib/engines/portfolio-intelligence";
import { formatRegime } from "@/lib/engines/portfolio-utils";

const logger = createLogger({ service: "portfolio-service" });

interface PortfolioWithHoldings {
  id: string;
  userId: string;
  region: string | null;
  holdings: {
    id: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    asset: {
      price: number | null;
      type: string;
      sector: string | null;
      avgVolatilityScore: number | null;
      avgLiquidityScore: number | null;
      avgTrustScore: number | null;
      avgSentimentScore: number | null;
      compatibilityScore: number | null;
      compatibilityLabel: string | null;
    };
  }[];
}

function buildHoldingInputs(portfolio: PortfolioWithHoldings): {
  healthInputs: HoldingInput[];
  fragilityInputs: FragilityHoldingInput[];
  pricedHoldings: PortfolioWithHoldings["holdings"];
} {
  const pricedHoldings = portfolio.holdings.filter((h) => h.asset.price !== null && h.asset.price > 0);
  const n = pricedHoldings.length;

  const totalValue = pricedHoldings.reduce((s, h) => s + h.quantity * (h.asset.price ?? 0), 0);

  const healthInputs: HoldingInput[] = [];
  const fragilityInputs: FragilityHoldingInput[] = [];

  for (const h of pricedHoldings) {
    const weight = totalValue > 0 ? (h.quantity * (h.asset.price ?? 0)) / totalValue : 1 / n;
    const base = {
      symbol: h.symbol,
      weight,
      avgVolatilityScore: h.asset.avgVolatilityScore,
      avgLiquidityScore: h.asset.avgLiquidityScore,
      avgTrustScore: h.asset.avgTrustScore,
      sector: h.asset.sector,
      type: h.asset.type,
    };
    healthInputs.push(base);
    fragilityInputs.push({ ...base, compatibilityScore: h.asset.compatibilityScore });
  }

  return { healthInputs, fragilityInputs, pricedHoldings };
}

function buildRiskMetrics(args: {
  pricedHoldings: PortfolioWithHoldings["holdings"];
  healthResult: ReturnType<typeof computePortfolioHealth>;
  fragilityResult: ReturnType<typeof computePortfolioFragility>;
  currentMarketRegime: string | null;
  portfolioIntelligence: PortfolioIntelligenceResult;
}) {
  const { pricedHoldings } = args;
  const totalValue = pricedHoldings.reduce((sum, holding) => sum + holding.quantity * (holding.asset.price ?? 0), 0);
  const compatibilityScores = pricedHoldings
    .map((holding) => holding.asset.compatibilityScore)
    .filter((score): score is number => typeof score === "number");
  const averageCompatibilityScore = compatibilityScores.length > 0
    ? compatibilityScores.reduce((sum, score) => sum + score, 0) / compatibilityScores.length
    : null;

  const weakestCompatibilityHoldings = pricedHoldings
    .map((holding) => ({
      symbol: holding.symbol,
      score: holding.asset.compatibilityScore ?? 100,
      value: holding.quantity * (holding.asset.price ?? 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const weakCompatibilityCount = weakestCompatibilityHoldings.filter((holding) => holding.score < 45).length;

  const sectorWeights = pricedHoldings.reduce<Record<string, number>>((acc, holding) => {
    const key = holding.asset.sector ?? holding.asset.type;
    acc[key] = (acc[key] ?? 0) + (holding.quantity * (holding.asset.price ?? 0));
    return acc;
  }, {});

  const dominantSectorEntry = Object.entries(sectorWeights)
    .sort((a, b) => b[1] - a[1])[0] ?? null;
  const dominantSector = dominantSectorEntry?.[0] ?? null;
  const concentrationWeight = dominantSectorEntry && totalValue > 0 ? (dominantSectorEntry[1] / totalValue) * 100 : null;

  let regimeMismatchLabel: string | null = null;
  let regimeMismatchReason: string | null = null;

  if (averageCompatibilityScore != null) {
    if (averageCompatibilityScore < 45) {
      regimeMismatchLabel = "High mismatch";
    } else if (averageCompatibilityScore < 60) {
      regimeMismatchLabel = "Moderate mismatch";
    } else if (averageCompatibilityScore >= 72) {
      regimeMismatchLabel = "Aligned";
    }
  }

  const formattedRegime = formatRegime(args.currentMarketRegime);

  if (regimeMismatchLabel === "High mismatch") {
    if (formattedRegime && weakestCompatibilityHoldings.length > 0) {
      regimeMismatchReason = `${weakestCompatibilityHoldings.map((holding) => holding.symbol).slice(0, 2).join(" and ")} look poorly aligned with the current ${formattedRegime} backdrop.`;
    } else if (formattedRegime) {
      regimeMismatchReason = `Several holdings look poorly aligned with the current ${formattedRegime} backdrop.`;
    } else {
      regimeMismatchReason = "Several holdings look poorly aligned with the current market backdrop.";
    }
  } else if (regimeMismatchLabel === "Moderate mismatch") {
    regimeMismatchReason = formattedRegime
      ? `Part of the portfolio still looks out of sync with the current ${formattedRegime} backdrop.`
      : "Part of the portfolio still looks out of sync with the current market backdrop.";
  } else if (regimeMismatchLabel === "Aligned") {
    regimeMismatchReason = formattedRegime
      ? `Most holdings still look compatible with the current ${formattedRegime} backdrop.`
      : "Most holdings still look compatible with the current market backdrop.";
  }

  return {
    fragilityComponents: args.fragilityResult.components,
    fragilityClassification: args.fragilityResult.classification,
    fragilityTopDrivers: args.fragilityResult.topDrivers,
    portfolioScore: args.portfolioIntelligence.score,
    portfolioScoreBand: args.portfolioIntelligence.band,
    portfolioScoreHeadline: args.portfolioIntelligence.headline,
    portfolioScoreBody: args.portfolioIntelligence.body,
    portfolioScoreAction: args.portfolioIntelligence.nextAction,
    portfolioScoreLabel: args.portfolioIntelligence.scoreLabel,
    portfolioScoreValue: args.portfolioIntelligence.scoreValue,
    portfolioScoreComponents: args.portfolioIntelligence.components,
    portfolioScoreSignals: args.portfolioIntelligence.signals,
    band: args.healthResult.band,
    holdingCount: args.healthResult.holdingCount,
    averageCompatibilityScore,
    weakCompatibilityCount,
    topCompatibilityDrag: weakestCompatibilityHoldings.map((holding) => holding.symbol),
    regimeMismatchLabel,
    regimeMismatchReason,
    currentMarketRegime: args.currentMarketRegime,
    dominantSector,
    concentrationWeight,
  } as const;
}

export async function computeAndStorePortfolioHealth(portfolioId: string): Promise<void> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      id: true,
      userId: true,
      region: true,
      holdings: {
        select: {
          id: true,
          symbol: true,
          quantity: true,
          avgPrice: true,
          asset: {
            select: {
              price: true,
              type: true,
              sector: true,
              avgVolatilityScore: true,
              avgLiquidityScore: true,
              avgTrustScore: true,
              avgSentimentScore: true,
              compatibilityScore: true,
              compatibilityLabel: true,
            },
          },
        },
      },
    },
  });

  if (!portfolio || portfolio.holdings.length === 0) {
    logger.warn({ portfolioId }, "Portfolio has no holdings — skipping health compute");
    return;
  }

  const { healthInputs, fragilityInputs, pricedHoldings } = buildHoldingInputs(portfolio);

  if (healthInputs.length === 0) {
    logger.warn({ portfolioId }, "No holdings with valid prices — skipping health compute");
    return;
  }

  const healthResult = computePortfolioHealth(healthInputs);
  const fragilityResult = computePortfolioFragility(fragilityInputs);

  // Fetch latest market regime; guard against the model being absent in test/preview envs.
  let latestMarketRegime: { state: string } | null = null;
  if (portfolio.region) {
    try {
      latestMarketRegime = await (prisma as unknown as {
        marketRegime: { findFirst: (args: unknown) => Promise<{ state: string } | null> };
      }).marketRegime.findFirst({
        where: { region: portfolio.region },
        orderBy: { date: "desc" },
        select: { state: true },
      });
    } catch (error) {
      // Model may not exist in all environments; silently skip.
      logger.debug({ err: error }, "MarketRegime model not available, skipping regime state");
    }
  }
  const portfolioIntelligence = buildPortfolioIntelligence({
    healthScore: healthResult.healthScore,
    diversificationScore: healthResult.dimensions.diversificationScore,
    concentrationScore: healthResult.dimensions.concentrationScore,
    volatilityScore: healthResult.dimensions.volatilityScore,
    correlationScore: healthResult.dimensions.correlationScore,
    qualityScore: healthResult.dimensions.qualityScore,
    fragilityScore: fragilityResult.fragilityScore,
    riskMetrics: null,
    holdings: pricedHoldings.map((holding) => ({
      quantity: holding.quantity,
      avgPrice: holding.avgPrice,
      asset: {
        price: holding.asset.price,
        sector: holding.asset.sector,
        type: holding.asset.type,
      },
    })),
    currentMarketRegime: latestMarketRegime?.state ?? null,
  });
  const riskMetrics = buildRiskMetrics({
    pricedHoldings,
    healthResult,
    fragilityResult,
    currentMarketRegime: latestMarketRegime?.state ?? null,
    portfolioIntelligence,
  });

  const MAX_HEALTH_SNAPSHOTS = 10;

  const newSnapshot = await prisma.portfolioHealthSnapshot.create({
    data: {
      portfolioId,
      healthScore: healthResult.healthScore,
      diversificationScore: healthResult.dimensions.diversificationScore,
      concentrationScore: healthResult.dimensions.concentrationScore,
      volatilityScore: healthResult.dimensions.volatilityScore,
      correlationScore: healthResult.dimensions.correlationScore,
      qualityScore: healthResult.dimensions.qualityScore,
      fragilityScore: fragilityResult.fragilityScore,
      riskMetrics: riskMetrics as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
      regime: latestMarketRegime?.state ?? null,
    },
    select: { id: true },
  });

  // Prune old snapshots — keep only the latest MAX_HEALTH_SNAPSHOTS (fire-and-forget)
  prisma.portfolioHealthSnapshot
    .findMany({
      where: { portfolioId },
      orderBy: { date: "desc" },
      skip: MAX_HEALTH_SNAPSHOTS,
      select: { id: true },
    })
    .then((old) => {
      if (old.length === 0) return;
      return prisma.portfolioHealthSnapshot.deleteMany({
        where: { id: { in: old.map((s) => s.id) } },
      });
    })
    .catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "Health snapshot pruning failed (non-fatal)");
    });

  void newSnapshot;

  const invalidateDashboardHome = (async () => {
    try {
      const redisModule = await import("@/lib/redis");
      if ("invalidateCacheByPrefix" in redisModule && typeof redisModule.invalidateCacheByPrefix === "function") {
        return redisModule.invalidateCacheByPrefix(dashboardHomeCachePrefix(portfolio.userId));
      }
    } catch {
      // Ignore cache-prefix invalidation failures in partial test environments.
    }

    return 0;
  })();

  await Promise.all([
    delCache(portfolioHealthCacheKey(portfolioId)),
    delCache(portfolioAnalyticsCacheKey(portfolioId)),
    invalidateDashboardHome,
  ]);

  logger.info(
    { portfolioId, healthScore: healthResult.healthScore, fragilityScore: fragilityResult.fragilityScore },
    "Portfolio health snapshot stored",
  );
}

const BATCH_CONCURRENCY = 5;

const BATCH_PAGE_SIZE = 50; // cursor-based page size to avoid loading all IDs into memory

export async function computeAllPortfoliosHealth(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  let total = 0;
  let cursor: string | undefined;

  do {
    const page: { id: string }[] = await prisma.portfolio.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (page.length === 0) break;
    cursor = page[page.length - 1].id;
    total += page.length;

    for (let i = 0; i < page.length; i += BATCH_CONCURRENCY) {
      const batch = page.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((p) => computeAndStorePortfolioHealth(p.id)),
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          processed++;
        } else {
          errors++;
          logger.error(
            { err: sanitizeError((results[j] as PromiseRejectedResult).reason), portfolioId: batch[j].id },
            "Failed to compute portfolio health",
          );
        }
      }
    }
  } while (cursor);

  logger.info({ processed, errors, total }, "Portfolio health batch complete");
  return { processed, errors };
}
