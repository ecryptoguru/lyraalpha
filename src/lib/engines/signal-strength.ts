import { AssetSignals, CompatibilityResult } from "./compatibility";
import { MarketContextSnapshot } from "./market-regime";
import { ScoreDynamics, EventImpact } from "@/types/analytics";

// ─── Signal Strength Types ───────────────────────────────────────────────────

export type SignalLabel =
  | "Strong Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Strong Bearish";

export type SignalConfidence = "low" | "medium" | "high";

export type AssetCategory = "STOCK" | "CRYPTO" | "ETF" | "MUTUAL_FUND" | "COMMODITY";

export interface SignalStrengthResult {
  score: number;                    // 0-100 composite
  label: SignalLabel;
  confidence: SignalConfidence;
  breakdown: {
    dse: number;                    // 0-100 DSE composite sub-score
    regime: number;                 // 0-100 regime alignment sub-score
    fundamental: number;            // 0-100 fundamental quality sub-score
    dynamics: number;               // 0-100 score dynamics sub-score
  };
  weights: {
    dse: number;
    regime: number;
    fundamental: number;
    dynamics: number;
  };
  keyDrivers: string[];             // Top 3 bullish drivers
  riskFactors: string[];            // Top 2 risk factors
  engineDirections: Record<string, string>; // Per-engine direction snapshot
  metadata: {
    dataCompleteness: number;       // 0-1 ratio of available data
    engineAgreement: number;        // 0-1 ratio of engines agreeing on direction
    regimeContext: string;          // Current regime label
    groupClassification?: string;   // Asset group
    assetType: string;
  };
}

export interface FundamentalData {
  peRatio?: number | null;
  industryPe?: number | null;
  pegRatio?: number | null;
  priceToBook?: number | null;
  roe?: number | null;
  roce?: number | null;
  profitMargins?: number | null;
  operatingMargins?: number | null;
  revenueGrowth?: number | null;
  dividendYield?: number | null;
  shortRatio?: number | null;
  heldPercentInstitutions?: number | null;
  targetMeanPrice?: number | null;
  currentPrice?: number | null;
  distanceFrom52WHigh?: number | null;
  beta?: number | null;
  debtToEquity?: number | null;
}

export interface SignalStrengthInput {
  signals: AssetSignals;
  compatibility: CompatibilityResult;
  marketContext: MarketContextSnapshot;
  assetType: string;
  scoreDynamics?: Record<string, ScoreDynamics> | null;
  eventAdjustedScores?: Record<string, EventImpact> | null;
  factorAlignment?: { score: number; regimeFit: string; dominantFactor?: string } | null;
  fundamentals?: FundamentalData | null;
  groupClassification?: string | null;
}

// ─── Asset-Type-Aware Weights ────────────────────────────────────────────────

interface LayerWeights {
  dse: number;
  regime: number;
  fundamental: number;
  dynamics: number;
}

const TYPE_WEIGHTS: Record<string, LayerWeights> = {
  STOCK:       { dse: 0.40, regime: 0.25, fundamental: 0.20, dynamics: 0.15 },
  CRYPTO:      { dse: 0.55, regime: 0.25, fundamental: 0.00, dynamics: 0.20 },
  ETF:         { dse: 0.45, regime: 0.25, fundamental: 0.15, dynamics: 0.15 },
  MUTUAL_FUND: { dse: 0.50, regime: 0.20, fundamental: 0.10, dynamics: 0.20 },
  COMMODITY:   { dse: 0.50, regime: 0.30, fundamental: 0.00, dynamics: 0.20 },
};

const DSE_WEIGHTS: Record<string, Record<string, number>> = {
  STOCK:       { trend: 0.30, momentum: 0.25, volatility: 0.15, sentiment: 0.15, liquidity: 0.10, trust: 0.05 },
  CRYPTO:      { trend: 0.25, momentum: 0.30, volatility: 0.20, sentiment: 0.15, liquidity: 0.05, trust: 0.05 },
  ETF:         { trend: 0.30, momentum: 0.25, volatility: 0.15, sentiment: 0.10, liquidity: 0.15, trust: 0.05 },
  MUTUAL_FUND: { trend: 0.35, momentum: 0.20, volatility: 0.15, sentiment: 0.10, liquidity: 0.15, trust: 0.05 },
  COMMODITY:   { trend: 0.25, momentum: 0.30, volatility: 0.20, sentiment: 0.15, liquidity: 0.05, trust: 0.05 },
};

