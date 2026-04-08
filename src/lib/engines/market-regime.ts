export type MarketRegime =
  | "STRONG_RISK_ON"
  | "RISK_ON"
  | "NEUTRAL"
  | "DEFENSIVE"
  | "RISK_OFF"
  | "TRANSITIONING";
export type RegimeState = MarketRegime; // Alias for backward compatibility
export type RiskSentiment =
  | "RISK_EMBRACING"
  | "RISK_SEEKING"
  | "BALANCED"
  | "CAUTIOUS"
  | "RISK_AVERSION";
export type VolatilityState =
  | "SUPPRESSED"
  | "STABLE"
  | "NORMAL"
  | "ELEVATED"
  | "STRESS";
export type MarketBreadth =
  | "VERY_BROAD"
  | "BROAD"
  | "MIXED"
  | "WEAK"
  | "NARROW";
export type LiquidityCondition =
  | "VERY_STRONG"
  | "STRONG"
  | "ADEQUATE"
  | "THIN"
  | "FRAGILE";

export interface MarketDimension<T> {
  score: number;
  label: T;
  confidence: "low" | "medium" | "high";
  drivers: string[];
}

export interface MarketContextSnapshot {
  regime: MarketDimension<MarketRegime>;
  risk: MarketDimension<RiskSentiment>;
  volatility: MarketDimension<VolatilityState>;
  breadth: MarketDimension<MarketBreadth>;
  liquidity: MarketDimension<LiquidityCondition>;
  lastUpdated: string;
}

// Performance Optimization: Context Caching
/**
 * Now region-aware to prevent context leakage between US and Indian views
 */
