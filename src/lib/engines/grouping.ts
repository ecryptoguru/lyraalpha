import { CompatibilityResult, AssetSignals } from "./compatibility";

export type AssetGroup =
  | "Market Leaders"
  | "Regime-Aligned"
  | "Regime-Sensitive"
  | "Momentum Decay"
  | "Neutral / Defensive"
  | "Fragile / High Risk";

export interface GroupingResult {
  group: AssetGroup;
  intent: string;
  explanation: string;
}

/**
 * Institutional Asset Grouping Rules (AGR)
 * Logic derived from AGR.md
 */
export function classifyAsset(
  signals: AssetSignals,
  compatibility: CompatibilityResult,
  assetType: string = "CRYPTO",
): GroupingResult {
  const arcs = compatibility.score;
  const { trend, momentum, volatility, liquidity } = signals;

  // 1. Fragile / High Risk (Top Priority)
  if (arcs < 40 || (liquidity < 40 && volatility > 65)) {
    return {
      group: "Fragile / High Risk",
      intent:
        "Assets misaligned with the environment and structurally exposed.",
      explanation:
        "Significant misalignment detected with structural exposure to volatility or liquidity gaps.",
    };
  }

  // 2. Market Leaders
  if (arcs >= 75 && trend >= 65 && liquidity >= 65) {
    return {
      group: "Market Leaders",
      intent:
        "Assets structurally aligned with the current environment and leading participation.",
      explanation:
        "Exhibiting strong trend alignment and high execution quality in the current regime.",
    };
  }

  // 3. Momentum Decay
  if (trend >= 60 && momentum <= 45 && arcs >= 50) {
    return {
      group: "Momentum Decay",
      intent: "Assets with intact structure but weakening short-term dynamics.",
      explanation:
        "Long-term trend remains positive but short-term momentum is showing signs of exhaustion.",
    };
  }

  // 4. Regime-Sensitive
  if (
    arcs >= 45 &&
    arcs <= 59 &&
    (volatility >= 65 || assetType === "crypto")
  ) {
    return {
      group: "Regime-Sensitive",
      intent: "Performance likely to change if market conditions shift.",
      explanation:
        "High sensitivity to regime shifts due to volatility profile or asset classification.",
    };
  }

  // 5. Regime-Aligned
  if (arcs >= 60 && arcs <= 74 && trend >= 55 && liquidity >= 50) {
    return {
      group: "Regime-Aligned",
      intent: "Assets that fit the environment but are not dominant leaders.",
      explanation:
        "Broadly consistent with current market conditions but lacking leadership characteristics.",
    };
  }

  // 6. Neutral / Defensive
  if (
    arcs >= 40 &&
    arcs <= 59 &&
    trend >= 40 &&
    trend <= 59 &&
    volatility <= 50
  ) {
    return {
      group: "Neutral / Defensive",
      intent: "Assets with low sensitivity and low directional pressure.",
      explanation:
        "Stable structure with low environmental sensitivity, typically serving as a defensive buffer.",
    };
  }

  // Default fallback (Regime-Aligned if arcs is decent, or Neutral)
  if (arcs >= 50) {
    return {
      group: "Regime-Aligned",
      intent: "Assets that fit the environment.",
      explanation:
        "Current characteristics are broadly compatible with the market environment.",
    };
  }

  return {
    group: "Neutral / Defensive",
    intent: "Neutral exposure.",
    explanation: "Minimal directional pressure or environmental fit detected.",
  };
}