// ─── Core Engine ─────────────────────────────────────────────────────────────

export function calculateSignalStrength(input: SignalStrengthInput): SignalStrengthResult {
  const assetType = normalizeAssetType(input.assetType);
  const weights = TYPE_WEIGHTS[assetType] || TYPE_WEIGHTS.STOCK;
  const dseWeights = DSE_WEIGHTS[assetType] || DSE_WEIGHTS.STOCK;

  // Layer 1: DSE Composite
  const dseScore = calculateDSEComposite(input.signals, dseWeights);

  // Layer 2: Regime Alignment
  const regimeScore = calculateRegimeAlignment(
    input.compatibility,
    input.marketContext,
    input.factorAlignment,
    input.signals,
  );

  // Layer 3: Fundamental Quality
  const fundamentalScore = calculateFundamentalQuality(input.fundamentals, assetType);

  // Layer 4: Score Dynamics
  const dynamicsScore = calculateDynamicsScore(input.scoreDynamics);

  // Apply event adjustments as a modifier (±5 max)
  const eventModifier = calculateEventModifier(input.eventAdjustedScores);

  // Weighted composite
  let rawScore =
    dseScore * weights.dse +
    regimeScore * weights.regime +
    fundamentalScore * weights.fundamental +
    dynamicsScore * weights.dynamics;

  // Apply event modifier
  rawScore = clamp(rawScore + eventModifier, 0, 100);

  // Handle regime transitioning: reduce confidence in regime layer
  if (input.marketContext.regime.label === "TRANSITIONING") {
    const regimeReduction = regimeScore * weights.regime * 0.5;
    const dseBoost = regimeReduction;
    rawScore = clamp(
      (dseScore * weights.dse + dseBoost) +
      (regimeScore * weights.regime * 0.5) +
      (fundamentalScore * weights.fundamental) +
      (dynamicsScore * weights.dynamics) +
      eventModifier,
      0, 100
    );
  }

  const score = Math.round(rawScore);
  const label = scoreToLabel(score);
  const confidence = calculateConfidence(input);
  const keyDrivers = extractKeyDrivers(input, dseScore, regimeScore, fundamentalScore, dynamicsScore);
  const riskFactors = extractRiskFactors(input, regimeScore);
  const engineDirections = getEngineDirections(input.signals);
  const { agreement } = calculateEngineAgreement(input.signals);

  return {
    score,
    label,
    confidence,
    breakdown: {
      dse: Math.round(dseScore),
      regime: Math.round(regimeScore),
      fundamental: Math.round(fundamentalScore),
      dynamics: Math.round(dynamicsScore),
    },
    weights,
    keyDrivers: keyDrivers.slice(0, 3),
    riskFactors: riskFactors.slice(0, 2),
    engineDirections,
    metadata: {
      dataCompleteness: calculateDataCompleteness(input),
      engineAgreement: agreement,
      regimeContext: input.marketContext.regime.label,
      groupClassification: input.groupClassification || undefined,
      assetType,
    },
  };
}

// ─── Layer 1: DSE Composite ──────────────────────────────────────────────────

function calculateDSEComposite(signals: AssetSignals, weights: Record<string, number>): number {
  // Volatility is inverted: high volatility = risk = lower signal
  // Use effectiveVolatility consistently so all downstream logic is symmetric
  const adjustedSignals: Record<string, number> = {
    trend: signals.trend,
    momentum: signals.momentum,
    volatility: effectiveVolatility(signals.volatility),
    sentiment: signals.sentiment,
    liquidity: signals.liquidity,
    trust: signals.trust,
  };

  let composite = 0;
  for (const [key, weight] of Object.entries(weights)) {
    composite += (adjustedSignals[key] || 50) * weight;
  }

  return clamp(composite, 0, 100);
}

// ─── Layer 2: Regime Alignment ───────────────────────────────────────────────

function calculateRegimeAlignment(
  compatibility: CompatibilityResult,
  marketContext: MarketContextSnapshot,
  factorAlignment: { score: number; regimeFit: string } | null | undefined,
  signals: AssetSignals,
): number {
  // Base: ARCS compatibility score (50% weight)
  const arcsScore = compatibility.score;

  // Factor alignment (25% weight)
  const factorScore = factorAlignment?.score ?? 50;

  // Regime momentum bonus (25% weight)
  const regimeMomentumBonus = calculateRegimeMomentumBonus(
    marketContext.regime.label,
    signals,
  );

  return clamp(
    arcsScore * 0.50 + factorScore * 0.25 + regimeMomentumBonus * 0.25,
    0, 100,
  );
}

