import { MarketContextSnapshot } from "./market-regime";
import { FactorData, calculateFactorRegimeAlignment } from "./factor-alignment";
import { EventImpact } from "./event-scoring";

export interface AssetSignals {
  trend: number;
  momentum: number;
  volatility: number;
  liquidity: number;
  sentiment: number;
  trust: number;
}

export interface CompatibilityResult {
  score: number;
  label: "Strong Fit" | "Good Fit" | "Mixed Fit" | "Weak Fit" | "Poor Fit";
  confidence: "low" | "medium" | "high";
  breakdown: {
    trend: number;
    momentum: number;
    volatility: number;
    liquidity: number;
    sentiment: number;
  };
  explanation: string[];
}

/**
 * Institutional Asset-to-Regime Compatibility Scoring (ARCS)
 * Logic derived from AMCS.md and ARCS.md
 */
export function calculateCompatibility(
  assetSignals: AssetSignals,
  marketContext: MarketContextSnapshot,
): CompatibilityResult {
  // 1. Trend Compatibility (0.30)
  // Risk-On/Strong Risk-On favors high trend
  // Risk-Off favors lower trend (defensive/uncorrelated) or specifically targets low trend
  let trendComp = 0;
  const regime = marketContext.regime.label;
  if (regime === "STRONG_RISK_ON" || regime === "RISK_ON") {
    trendComp = Math.max(0, 100 - Math.abs(assetSignals.trend - 80)); // Perfect fit at 80
  } else if (regime === "RISK_OFF") {
    trendComp = Math.max(0, 100 - Math.abs(assetSignals.trend - 30)); // Perfect fit at 30 (defensive)
  } else {
    trendComp = Math.max(0, 100 - Math.abs(assetSignals.trend - 50)); // Neutral
  }

  // 2. Momentum Compatibility (0.20)
  // In Stress/Elevated Volatility, extreme momentum is penalized
  let momentumComp = 0;
  const volState = marketContext.volatility.label;
  if (volState === "STRESS" || volState === "ELEVATED") {
    momentumComp = Math.max(0, 100 - Math.abs(assetSignals.momentum - 40)); // Low momentum preferred
  } else if (volState === "SUPPRESSED" || volState === "STABLE") {
    momentumComp = Math.max(0, 100 - Math.abs(assetSignals.momentum - 70)); // High momentum allowed
  } else {
    momentumComp = Math.max(0, 100 - Math.abs(assetSignals.momentum - 55));
  }

  // 3. Volatility Compatibility (0.20)
  // In Stress, low vol assets are rewarded. In Stable, high vol ok.
  let volComp = 0;
  if (volState === "STRESS") {
    volComp = Math.max(0, 100 - assetSignals.volatility); // Lower is better
  } else if (volState === "SUPPRESSED") {
    // In suppressed vol environment, mid-vol assets are preferred (not too calm, not too wild)
    volComp = Math.max(0, 100 - Math.abs(assetSignals.volatility - 40));
  } else {
    volComp = Math.max(0, 100 - Math.abs(assetSignals.volatility - 30));
  }

  // 4. Liquidity Compatibility (0.20)
  // Enhanced: multi-dimensional liquidity score makes this dimension more reliable
  // In Thin/Fragile environments, asset liquidity needs to be HIGHER
  // In RISK_OFF, liquidity premium increases (flight to liquidity)
  let liqComp = 0;
  const marketLiq = marketContext.liquidity.label;
  if (marketLiq === "FRAGILE" || marketLiq === "THIN") {
    liqComp = assetSignals.liquidity >= 70 ? 100 : Math.max(0, assetSignals.liquidity * 1.2 - 10);
  } else if (regime === "RISK_OFF" || regime === "DEFENSIVE") {
    // Flight to liquidity: high liquidity assets get a premium
    liqComp = assetSignals.liquidity >= 60 ? Math.min(100, assetSignals.liquidity + 15) : assetSignals.liquidity;
  } else {
    // Neutral/risk-on regimes: no bonus — liquidity is not a differentiating factor
    liqComp = assetSignals.liquidity;
  }

  // 5. Sentiment Alignment (0.10)
  let sentComp = 0;
  const riskSent = marketContext.risk.label;
  if (riskSent === "RISK_EMBRACING" || riskSent === "RISK_SEEKING") {
    sentComp = assetSignals.sentiment >= 60 ? 100 : assetSignals.sentiment + 30;
  } else if (riskSent === "RISK_AVERSION") {
    sentComp =
      assetSignals.sentiment <= 40 ? 100 : 100 - assetSignals.sentiment;
  } else {
    sentComp = Math.max(0, 100 - Math.abs(assetSignals.sentiment - 50));
  }

  // Composite Score (weights: trend 0.30, momentum 0.20, vol 0.20, liquidity 0.20, sentiment 0.10)
  const compositeScore =
    trendComp * 0.3 +
    momentumComp * 0.2 +
    volComp * 0.2 +
    liqComp * 0.2 +
    sentComp * 0.1;

  let label: "Strong Fit" | "Good Fit" | "Mixed Fit" | "Weak Fit" | "Poor Fit" =
    "Mixed Fit";
  if (compositeScore >= 76) label = "Strong Fit";
  else if (compositeScore >= 61) label = "Good Fit";
  else if (compositeScore <= 30) label = "Poor Fit";
  else if (compositeScore <= 45) label = "Weak Fit";

  // Explanations
  const explanation: string[] = [];
  if (trendComp >= 70)
    explanation.push("Strong structural alignment with current regime.");
  if (volComp >= 70)
    explanation.push("Volatility profile matches environmental stability.");
  if (liqComp >= 70)
    explanation.push("Adequate liquidity depth for current conditions.");
  if (compositeScore < 50)
    explanation.push(
      "Significant divergence between asset behavior and market environment.",
    );

  return {
    score: Math.round(compositeScore),
    label,
    confidence: marketContext.regime.confidence,
    breakdown: {
      trend: Math.round(trendComp),
      momentum: Math.round(momentumComp),
      volatility: Math.round(volComp),
      liquidity: Math.round(liqComp),
      sentiment: Math.round(sentComp),
    },
    explanation,
  };
}

