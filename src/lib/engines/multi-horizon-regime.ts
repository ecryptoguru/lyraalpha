/**
 * Multi-Horizon Regime Engine (Phase 2)
 * Calculates multi-timeframe regime snapshots with transition signals
 */

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "../prisma";
import { createLogger } from "@/lib/logger";
import {
  MarketContextSnapshot,
  MarketRegime,
  RiskSentiment,
  VolatilityState,
  MarketBreadth,
  LiquidityCondition,
} from "./market-regime";

const logger = createLogger({ service: "multi-horizon-regime" });

export interface MultiHorizonRegimeData {
  current: MarketContextSnapshot;
  shortTerm: MarketContextSnapshot; // 5-day average
  mediumTerm: MarketContextSnapshot; // 20-day average
  longTerm: MarketContextSnapshot; // 60-day average
  transitionProbability: number; // 0-100
  transitionDirection: "RISK_ON" | "RISK_OFF" | "STABLE";
  leadingIndicators: string[];
}

/**
 * Calculate multi-horizon regime snapshots
 */
export async function calculateMultiHorizonRegime(region: string = "US"): Promise<MultiHorizonRegimeData | null> {
  // Get historical market regimes (optimized to fetch only needed fields)
  const regimes = await prisma.marketRegime.findMany({
    where: { region },
    select: {
      context: true,
      date: true,
    },
    orderBy: { date: "desc" },
    take: 60,
  });

  if (regimes.length < 5) {
    return null; // Not enough historical data
  }

  // Parse and validate contexts
  const contexts: MarketContextSnapshot[] = regimes
    .map((r) => {
      try {
        if (!r.context) return null;
        const parsed = JSON.parse(r.context);

        // Robust validation of the required structure
        const isValid =
          parsed.regime?.score !== undefined &&
          parsed.risk?.score !== undefined &&
          parsed.volatility?.score !== undefined &&
          parsed.breadth?.score !== undefined &&
          parsed.liquidity?.score !== undefined;

        return isValid ? (parsed as MarketContextSnapshot) : null;
      } catch {
        return null;
      }
    })
    .filter((c): c is MarketContextSnapshot => c !== null);

  if (contexts.length < 5) {
    return null;
  }

  // 1. Current (most recent)
  const current = contexts[0];

  // 2. Short-term (5-day average)
  const shortTerm = averageContexts(
    contexts.slice(0, Math.min(5, contexts.length)),
  );
  if (!shortTerm) return null;

  // 3. Medium-term (20-day average)
  const mediumTerm = averageContexts(
    contexts.slice(0, Math.min(20, contexts.length)),
  );
  if (!mediumTerm) return null;

  // 4. Long-term (60-day average)
  const longTerm = averageContexts(
    contexts.slice(0, Math.min(60, contexts.length)),
  );
  if (!longTerm) return null;

  // 5. Detect transition signals
  const transitionAnalysis = detectRegimeTransition(
    current,
    shortTerm,
    mediumTerm,
    longTerm,
  );

  return {
    current,
    shortTerm,
    mediumTerm,
    longTerm,
    transitionProbability: transitionAnalysis.probability,
    transitionDirection: transitionAnalysis.direction,
    leadingIndicators: transitionAnalysis.leadingIndicators,
  };
}

/**
 * Average multiple market context snapshots
 */