function calculateRegimeMomentumBonus(regime: string, signals: AssetSignals): number {
  // Use effectiveVolatility so low-vol = high score, consistently
  const effVol = effectiveVolatility(signals.volatility);

  switch (regime) {
    case "STRONG_RISK_ON": {
      // Continuous blend: base 40, scales linearly with avg(trend, momentum) up to 100
      const avgTrendMom = (signals.trend + signals.momentum) / 2;
      return clamp(40 + avgTrendMom * 0.6, 40, 100);
    }
    case "RISK_ON": {
      // Linear: base 35, scales with trend up to 85
      return clamp(35 + signals.trend * 0.5, 35, 85);
    }
    case "NEUTRAL":
      return 50;
    case "DEFENSIVE": {
      // Rewards low vol (high effVol) + high liquidity — continuous blend
      const defScore = (effVol * 0.6 + signals.liquidity * 0.4);
      return clamp(30 + defScore * 0.55, 30, 85);
    }
    case "RISK_OFF": {
      // Rewards defensive positioning — continuous scale with effVol
      return clamp(30 + effVol * 0.55, 30, 85);
    }
    case "TRANSITIONING":
      return 45;
    default:
      return 50;
  }
}

// ─── Layer 3: Fundamental Quality ────────────────────────────────────────────

function calculateFundamentalQuality(
  fundamentals: FundamentalData | null | undefined,
  assetType: string,
): number {
  // No fundamentals for crypto/commodities — return neutral
  if (!fundamentals || assetType === "CRYPTO" || assetType === "COMMODITY") {
    return 50;
  }

  const valuationScore = calculateValuationScore(fundamentals);
  const profitabilityScore = calculateProfitabilityScore(fundamentals);
  const analystScore = calculateAnalystScore(fundamentals);
  const ownershipScore = calculateOwnershipScore(fundamentals);

  return clamp(
    valuationScore * 0.35 +
    profitabilityScore * 0.25 +
    analystScore * 0.25 +
    ownershipScore * 0.15,
    0, 100,
  );
}

function calculateValuationScore(f: FundamentalData): number {
  const score = 50; // Start neutral
  let factors = 0;
  let total = 0;

  // P/E vs Industry P/E
  if (f.peRatio != null && f.industryPe != null && f.industryPe > 0) {
    const peRatio = f.peRatio / f.industryPe;
    if (peRatio < 0.7) total += 85;       // Significantly undervalued
    else if (peRatio < 0.9) total += 70;   // Moderately undervalued
    else if (peRatio < 1.1) total += 55;   // Fair value
    else if (peRatio < 1.3) total += 35;   // Moderately overvalued
    else total += 20;                       // Significantly overvalued
    factors++;
  }

  // PEG Ratio
  if (f.pegRatio != null && f.pegRatio > 0) {
    if (f.pegRatio < 0.5) total += 90;
    else if (f.pegRatio < 1.0) total += 75;
    else if (f.pegRatio < 1.5) total += 55;
    else if (f.pegRatio < 2.0) total += 35;
    else total += 15;
    factors++;
  }

  // Price to Book
  if (f.priceToBook != null && f.priceToBook > 0) {
    if (f.priceToBook < 1.0) total += 80;
    else if (f.priceToBook < 2.0) total += 65;
    else if (f.priceToBook < 3.0) total += 50;
    else if (f.priceToBook < 5.0) total += 35;
    else total += 20;
    factors++;
  }

  // Distance from 52W high (penalty for being near highs)
  if (f.distanceFrom52WHigh != null) {
    const dist = Math.abs(f.distanceFrom52WHigh);
    if (dist > 30) total += 75;       // Far from high — potential value
    else if (dist > 15) total += 60;
    else if (dist > 5) total += 45;
    else total += 30;                   // Near 52W high — expensive
    factors++;
  }

  return factors > 0 ? total / factors : score;
}

