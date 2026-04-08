/**
 * Phase 3 Step 2.3: Asset Fragility Score Engine
 * 
 * Computes per-asset fragility score based on volatility, liquidity, correlation, and factor alignment.
 * Higher scores indicate higher fragility (vulnerability to market stress).
 */

export type FragilityLevel = "LOW" | "MODERATE" | "ELEVATED" | "CRITICAL";

export interface FragilityComponents {
  volatilityPercentile: number;
  liquidityRisk: number;
  correlationConvergence: number;
  negativeFactorAlignment: number;
}

export interface AssetFragilityResult {
  score: number; // 0-100
  level: FragilityLevel;
  components: FragilityComponents;
  explanation: string;
  drivers: string[];
}

export interface ScoreMap {
  volatility?: number;
  liquidity?: number;
  momentum?: number;
  trend?: number;
}

const WEIGHTS = {
  volatility: 0.30,
  liquidity: 0.25,
  correlation: 0.25,
  factorAlignment: 0.20,
} as const;

/**
 * Calculate asset fragility score from DSE scores and enrichment data.
 */
export function calculateAssetFragility(
  scores: ScoreMap,
  enrichment?: {
    correlationMetrics?: { avgCorrelation?: number };
    factorData?: { value?: number; growth?: number; momentum?: number; lowVol?: number };
  },
): AssetFragilityResult {
  // Component 1: Volatility Percentile (higher vol = higher fragility)
  const volatilityPercentile = scores.volatility ?? 50;

  // Component 2: Liquidity Risk (inverted: lower liquidity = higher risk)
  const liquidityRisk = 100 - (scores.liquidity ?? 50);

  // Component 3: Correlation Convergence (higher correlation = higher fragility in stress)
  const avgCorrelation = enrichment?.correlationMetrics?.avgCorrelation ?? 0.5;
  const correlationConvergence = avgCorrelation * 100;

  // Component 4: Negative Factor Alignment
  // Fragility increases when asset has negative momentum/trend (weak positioning)
  const momentumScore = scores.momentum ?? 50;
  const trendScore = scores.trend ?? 50;
  const negativeFactorAlignment = 100 - (momentumScore * 0.6 + trendScore * 0.4);

  // Weighted composite
  const score = Math.round(
    WEIGHTS.volatility * volatilityPercentile +
    WEIGHTS.liquidity * liquidityRisk +
    WEIGHTS.correlation * correlationConvergence +
    WEIGHTS.factorAlignment * negativeFactorAlignment,
  );

  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine level
  let level: FragilityLevel;
  if (clampedScore < 30) level = "LOW";
  else if (clampedScore < 55) level = "MODERATE";
  else if (clampedScore < 75) level = "ELEVATED";
  else level = "CRITICAL";

  // Generate explanation
  const explanation = generateExplanation(level, {
    volatilityPercentile,
    liquidityRisk,
    correlationConvergence,
    negativeFactorAlignment,
  });

  // Identify top drivers
  const drivers = identifyDrivers({
    volatilityPercentile,
    liquidityRisk,
    correlationConvergence,
    negativeFactorAlignment,
  });

  return {
    score: clampedScore,
    level,
    components: {
      volatilityPercentile,
      liquidityRisk,
      correlationConvergence,
      negativeFactorAlignment,
    },
    explanation,
    drivers,
  };
}

function generateExplanation(level: FragilityLevel, components: FragilityComponents): string {
  switch (level) {
    case "LOW":
      return "Asset shows resilience with stable volatility, strong liquidity, and positive positioning.";
    case "MODERATE":
      return "Asset exhibits moderate fragility. Monitor liquidity and correlation during market stress.";
    case "ELEVATED":
      if (components.volatilityPercentile > 70) {
        return "High volatility and correlation convergence increase vulnerability to drawdowns.";
      }
      if (components.liquidityRisk > 70) {
        return "Liquidity constraints amplify downside risk during market dislocations.";
      }
      return "Elevated fragility from multiple risk factors. Stress-test position sizing.";
    case "CRITICAL":
      return "Critical fragility level. Asset highly vulnerable to market stress and liquidity shocks.";
  }
}

function identifyDrivers(components: FragilityComponents): string[] {
  const drivers: Array<{ key: string; value: number; label: string }> = [
    { key: "vol", value: components.volatilityPercentile, label: "High volatility" },
    { key: "liq", value: components.liquidityRisk, label: "Liquidity constraints" },
    { key: "corr", value: components.correlationConvergence, label: "Correlation convergence" },
    { key: "factor", value: components.negativeFactorAlignment, label: "Weak positioning" },
  ];

  return drivers
    .filter((d) => d.value > 60)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((d) => d.label);
}

/**
 * Compute fragility for batch of assets (used during sync).
 */
export function computeBatchFragility(
  assets: Array<{
    symbol: string;
    scores: ScoreMap | null;
    correlationMetrics?: { avgCorrelation?: number };
    factorData?: { value?: number; growth?: number; momentum?: number; lowVol?: number };
  }>,
): Map<string, AssetFragilityResult> {
  const results = new Map<string, AssetFragilityResult>();

  for (const asset of assets) {
    if (!asset.scores) continue;

    const fragility = calculateAssetFragility(asset.scores, {
      correlationMetrics: asset.correlationMetrics,
      factorData: asset.factorData,
    });

    results.set(asset.symbol, fragility);
  }

  return results;
}