function averageContexts(
  contexts: MarketContextSnapshot[],
): MarketContextSnapshot | null {
  if (contexts.length === 0) {
    // Graceful degradation instead of throwing
    logger.debug("Attempted to average empty contexts");
    return null;
  }

  if (contexts.length === 1) {
    return contexts[0];
  }

  // Average scores
  const avgRegimeScore =
    contexts.reduce((sum, c) => sum + c.regime.score, 0) / contexts.length;
  const avgRiskScore =
    contexts.reduce((sum, c) => sum + c.risk.score, 0) / contexts.length;
  const avgVolScore =
    contexts.reduce((sum, c) => sum + c.volatility.score, 0) / contexts.length;
  const avgBreadthScore =
    contexts.reduce((sum, c) => sum + c.breadth.score, 0) / contexts.length;
  const avgLiqScore =
    contexts.reduce((sum, c) => sum + c.liquidity.score, 0) / contexts.length;

  // Determine labels based on averaged scores
  const regimeLabel = classifyRegimeScore(avgRegimeScore);
  const riskLabel = classifyRiskScore(avgRiskScore);
  const volLabel = classifyVolScore(avgVolScore);
  const breadthLabel = classifyBreadthScore(avgBreadthScore);
  const liqLabel = classifyLiqScore(avgLiqScore);

  return {
    regime: {
      score: Math.round(avgRegimeScore),
      label: regimeLabel,
      confidence: "medium",
      drivers: ["Multi-period average"],
    },
    risk: {
      score: Math.round(avgRiskScore),
      label: riskLabel,
      confidence: "medium",
      drivers: ["Multi-period average"],
    },
    volatility: {
      score: Math.round(avgVolScore),
      label: volLabel,
      confidence: "medium",
      drivers: ["Multi-period average"],
    },
    breadth: {
      score: Math.round(avgBreadthScore),
      label: breadthLabel,
      confidence: "medium",
      drivers: ["Multi-period average"],
    },
    liquidity: {
      score: Math.round(avgLiqScore),
      label: liqLabel,
      confidence: "medium",
      drivers: ["Multi-period average"],
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Detect regime transition signals
 */
function detectRegimeTransition(
  current: MarketContextSnapshot,
  shortTerm: MarketContextSnapshot,
  mediumTerm: MarketContextSnapshot,
  longTerm: MarketContextSnapshot,
): {
  probability: number;
  direction: "RISK_ON" | "RISK_OFF" | "STABLE";
  leadingIndicators: string[];
} {
  const leadingIndicators: string[] = [];
  let transitionScore = 0;

  // 1. Check regime score divergence
  const regimeDivergence = Math.abs(
    current.regime.score - longTerm.regime.score,
  );
  if (regimeDivergence > 20) {
    transitionScore += 30;
    leadingIndicators.push("Regime");
  }

  // 2. Check volatility divergence (often leads)
  const volDivergence = Math.abs(
    current.volatility.score - mediumTerm.volatility.score,
  );
  if (volDivergence > 15) {
    transitionScore += 25;
    leadingIndicators.push("Volatility");
  }

  // 3. Check breadth divergence
  const breadthDivergence = Math.abs(
    current.breadth.score - mediumTerm.breadth.score,
  );
  if (breadthDivergence > 20) {
    transitionScore += 25;
    leadingIndicators.push("Breadth");
  }

  // 4. Check liquidity divergence
  const liqDivergence = Math.abs(
    current.liquidity.score - mediumTerm.liquidity.score,
  );
  if (liqDivergence > 15) {
    transitionScore += 20;
    leadingIndicators.push("Liquidity");
  }

  // Determine direction
  let direction: "RISK_ON" | "RISK_OFF" | "STABLE" = "STABLE";

  if (transitionScore > 40) {
    // Significant divergence detected
    const currentScore = current.regime.score;
    const longTermScore = longTerm.regime.score;

    if (currentScore > longTermScore + 10) {
      direction = "RISK_ON";
    } else if (currentScore < longTermScore - 10) {
      direction = "RISK_OFF";
    }
  }

  const probability = Math.min(100, transitionScore);

  return {
    probability: Math.round(probability),
    direction,
    leadingIndicators,
  };
}

/**
 * Store multi-horizon regime in database
 */
export async function storeMultiHorizonRegime(region: string = "US"): Promise<void> {
  const data = await calculateMultiHorizonRegime(region);

  if (!data) return;

  // Use today's date as unique key for upsert
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  await prisma.multiHorizonRegime.upsert({
    where: { 
        date_region: {
            date: today,
            region
        }
    },
    update: {
      current: data.current as unknown as Prisma.InputJsonValue,
      shortTerm: data.shortTerm as unknown as Prisma.InputJsonValue,
      mediumTerm: data.mediumTerm as unknown as Prisma.InputJsonValue,
      longTerm: data.longTerm as unknown as Prisma.InputJsonValue,
      transitionProbability: data.transitionProbability,
      transitionDirection: data.transitionDirection,
      leadingIndicators:
        data.leadingIndicators as unknown as Prisma.InputJsonValue,
    },
    create: {
      date: today,
      region,
      current: data.current as unknown as Prisma.InputJsonValue,
      shortTerm: data.shortTerm as unknown as Prisma.InputJsonValue,
      mediumTerm: data.mediumTerm as unknown as Prisma.InputJsonValue,
      longTerm: data.longTerm as unknown as Prisma.InputJsonValue,
      transitionProbability: data.transitionProbability,
      transitionDirection: data.transitionDirection,
      leadingIndicators:
        data.leadingIndicators as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get latest multi-horizon regime from database
 */
export async function getLatestMultiHorizonRegime(region: string = "US"): Promise<MultiHorizonRegimeData | null> {
  const latest = await prisma.multiHorizonRegime.findFirst({
    where: { region },
    orderBy: { date: "desc" },
  });

  if (!latest) return null;

  // Prisma automatically handles Json type conversion
  return {
    current: latest.current as unknown as MarketContextSnapshot,
    shortTerm: latest.shortTerm as unknown as MarketContextSnapshot,
    mediumTerm: latest.mediumTerm as unknown as MarketContextSnapshot,
    longTerm: latest.longTerm as unknown as MarketContextSnapshot,
    transitionProbability: latest.transitionProbability,
    transitionDirection: latest.transitionDirection as
      | "RISK_ON"
      | "RISK_OFF"
      | "STABLE",
    leadingIndicators: (latest.leadingIndicators as unknown as string[]) || [],
  };
}

// Helper classification functions using generic threshold-based approach
type ThresholdConfig<T extends string> = Array<{ min: number; label: T }>;

const REGIME_THRESHOLDS: ThresholdConfig<MarketRegime> = [
  { min: 75, label: "STRONG_RISK_ON" },
  { min: 60, label: "RISK_ON" },
  { min: 46, label: "NEUTRAL" },
  { min: 31, label: "DEFENSIVE" },
  { min: 0, label: "RISK_OFF" },
];

const RISK_THRESHOLDS: ThresholdConfig<RiskSentiment> = [
  { min: 75, label: "RISK_EMBRACING" },
  { min: 60, label: "RISK_SEEKING" },
  { min: 46, label: "BALANCED" },
  { min: 31, label: "CAUTIOUS" },
  { min: 0, label: "RISK_AVERSION" },
];

const VOL_THRESHOLDS: ThresholdConfig<VolatilityState> = [
  { min: 75, label: "SUPPRESSED" },
  { min: 60, label: "STABLE" },
  { min: 46, label: "NORMAL" },
  { min: 31, label: "ELEVATED" },
  { min: 0, label: "STRESS" },
];

const BREADTH_THRESHOLDS: ThresholdConfig<MarketBreadth> = [
  { min: 75, label: "VERY_BROAD" },
  { min: 60, label: "BROAD" },
  { min: 46, label: "MIXED" },
  { min: 31, label: "WEAK" },
  { min: 0, label: "NARROW" },
];

const LIQ_THRESHOLDS: ThresholdConfig<LiquidityCondition> = [
  { min: 75, label: "VERY_STRONG" },
  { min: 60, label: "STRONG" },
  { min: 46, label: "ADEQUATE" },
  { min: 31, label: "THIN" },
  { min: 0, label: "FRAGILE" },
];

/**
 * Generic classification function based on threshold configuration
 */
function classifyScore<T extends string>(
  score: number,
  thresholds: ThresholdConfig<T>,
  defaultLabel: T,
): T {
  const match = thresholds.find((t) => score >= t.min);
  return match?.label ?? defaultLabel;
}

function classifyRegimeScore(score: number): MarketRegime {
  return classifyScore(score, REGIME_THRESHOLDS, "NEUTRAL" as MarketRegime);
}

function classifyRiskScore(score: number): RiskSentiment {
  return classifyScore(score, RISK_THRESHOLDS, "BALANCED");
}

function classifyVolScore(score: number): VolatilityState {
  return classifyScore(score, VOL_THRESHOLDS, "NORMAL");
}

function classifyBreadthScore(score: number): MarketBreadth {
  return classifyScore(score, BREADTH_THRESHOLDS, "MIXED");
}

function classifyLiqScore(score: number): LiquidityCondition {
  return classifyScore(score, LIQ_THRESHOLDS, "ADEQUATE");
}

/**
 * Generate human-readable interpretation
 */
export function interpretMultiHorizon(data: {
  current: { regime: { score: number; label: string } };
  shortTerm: { regime: { score: number; label: string } };
  mediumTerm: { regime: { score: number; label: string } };
  longTerm: { regime: { score: number; label: string } };
  transitionProbability: number;
  transitionDirection: string;
  leadingIndicators: string[];
}): {
  summary: string;
  alignment: string;
  transitionRisk: string;
} {
  const currentRegime = data.current.regime.label;
  const longTermRegime = data.longTerm.regime.label;

  // Summary
  const summary = `Current regime: ${currentRegime.replace(/_/g, " ").toLowerCase()}`;

  // Alignment
  let alignment = "";
  if (currentRegime === longTermRegime) {
    alignment = "All timeframes aligned - regime is stable";
  } else {
    alignment = `Divergence detected: current (${currentRegime}) differs from long-term (${longTermRegime})`;
  }

  // Transition risk
  let transitionRisk = "";
  if (data.transitionProbability >= 60) {
    transitionRisk = `High transition probability (${data.transitionProbability}%) toward ${data.transitionDirection.replace(/_/g, " ").toLowerCase()}. Leading indicators: ${data.leadingIndicators.join(", ")}`;
  } else if (data.transitionProbability >= 40) {
    transitionRisk = `Moderate transition probability (${data.transitionProbability}%). Monitor ${data.leadingIndicators.join(", ")} for confirmation`;
  } else {
    transitionRisk = `Low transition probability (${data.transitionProbability}%). Regime appears stable`;
  }

  return {
    summary,
    alignment,
    transitionRisk,
  };
}

