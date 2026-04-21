export interface RiskRewardScore {
  ratio: number;
  label: string;
  components: { upside: number; downside: number };
}

export interface CryptoRiskRewardInput {
  currentPrice: number;
  ath: number | null | undefined;
  atl: number | null | undefined;
  cycleStage?: "accumulation" | "early-bull" | "mid-bull" | "late-bull" | "distribution" | "bear" | "unknown";
  fdvToMcapRatio?: number | null;
  currentRegime: string;
}

export function calculateCryptoRiskReward(input: CryptoRiskRewardInput): RiskRewardScore | null {
  const { currentPrice, ath, atl, cycleStage, fdvToMcapRatio, currentRegime } = input;
  if (!currentPrice || (!ath && !atl)) return null;

  // Upside: distance to ATH (primary) or extrapolated from ATL recovery
  const upsideTarget = ath || currentPrice * 2;
  const upsideToATH = Math.max(0, (upsideTarget - currentPrice) / currentPrice);

  // Downside: distance to ATL (primary) or structural floor estimate
  const downsideFloor = atl || currentPrice * 0.5;
  const downsideToFloor = Math.max(0.01, (currentPrice - downsideFloor) / currentPrice);

  // Regime multiplier: RISK_OFF amplifies downside
  const regimeMultiplier = currentRegime === "RISK_OFF" ? 1.5 : 1.0;
  const downsideAdjusted = downsideToFloor * regimeMultiplier;

  // Cycle stage adjustment: late-bull / distribution reduces upside, bear increases downside
  let cycleMultiplier = 1.0;
  if (cycleStage === "late-bull" || cycleStage === "distribution") cycleMultiplier = 0.7;
  else if (cycleStage === "bear") cycleMultiplier = 0.5;
  else if (cycleStage === "accumulation" || cycleStage === "early-bull") cycleMultiplier = 1.3;

  const adjustedUpside = upsideToATH * cycleMultiplier;

  // FDV/MCap penalty: high dilution reduces effective upside
  const dilutionPenalty = fdvToMcapRatio && fdvToMcapRatio > 2 ? 0.8 : 1.0;
  const finalUpside = adjustedUpside * dilutionPenalty;

  const ratio = finalUpside / downsideAdjusted;

  return {
    ratio,
    label: ratio > 2.0 ? "FAVORABLE" : ratio > 1.0 ? "NEUTRAL" : "UNFAVORABLE",
    components: { upside: finalUpside, downside: downsideAdjusted }
  };
}

export function formatCryptoRiskRewardContext(score: RiskRewardScore, cycleStage?: string): string {
  const ratioStr = score.ratio.toFixed(2);
  const upsidePct = (score.components.upside * 100).toFixed(1);
  const downsidePct = (score.components.downside * 100).toFixed(1);
  const cycleNote = cycleStage && cycleStage !== "unknown" ? ` | Cycle: ${cycleStage}` : "";
  return `[CRYPTO_RISK_REWARD] Asymmetry Ratio: ${ratioStr}x (${score.label}) | Upside to ATH: +${upsidePct}% | Downside to Floor: -${downsidePct}% (Regime Adjusted)${cycleNote}`;
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
