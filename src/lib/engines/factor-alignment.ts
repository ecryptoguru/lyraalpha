/**
 * Factor Alignment Engine (Phase 2)
 * Calculates factor-based regime alignment scoring
 */

import { MarketRegime } from "./market-regime";

export interface FactorData {
  value: number; // Value factor score (0-100)
  growth: number; // Growth factor score (0-100)
  momentum: number; // Momentum factor score (0-100)
  volatility: number; // Volatility factor score (0-100)
}

export interface FactorAlignmentScore {
  score: number; // 0-100 composite alignment
  dominantFactor: keyof FactorData; // Which factor is strongest
  regimeFit: "STRONG" | "MODERATE" | "WEAK";
  breakdown: {
    value: number;
    growth: number;
    momentum: number;
    volatility: number;
  };
  explanation: string;
}

/**
 * Calculate factor-regime alignment score
 */
export function calculateFactorRegimeAlignment(
  factorData: FactorData,
  marketRegime: MarketRegime,
): FactorAlignmentScore {
  // Define regime-specific factor weights
  const alignmentRules: Record<
    MarketRegime,
    Record<keyof FactorData, number>
  > = {
    STRONG_RISK_ON: {
      growth: 0.4, // Favor growth
      momentum: 0.3, // Favor momentum
      value: 0.1, // De-emphasize value
      volatility: -0.2, // Penalize high volatility
    },
    RISK_ON: {
      growth: 0.35,
      momentum: 0.25,
      value: 0.2,
      volatility: -0.2,
    },
    NEUTRAL: {
      growth: 0.25,
      value: 0.25,
      momentum: 0.25,
      volatility: -0.25,
    },
    DEFENSIVE: {
      value: 0.4, // Favor value
      volatility: -0.3, // Strongly penalize volatility
      growth: 0.15,
      momentum: 0.15,
    },
    RISK_OFF: {
      value: 0.45, // Strongly favor value
      volatility: -0.4, // Strongly penalize volatility
      growth: 0.05,
      momentum: 0.1,
    },
    TRANSITIONING: {
      // Fallback/Neutral for transitioning
      growth: 0.25,
      value: 0.25,
      momentum: 0.25,
      volatility: -0.25,
    },
  };

  // Map legacy labels if necessary
  let normalizedRegime = marketRegime;
  if ((marketRegime as string) === "BULL") normalizedRegime = "STRONG_RISK_ON";
  if ((marketRegime as string) === "BEAR") normalizedRegime = "RISK_OFF";

  const weights = (alignmentRules as Record<string, Record<keyof FactorData, number>>)[normalizedRegime] || alignmentRules.NEUTRAL;

  // Calculate weighted score
  const rawScore =
    (factorData.value / 100) * weights.value +
    (factorData.growth / 100) * weights.growth +
    (factorData.momentum / 100) * weights.momentum +
    ((100 - factorData.volatility) / 100) * Math.abs(weights.volatility);

  // Normalize to 0-100
  // rawScore ∈ [0, 1.0] since all terms are non-negative and weights sum to 1.0
  const normalizedScore = rawScore * 100;
  const score = Math.min(100, Math.max(0, normalizedScore));

  // Determine dominant factor
  const dominantFactor = Object.entries(factorData).sort(
    ([, a], [, b]) => b - a,
  )[0][0] as keyof FactorData;

  // Classify regime fit
  let regimeFit: "STRONG" | "MODERATE" | "WEAK" = "MODERATE";
  if (score >= 70) regimeFit = "STRONG";
  else if (score <= 40) regimeFit = "WEAK";

  // Calculate breakdown (contribution of each factor)
  const breakdown = {
    value: Math.round((factorData.value / 100) * weights.value * 100),
    growth: Math.round((factorData.growth / 100) * weights.growth * 100),
    momentum: Math.round((factorData.momentum / 100) * weights.momentum * 100),
    volatility: Math.round(
      ((100 - factorData.volatility) / 100) *
        Math.abs(weights.volatility) *
        100,
    ),
  };

  // Generate explanation
  const explanation = generateFactorExplanation(
    factorData,
    dominantFactor,
    marketRegime,
    regimeFit,
  );

  return {
    score: Math.round(score),
    dominantFactor,
    regimeFit,
    breakdown,
    explanation,
  };
}

/**
 * Generate human-readable explanation
 */
function generateFactorExplanation(
  factorData: FactorData,
  dominantFactor: keyof FactorData,
  regime: MarketRegime,
  fit: "STRONG" | "MODERATE" | "WEAK",
): string {
  const factorLabels: Record<keyof FactorData, string> = {
    value: "Value",
    growth: "Growth",
    momentum: "Momentum",
    volatility: "Volatility",
  };

  const regimePreferences: Record<MarketRegime, string> = {
    STRONG_RISK_ON: "growth and momentum",
    RISK_ON: "growth with moderate momentum",
    NEUTRAL: "balanced factor exposure",
    DEFENSIVE: "value and low volatility",
    RISK_OFF: "value and stability",
    TRANSITIONING: "balanced exposure",
  };

  const dominant = factorLabels[dominantFactor];
  const preferred = regimePreferences[regime];

  if (fit === "STRONG") {
    return `Strong ${dominant.toLowerCase()} characteristics align well with ${regime.replace(/_/g, " ").toLowerCase()} regime favoring ${preferred}.`;
  } else if (fit === "WEAK") {
    return `${dominant} dominance misaligned with ${regime.replace(/_/g, " ").toLowerCase()} regime. Current environment favors ${preferred}.`;
  } else {
    return `Moderate ${dominant.toLowerCase()} exposure provides partial alignment with ${regime.replace(/_/g, " ").toLowerCase()} regime.`;
  }
}