/**
 * Enhanced compatibility calculation with factor integration (Phase 2)
 */
export function calculateEnhancedCompatibility(
  assetSignals: AssetSignals,
  marketContext: MarketContextSnapshot,
  factorData?: FactorData,
  eventImpact?: EventImpact,
): CompatibilityResult {
  // Base compatibility
  const baseResult = calculateCompatibility(assetSignals, marketContext);

  // If no factor data, return base result
  if (!factorData) {
    return baseResult;
  }

  // Calculate factor alignment
  const factorAlignment = calculateFactorRegimeAlignment(
    factorData,
    marketContext.regime.label,
  );

  // Blend base compatibility with factor alignment (70% base, 30% factor)
  const blendedScore = baseResult.score * 0.7 + factorAlignment.score * 0.3;

  // Apply event impact if available
  let finalScore = blendedScore;
  if (eventImpact && typeof eventImpact.impactMagnitude === "number" && eventImpact.impactMagnitude !== 0) {
    finalScore = finalScore * (1 + eventImpact.impactMagnitude / 100);
    finalScore = Math.min(100, Math.max(0, finalScore));
  }

  // Update label based on final score
  let label: "Strong Fit" | "Good Fit" | "Mixed Fit" | "Weak Fit" | "Poor Fit" =
    "Mixed Fit";
  if (finalScore >= 76) label = "Strong Fit";
  else if (finalScore >= 61) label = "Good Fit";
  else if (finalScore <= 30) label = "Poor Fit";
  else if (finalScore <= 45) label = "Weak Fit";

  // Enhanced explanation
  const enhancedExplanation = [...baseResult.explanation];
  if (factorAlignment.regimeFit === "STRONG") {
    enhancedExplanation.push(
      `Factor profile (${factorAlignment.dominantFactor}) strongly aligned with regime.`,
    );
  }
  if (eventImpact && Math.abs(eventImpact.impactMagnitude) > 5) {
    enhancedExplanation.push(eventImpact.explanation);
  }

  return {
    score: Math.round(finalScore),
    label,
    confidence: baseResult.confidence,
    breakdown: baseResult.breakdown,
    explanation: enhancedExplanation,
  };
}