function calculateProfitabilityScore(f: FundamentalData): number {
  let total = 0;
  let factors = 0;

  // ROE
  if (f.roe != null) {
    const roePercent = Math.abs(f.roe) > 1 ? f.roe : f.roe * 100;
    if (roePercent > 20) total += 85;
    else if (roePercent > 15) total += 70;
    else if (roePercent > 10) total += 55;
    else if (roePercent > 5) total += 40;
    else total += 20;
    factors++;
  }

  // Operating Margins
  if (f.operatingMargins != null) {
    const margin = Math.abs(f.operatingMargins) > 1 ? f.operatingMargins : f.operatingMargins * 100;
    if (margin > 25) total += 85;
    else if (margin > 15) total += 70;
    else if (margin > 10) total += 55;
    else if (margin > 5) total += 40;
    else total += 20;
    factors++;
  }

  // Revenue Growth
  if (f.revenueGrowth != null) {
    const growth = Math.abs(f.revenueGrowth) > 1 ? f.revenueGrowth : f.revenueGrowth * 100;
    if (growth > 30) total += 90;
    else if (growth > 15) total += 75;
    else if (growth > 5) total += 55;
    else if (growth > 0) total += 40;
    else total += 20;
    factors++;
  }

  // Debt to Equity (lower is better)
  if (f.debtToEquity != null && f.debtToEquity >= 0) {
    if (f.debtToEquity < 30) total += 80;
    else if (f.debtToEquity < 60) total += 65;
    else if (f.debtToEquity < 100) total += 50;
    else if (f.debtToEquity < 150) total += 35;
    else total += 15;
    factors++;
  }

  return factors > 0 ? total / factors : 50;
}

function calculateAnalystScore(f: FundamentalData): number {
  if (!f.targetMeanPrice || !f.currentPrice || f.currentPrice <= 0) return 50;

  const upsidePercent = ((f.targetMeanPrice - f.currentPrice) / f.currentPrice) * 100;

  if (upsidePercent > 30) return 90;
  if (upsidePercent > 20) return 80;
  if (upsidePercent > 10) return 65;
  if (upsidePercent > 5) return 55;
  if (upsidePercent > 0) return 45;
  if (upsidePercent > -10) return 35;
  if (upsidePercent > -20) return 25;
  return 15;
}

function calculateOwnershipScore(f: FundamentalData): number {
  let total = 0;
  let factors = 0;

  // Institutional ownership (higher = more professional confidence)
  if (f.heldPercentInstitutions != null) {
    const pct = f.heldPercentInstitutions > 1 ? f.heldPercentInstitutions : f.heldPercentInstitutions * 100;
    if (pct > 80) total += 80;
    else if (pct > 60) total += 70;
    else if (pct > 40) total += 55;
    else if (pct > 20) total += 40;
    else total += 25;
    factors++;
  }

  // Short ratio (lower is better — less bearish sentiment)
  if (f.shortRatio != null && f.shortRatio > 0) {
    if (f.shortRatio < 2) total += 75;
    else if (f.shortRatio < 4) total += 60;
    else if (f.shortRatio < 6) total += 45;
    else if (f.shortRatio < 10) total += 30;
    else total += 15;
    factors++;
  }

  // Beta (moderate beta preferred — not too volatile, not too defensive)
  if (f.beta != null && f.beta > 0) {
    if (f.beta >= 0.8 && f.beta <= 1.3) total += 70;
    else if (f.beta >= 0.5 && f.beta <= 1.5) total += 55;
    else if (f.beta < 0.5) total += 40; // Too defensive
    else total += 30; // Too volatile
    factors++;
  }

  return factors > 0 ? total / factors : 50;
}

// ─── Layer 4: Score Dynamics ─────────────────────────────────────────────────