/**
 * Calculate factor dispersion across multiple assets
 */
export function calculateFactorDispersion(
  assets: Array<{ factorData: FactorData }>,
): {
  valueDispersion: number;
  growthDispersion: number;
  momentumDispersion: number;
  volatilityDispersion: number;
  regime: "STOCK_PICKING" | "MACRO_DRIVEN";
  dominantFactor: keyof FactorData;
  implications: string;
} {
  if (assets.length < 10) {
    return {
      valueDispersion: 0,
      growthDispersion: 0,
      momentumDispersion: 0,
      volatilityDispersion: 0,
      regime: "MACRO_DRIVEN",
      dominantFactor: "value",
      implications: "Insufficient data for factor dispersion analysis",
    };
  }

  // Extract factor arrays
  const valueScores = assets.map((a) => a.factorData.value);
  const growthScores = assets.map((a) => a.factorData.growth);
  const momentumScores = assets.map((a) => a.factorData.momentum);
  const volatilityScores = assets.map((a) => a.factorData.volatility);

  // Calculate dispersions
  const valueDispersion = calculateStandardDeviation(valueScores);
  const growthDispersion = calculateStandardDeviation(growthScores);
  const momentumDispersion = calculateStandardDeviation(momentumScores);
  const volatilityDispersion = calculateStandardDeviation(volatilityScores);

  // Determine regime
  const avgDispersion =
    (valueDispersion + growthDispersion + momentumDispersion) / 3;
  const regime: "STOCK_PICKING" | "MACRO_DRIVEN" =
    avgDispersion > 20 ? "STOCK_PICKING" : "MACRO_DRIVEN";

  // Determine dominant factor (highest dispersion = most important)
  const dispersions = {
    value: valueDispersion,
    growth: growthDispersion,
    momentum: momentumDispersion,
    volatility: volatilityDispersion,
  };

  const dominantFactor = Object.entries(dispersions).sort(
    ([, a], [, b]) => b - a,
  )[0][0] as keyof FactorData;

  // Generate implications
  const implications =
    regime === "STOCK_PICKING"
      ? `High factor dispersion (${Math.round(avgDispersion)}%) indicates stock-picking environment. ${dominantFactor} factor shows highest differentiation.`
      : `Low factor dispersion (${Math.round(avgDispersion)}%) suggests macro-driven market. Sector selection more important than stock picking.`;

  return {
    valueDispersion: Math.round(valueDispersion),
    growthDispersion: Math.round(growthDispersion),
    momentumDispersion: Math.round(momentumDispersion),
    volatilityDispersion: Math.round(volatilityDispersion),
    regime,
    dominantFactor,
    implications,
  };
}

/**
 * Helper: Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Recommend factor tilt based on regime
 */
export function recommendFactorTilt(regime: MarketRegime): {
  primaryFactor: keyof FactorData;
  secondaryFactor: keyof FactorData;
  avoidFactor: keyof FactorData;
  rationale: string;
} {
  const recommendations: Record<
    MarketRegime,
    {
      primaryFactor: keyof FactorData;
      secondaryFactor: keyof FactorData;
      avoidFactor: keyof FactorData;
      rationale: string;
    }
  > = {
    STRONG_RISK_ON: {
      primaryFactor: "growth",
      secondaryFactor: "momentum",
      avoidFactor: "value",
      rationale:
        "Strong risk appetite favors growth and momentum. Value typically underperforms.",
    },
    RISK_ON: {
      primaryFactor: "growth",
      secondaryFactor: "value",
      avoidFactor: "volatility",
      rationale:
        "Positive environment supports growth with selective value opportunities.",
    },
    NEUTRAL: {
      primaryFactor: "value",
      secondaryFactor: "growth",
      avoidFactor: "volatility",
      rationale:
        "Balanced regime favors diversified factor exposure with volatility management.",
    },
    DEFENSIVE: {
      primaryFactor: "value",
      secondaryFactor: "momentum",
      avoidFactor: "growth",
      rationale:
        "Defensive positioning favors value and stable momentum. Avoid high-growth volatility.",
    },
    RISK_OFF: {
      primaryFactor: "value",
      secondaryFactor: "volatility",
      avoidFactor: "growth",
      rationale:
        "Risk aversion demands value and low volatility. Growth typically suffers.",
    },
    TRANSITIONING: {
      primaryFactor: "growth",
      secondaryFactor: "value",
      avoidFactor: "volatility",
      rationale:
        "Transitioning regime suggests balanced exposure across growth and value.",
    },
  };

  return recommendations[regime];
}