const contextCache: Record<string, { snapshot: MarketContextSnapshot; timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minute focus for high-traffic dashboard
const CACHE_MAX_REGIONS = 20; // evict oldest entries beyond this limit

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Institutional getter for the latest market context.
 * Implements in-memory caching to reduce DB load and JSON parsing overhead.
 */
export async function getLatestMarketContext(prisma: PrismaClient, region: string = "US"): Promise<MarketContextSnapshot | null> {
  const now = Date.now();
  
  // Return cached version if still fresh for this region (deep copy to prevent mutation)
  if (contextCache[region] && (now - contextCache[region].timestamp < CACHE_TTL)) {
    return structuredClone(contextCache[region].snapshot);
  }

  const latestRegime = await prisma.marketRegime.findFirst({
    where: { region },
    orderBy: { date: "desc" },
  });

  if (!latestRegime || !latestRegime.context) return null;

  try {
    const context = JSON.parse(latestRegime.context);
    // Cache the parsed object
    // Evict oldest entries if cache exceeds max size
    const keys = Object.keys(contextCache);
    if (keys.length >= CACHE_MAX_REGIONS) {
      const oldest = keys.reduce((a, b) => contextCache[a].timestamp < contextCache[b].timestamp ? a : b);
      delete contextCache[oldest];
    }
    contextCache[region] = { snapshot: context, timestamp: now };
    // Return a deep copy to prevent callers from mutating the cache
    return structuredClone(context);
  } catch (e) {
    // Structured logging would require importing createLogger here;
    // keeping as console.error since this is a low-level engine module
    // that initializes before the logger in some paths.
    if (process.env.NODE_ENV === "development") console.error(`MCE Cache [${region}]: Failed to parse regime context`, e);
    return null;
  }
}

/**
 * Forces a cache invalidation.
 */
export function invalidateMarketContextCache(region?: string) {
  if (region) {
    delete contextCache[region];
  } else {
    // Clear all
    Object.keys(contextCache).forEach(k => delete contextCache[k]);
  }
}

/**
 * Institutional Market Context Engine (MCE)
 * Calculates multi-dimensional market environment state.
 */
export function calculateMarketContext(
  assetData: {
    trend: number;
    volatility: number;
    momentum: number;
    liquidity: number;
    sentiment: number;
    weight?: number;
  }[],
): MarketContextSnapshot {
  const defaultSnapshot: MarketContextSnapshot = {
    regime: {
      score: 50,
      label: "NEUTRAL",
      confidence: "low",
      drivers: ["Insufficient data"],
    },
    risk: {
      score: 50,
      label: "BALANCED",
      confidence: "low",
      drivers: ["Insufficient data"],
    },
    volatility: {
      score: 50,
      label: "NORMAL",
      confidence: "low",
      drivers: ["Insufficient data"],
    },
    breadth: {
      score: 50,
      label: "MIXED",
      confidence: "low",
      drivers: ["Insufficient data"],
    },
    liquidity: {
      score: 50,
      label: "ADEQUATE",
      confidence: "low",
      drivers: ["Insufficient data"],
    },
    lastUpdated: new Date().toISOString(),
  };

  if (assetData.length === 0) return defaultSnapshot;

  const weightedData = assetData.map((a) => ({
    ...a,
    weight: Math.max(0, a.weight ?? 1),
  }));
  const totalWeight = weightedData.reduce((sum, a) => sum + a.weight, 0) || 1;

  const weightedMean = (selector: (a: (typeof weightedData)[number]) => number): number =>
    weightedData.reduce((sum, a) => sum + selector(a) * a.weight, 0) / totalWeight;

  // 1. Market Breadth Score (confidence-weighted)
  const bullishWeight = weightedData.reduce((sum, a) => sum + (a.trend > 55 ? a.weight : 0), 0);
  const breadthScore = (bullishWeight / totalWeight) * 100;
  let breadthLabel: MarketBreadth = "MIXED";
  if (breadthScore >= 75) breadthLabel = "VERY_BROAD";
  else if (breadthScore >= 60) breadthLabel = "BROAD";
  else if (breadthScore <= 30) breadthLabel = "NARROW";
  else if (breadthScore <= 45) breadthLabel = "WEAK";

  // 2. Volatility State Score
  const avgVol = weightedMean((a) => a.volatility);
  // Invert volatility score for the "State" (High stability = High score)
  const volStateScore = 100 - avgVol;
  let volLabel: VolatilityState = "NORMAL";
  if (volStateScore >= 75) volLabel = "SUPPRESSED";
  else if (volStateScore >= 60) volLabel = "STABLE";
  else if (volStateScore <= 30) volLabel = "STRESS";
  else if (volStateScore <= 45) volLabel = "ELEVATED";

  // 3. Liquidity Condition Score
  const avgLiq = weightedMean((a) => a.liquidity);
  let liqLabel: LiquidityCondition = "ADEQUATE";
  if (avgLiq >= 75) liqLabel = "VERY_STRONG";
  else if (avgLiq >= 60) liqLabel = "STRONG";
  else if (avgLiq <= 30) liqLabel = "FRAGILE";
  else if (avgLiq <= 45) liqLabel = "THIN";

  // 4. Risk Sentiment Score
  const avgSentiment = weightedMean((a) => a.sentiment);
  const highMomentumWeight = weightedData.reduce((sum, a) => sum + (a.momentum > 60 ? a.weight : 0), 0);
  const momentumParticipation = (highMomentumWeight / totalWeight) * 100;
  const riskScore = avgSentiment * 0.6 + momentumParticipation * 0.4;

  let riskLabel: RiskSentiment = "BALANCED";
  if (riskScore >= 75) riskLabel = "RISK_EMBRACING";
  else if (riskScore >= 60) riskLabel = "RISK_SEEKING";
  else if (riskScore <= 30) riskLabel = "RISK_AVERSION";
  else if (riskScore <= 45) riskLabel = "CAUTIOUS";

  // 5. Market Regime Score (Composite)
  const regimeScore =
    breadthScore * 0.4 + volStateScore * 0.3 + riskScore * 0.3;
  let regimeLabel: MarketRegime = "NEUTRAL";
  if (regimeScore >= 75) regimeLabel = "STRONG_RISK_ON";
  else if (regimeScore >= 60) regimeLabel = "RISK_ON";
  else if (regimeScore <= 30) regimeLabel = "RISK_OFF";
  else if (regimeScore <= 45) regimeLabel = "DEFENSIVE";

  return {
    regime: {
      score: Math.round(regimeScore),
      label: regimeLabel,
      confidence: assetData.length > 5 ? "high" : "medium",
      drivers: [
        regimeLabel === "STRONG_RISK_ON"
          ? "Broad participation with suppressed volatility"
          : regimeLabel === "RISK_ON"
            ? "Positive trend structure with stable participation"
            : regimeLabel === "RISK_OFF"
              ? "Systemic trend breakdown with elevated stress"
              : regimeLabel === "DEFENSIVE"
                ? "Narrowing breadth and cautious sentiment"
                : "Mixed signals across dimensions",
      ],
    },
    risk: {
      score: Math.round(riskScore),
      label: riskLabel,
      confidence: "medium",
      drivers: [
        riskLabel === "RISK_EMBRACING"
          ? "Aggressive sentiment and momentum alignment"
          : riskLabel === "RISK_AVERSION"
            ? "Widespread capital preservation bias"
            : "Balanced risk appetite",
      ],
    },
    volatility: {
      score: Math.round(volStateScore),
      label: volLabel,
      confidence: "high",
      drivers: [`Average asset volatility at ${Math.round(avgVol)}%`],
    },
    breadth: {
      score: Math.round(breadthScore),
      label: breadthLabel,
      confidence: "high",
      drivers: [
        `${Math.round(breadthScore)}% of assets maintaining positive trend structure`,
      ],
    },
    liquidity: {
      score: Math.round(avgLiq),
      label: liqLabel,
      confidence: "medium",
      drivers: ["Calculated from cross-asset execution depth"],
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Alias for backward compatibility
 */
export const calculateMarketRegime = calculateMarketContext;