function calculateDynamicsScore(
  scoreDynamics: Record<string, ScoreDynamics> | null | undefined,
): number {
  if (!scoreDynamics || Object.keys(scoreDynamics).length === 0) return 50;

  const entries = Object.values(scoreDynamics);
  if (entries.length === 0) return 50;

  // Average momentum across all score types
  const avgMomentum = entries.reduce((sum, d) => sum + (d.momentum || 0), 0) / entries.length;
  // Normalize momentum: typically -5 to +5 range → 0-100
  const momentumScore = clamp(50 + avgMomentum * 10, 0, 100);

  // Average acceleration
  const avgAcceleration = entries.reduce((sum, d) => sum + (d.acceleration || 0), 0) / entries.length;
  const accelerationScore = clamp(50 + avgAcceleration * 15, 0, 100);

  // Average percentile rank
  const avgPercentile = entries.reduce((sum, d) => sum + (d.percentileRank || 50), 0) / entries.length;

  // Trend consensus: how many are IMPROVING? (baked into weights, not additive)
  const improvingCount = entries.filter(d => d.trend === "IMPROVING").length;
  const deterioratingCount = entries.filter(d => d.trend === "DETERIORATING").length;
  // Net trend bonus: +15 at full improving, -15 at full deteriorating — scaled within weights
  const netTrendFraction = (improvingCount - deterioratingCount) / entries.length; // -1 to +1
  const trendAdjustedPercentile = clamp(avgPercentile + netTrendFraction * 15, 0, 100);

  // Weights sum to exactly 1.0 — no additive bonus outside the weighted sum
  return clamp(
    momentumScore * 0.35 +
    accelerationScore * 0.25 +
    trendAdjustedPercentile * 0.40,
    0, 100,
  );
}

// ─── Event Modifier ──────────────────────────────────────────────────────────

function calculateEventModifier(
  eventAdjustedScores: Record<string, EventImpact> | null | undefined,
): number {
  if (!eventAdjustedScores) return 0;

  const impacts = Object.values(eventAdjustedScores);
  const activeImpacts = impacts.filter(i => i.recentEvents > 0);
  if (activeImpacts.length === 0) return 0;

  // Average impact magnitude across active event types
  const avgImpact = activeImpacts.reduce((sum, i) => sum + (i.impactMagnitude || 0), 0) / activeImpacts.length;

  // Clamp to ±5 to prevent events from dominating the signal
  return clamp(avgImpact / 2, -5, 5);
}

// ─── Signal Label Mapping ────────────────────────────────────────────────────

function scoreToLabel(score: number): SignalLabel {
  if (score >= 80) return "Strong Bullish";
  if (score >= 65) return "Bullish";
  if (score >= 45) return "Neutral";
  if (score >= 25) return "Bearish";
  return "Strong Bearish";
}

// ─── Confidence Calculation ──────────────────────────────────────────────────

function calculateConfidence(input: SignalStrengthInput): SignalConfidence {
  const dataCompleteness = calculateDataCompleteness(input);
  const { agreement, dominantDirection } = calculateEngineAgreement(input.signals);
  const regimeConfidence = input.marketContext.regime.confidence === "high" ? 1 : input.marketContext.regime.confidence === "medium" ? 0.6 : 0.3;

  const confidenceScore = dataCompleteness * 0.35 + agreement * 0.35 + regimeConfidence * 0.30;

  // Neutral agreement is not directional conviction — cap at "low"
  if (dominantDirection === "NEUTRAL") {
    if (confidenceScore >= 0.70) return "medium"; // Downgrade high → medium
    return "low";
  }

  if (confidenceScore >= 0.70) return "high";
  if (confidenceScore >= 0.45) return "medium";
  return "low";
}

function calculateDataCompleteness(input: SignalStrengthInput): number {
  let available = 0;
  const total = 9; // 6 DSE engines + 3 additional layers

  // Check each engine has non-zero data
  const s = input.signals;
  if (s.trend > 0) available++;
  if (s.momentum > 0) available++;
  if (s.volatility > 0) available++;
  if (s.sentiment > 0) available++;
  if (s.liquidity > 0) available++;
  if (s.trust > 0) available++;

  // Additional data layers
  if (input.compatibility.score > 0) available++;
  if (input.scoreDynamics && Object.keys(input.scoreDynamics).length > 0) available++;
  if (input.factorAlignment) available++;

  return available / total;
}

function calculateEngineAgreement(signals: AssetSignals): { agreement: number; dominantDirection: string } {
  const directions: string[] = [];

  // Classify each engine's direction using effectiveVolatility for consistency
  const classify = (score: number): string => {
    if (score >= 60) return "BULLISH";
    if (score <= 40) return "BEARISH";
    return "NEUTRAL";
  };

  directions.push(classify(signals.trend));
  directions.push(classify(signals.momentum));
  directions.push(classify(effectiveVolatility(signals.volatility))); // Unified inversion
  directions.push(classify(signals.sentiment));
  directions.push(classify(signals.liquidity));
  directions.push(classify(signals.trust));

  // Count the dominant direction
  const counts = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
  directions.forEach(d => counts[d as keyof typeof counts]++);

  const maxCount = Math.max(counts.BULLISH, counts.BEARISH, counts.NEUTRAL);
  const dominantDirection = (Object.keys(counts) as Array<keyof typeof counts>)
    .find(k => counts[k] === maxCount) ?? "NEUTRAL";

  return { agreement: maxCount / directions.length, dominantDirection };
}

