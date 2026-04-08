export interface RiskRewardScore {
  ratio: number;
  label: string;
  components: { upside: number; downside: number };
}

export function calculateRiskRewardAsymmetry(
  currentPrice: number | null | undefined,
  analystTargetMean: number | null | undefined,
  fiftyTwoWeekHigh: number | null | undefined,
  fiftyTwoWeekLow: number | null | undefined,
  currentRegime: string
): RiskRewardScore | null {
  if (!currentPrice || (!analystTargetMean && !fiftyTwoWeekHigh) || !fiftyTwoWeekLow) {
    return null; // Need sufficient data
  }

  // Upside: distance to consensus target or ATH if target is missing
  const targetPrice = analystTargetMean || fiftyTwoWeekHigh || currentPrice;
  const upsideToTarget = Math.max(0, (targetPrice - currentPrice) / currentPrice);
  
  // Downside: distance to stop-loss level (using 52W low as a proxy for max downside risk)
  // Ensure we don't divide by zero if price is strangely close to 52W low
  const downsideTo52WLow = Math.max(0.01, (currentPrice - fiftyTwoWeekLow) / currentPrice); 
  
  // Regime-adjusted: in RISK_OFF, downside risk is amplified
  const regimeMultiplier = currentRegime === "RISK_OFF" ? 1.5 : 1.0;
  
  const downsideAdjusted = downsideTo52WLow * regimeMultiplier;
  const ratio = upsideToTarget / downsideAdjusted;
  
  return {
    ratio,
    label: ratio > 2.0 ? "FAVORABLE" : ratio > 1.0 ? "NEUTRAL" : "UNFAVORABLE",
    components: { upside: upsideToTarget, downside: downsideAdjusted }
  };
}

export function formatRiskRewardContext(score: RiskRewardScore): string {
  const ratioStr = score.ratio.toFixed(2);
  const upsidePct = (score.components.upside * 100).toFixed(1);
  const downsidePct = (score.components.downside * 100).toFixed(1);
  return `[RISK_REWARD] Asymmetry Ratio: ${ratioStr}x (${score.label}) | Upside: +${upsidePct}% | Downside Risk: -${downsidePct}% (Regime Adjusted)`;
}