// ─── Key Drivers Extraction ──────────────────────────────────────────────────

function extractKeyDrivers(
  input: SignalStrengthInput,
  dseScore: number,
  regimeScore: number,
  fundamentalScore: number,
  dynamicsScore: number,
): string[] {
  const drivers: { text: string; weight: number }[] = [];
  const s = input.signals;
  const effVol = effectiveVolatility(s.volatility); // Unified: high effVol = low raw vol = bullish

  // DSE-based drivers
  if (s.trend >= 65) {
    drivers.push({ text: `Strong uptrend detected (trend score: ${Math.round(s.trend)})`, weight: s.trend });
  }
  if (s.momentum >= 65) {
    drivers.push({ text: `Positive momentum across RSI and MACD indicators (score: ${Math.round(s.momentum)})`, weight: s.momentum });
  }
  if (effVol >= 65) { // effVol >= 65 means raw vol <= 35 — low volatility is bullish
    drivers.push({ text: `Low volatility environment supports price stability (vol: ${Math.round(s.volatility)})`, weight: effVol });
  }
  if (s.sentiment >= 65) {
    drivers.push({ text: `Volume-price analysis confirms accumulation pattern (sentiment: ${Math.round(s.sentiment)})`, weight: s.sentiment });
  }
  if (s.liquidity >= 70) {
    drivers.push({ text: `Strong liquidity conditions with healthy volume profile (score: ${Math.round(s.liquidity)})`, weight: s.liquidity });
  }
  if (s.trust >= 70) {
    drivers.push({ text: `High trust score indicates institutional-grade data quality (score: ${Math.round(s.trust)})`, weight: s.trust });
  }

  // Regime-based drivers
  if (regimeScore >= 65) {
    const regime = input.marketContext.regime.label;
    drivers.push({ text: `Positive alignment with current ${regime.replace(/_/g, " ").toLowerCase()} regime`, weight: regimeScore });
  }
  if (input.compatibility.label === "Strong Fit" || input.compatibility.label === "Good Fit") {
    drivers.push({ text: `${input.compatibility.label} with market regime (ARCS: ${input.compatibility.score})`, weight: input.compatibility.score });
  }

  // Fundamental drivers
  if (fundamentalScore >= 65 && input.fundamentals) {
    if (input.fundamentals.targetMeanPrice && input.fundamentals.currentPrice) {
      const upside = ((input.fundamentals.targetMeanPrice - input.fundamentals.currentPrice) / input.fundamentals.currentPrice) * 100;
      if (upside > 10) {
        drivers.push({ text: `Analyst consensus targets ${upside.toFixed(1)}% upside from current price`, weight: 60 + upside });
      }
    }
    if (input.fundamentals.roe != null) {
      const roePercent = Math.abs(input.fundamentals.roe) > 1 ? input.fundamentals.roe : input.fundamentals.roe * 100;
      if (roePercent > 15) {
        drivers.push({ text: `Strong capital efficiency with ROE at ${roePercent.toFixed(1)}%`, weight: 60 + roePercent });
      }
    }
  }

  // Dynamics drivers
  if (dynamicsScore >= 65 && input.scoreDynamics) {
    const improving = Object.values(input.scoreDynamics).filter(d => d.trend === "IMPROVING").length;
    if (improving >= 3) {
      drivers.push({ text: `Score dynamics improving across ${improving} dimensions — positive momentum`, weight: dynamicsScore });
    }
  }

  // Sort by weight descending
  drivers.sort((a, b) => b.weight - a.weight);
  return drivers.map(d => d.text);
}

// ─── Risk Factors Extraction ─────────────────────────────────────────────────

function extractRiskFactors(
  input: SignalStrengthInput,
  regimeScore: number,
): string[] {
  const risks: { text: string; weight: number }[] = [];
  const s = input.signals;

  // High volatility: raw vol >= 65 means effectiveVolatility <= 35 — risky
  if (s.volatility >= 65) {
    risks.push({ text: `Elevated volatility at ${Math.round(s.volatility)}th percentile — increased price swing risk`, weight: s.volatility });
  }

  // Weak trend
  if (s.trend <= 35) {
    risks.push({ text: `Weak trend structure suggests potential for further downside (score: ${Math.round(s.trend)})`, weight: 100 - s.trend });
  }

  // Negative momentum
  if (s.momentum <= 35) {
    risks.push({ text: `Negative momentum — RSI and MACD indicators signal continued weakness`, weight: 100 - s.momentum });
  }

  // Poor regime fit
  if (regimeScore <= 35) {
    risks.push({ text: `Poor alignment with current market regime — headwind for price appreciation`, weight: 100 - regimeScore });
  }

  // Weak compatibility
  if (input.compatibility.label === "Weak Fit" || input.compatibility.label === "Poor Fit") {
    risks.push({ text: `${input.compatibility.label} with regime — asset characteristics misaligned with market conditions`, weight: 100 - input.compatibility.score });
  }

  // Fundamental risks
  if (input.fundamentals) {
    if (input.fundamentals.shortRatio != null && input.fundamentals.shortRatio > 5) {
      risks.push({ text: `Elevated short interest (ratio: ${input.fundamentals.shortRatio.toFixed(1)}) — bearish institutional sentiment`, weight: 50 + input.fundamentals.shortRatio * 3 });
    }
    if (input.fundamentals.targetMeanPrice && input.fundamentals.currentPrice) {
      const downside = ((input.fundamentals.currentPrice - input.fundamentals.targetMeanPrice) / input.fundamentals.currentPrice) * 100;
      if (downside > 10) {
        risks.push({ text: `Trading ${downside.toFixed(1)}% above analyst mean target — potential overvaluation`, weight: 50 + downside });
      }
    }
    if (input.fundamentals.debtToEquity != null && input.fundamentals.debtToEquity > 100) {
      risks.push({ text: `High debt-to-equity ratio (${input.fundamentals.debtToEquity.toFixed(0)}%) — elevated financial leverage risk`, weight: 50 + input.fundamentals.debtToEquity / 5 });
    }
  }

  // Deteriorating dynamics
  if (input.scoreDynamics) {
    const deteriorating = Object.values(input.scoreDynamics).filter(d => d.trend === "DETERIORATING").length;
    if (deteriorating >= 3) {
      risks.push({ text: `Score dynamics deteriorating across ${deteriorating} dimensions — weakening signal quality`, weight: 60 + deteriorating * 5 });
    }
  }

  // Low liquidity
  if (s.liquidity <= 30) {
    risks.push({ text: `Thin liquidity conditions (score: ${Math.round(s.liquidity)}) — potential for slippage and wide spreads`, weight: 100 - s.liquidity });
  }

  // Sort by weight descending
  risks.sort((a, b) => b.weight - a.weight);
  return risks.map(r => r.text);
}

// ─── Engine Directions ───────────────────────────────────────────────────────

function getEngineDirections(signals: AssetSignals): Record<string, string> {
  const classify = (score: number): string => {
    if (score >= 70) return "STRONG_BULLISH";
    if (score >= 55) return "BULLISH";
    if (score >= 45) return "NEUTRAL";
    if (score >= 30) return "BEARISH";
    return "STRONG_BEARISH";
  };

  return {
    trend: classify(signals.trend),
    momentum: classify(signals.momentum),
    volatility: classify(effectiveVolatility(signals.volatility)), // Unified inversion
    sentiment: classify(signals.sentiment),
    liquidity: classify(signals.liquidity),
    trust: classify(signals.trust),
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function normalizeAssetType(type: string): string {
  const upper = type.toUpperCase().replace(/[\s-]/g, "_");
  if (upper.includes("MUTUAL") || upper === "MF") return "MUTUAL_FUND";
  if (upper === "CRYPTOCURRENCY" || upper === "CRYPTO") return "CRYPTO";
  if (upper === "EQUITY" || upper === "STOCK") return "STOCK";
  if (TYPE_WEIGHTS[upper]) return upper;
  return "STOCK"; // Default fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Single source of truth for volatility inversion: low raw vol = high effective score = bullish */
function effectiveVolatility(rawVolatility: number): number {
  return 100 - rawVolatility;
}
