/**
 * Scenario Engine (Phase 3 - Wave 2)
 * 
 * Simulates conditional forward distributions under structured regime shifts.
 * Does NOT predict prices — models risk-adjusted scenario outcomes.
 * 
 * Components:
 * 1. Regime Transition Model (Markov chain)
 * 2. Factor Sensitivity Model (regime-conditional alpha)
 * 3. Volatility Shock Model (regime-dependent vol scaling)
 * 4. Correlation Stress Model (crisis convergence)
 * 5. Liquidity Impact Model (drawdown amplification)
 */

import type { MarketContextSnapshot } from "./market-regime";

export type RegimeLabel = "STRONG_RISK_ON" | "RISK_ON" | "NEUTRAL" | "DEFENSIVE" | "RISK_OFF";

export interface AssetSignals {
  trend: number;
  momentum: number;
  volatility: number;
  liquidity: number;
  sentiment: number;
  trust: number;
}

export interface FactorProfile {
  value: number;
  growth: number;
  momentum: number;
  lowVol: number;
}

export interface ScenarioResult {
  bullCase: {
    expectedReturn: number;
    regime: RegimeLabel;
    confidence: number;
  };
  baseCase: {
    expectedReturn: number;
    regimeProbabilities: Record<RegimeLabel, number>;
  };
  bearCase: {
    expectedReturn: number;
    regime: RegimeLabel;
    confidence: number;
  };
  var5: number; // 5% Value-at-Risk (1D, 95%)
  es5: number; // 5% Expected Shortfall (1D, 95%)
  fragility: number; // 0-100 composite fragility score
  metadata: {
    currentRegime: RegimeLabel;
    factorAlignment: Record<RegimeLabel, number>;
    volatilityMultipliers: Record<RegimeLabel, number>;
    liquidityFragility: number;
    risk: {
      method: "empirical" | "normal";
      confidence: 0.95 | 0.99;
      horizon: "1D" | "1W";
      sampleSize: number;
      displayCapLossPct: number;
    };
  };
}

const DEFAULT_DISPLAY_CAP_LOSS_PCT = -95;
const MIN_EMPIRICAL_SAMPLE_1D = 120;
const MIN_EMPIRICAL_SAMPLE_1W = 60;

function roundPct(x: number): number {
  return Math.round(x * 10000) / 100;
}

function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

function empiricalVarEs(returns: number[], confidence: 0.95 | 0.99): {
  method: "empirical";
  varPct: number;
  esPct: number;
  sampleSize: number;
} {
  const alpha = 1 - confidence;
  const sorted = [...returns].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const q = quantileSorted(sorted, alpha);
  const tail = sorted.filter((v) => v <= q);
  const es = tail.length ? tail.reduce((s, v) => s + v, 0) / tail.length : q;

  return {
    method: "empirical",
    varPct: roundPct(q),
    esPct: roundPct(es),
    sampleSize: sorted.length,
  };
}

function normalVarEs(args: {
  mean: number;
  vol: number;
  confidence: 0.95 | 0.99;
}): {
  method: "normal";
  varPct: number;
  esPct: number;
  sampleSize: number;
} {
  const z = args.confidence === 0.99 ? 2.3263478740408408 : 1.6448536269514722;
  const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const alpha = 1 - args.confidence;

  const varVal = args.mean - z * args.vol;
  const esVal = args.mean - (args.vol * phi(z)) / alpha;

  return {
    method: "normal",
    varPct: roundPct(varVal),
    esPct: roundPct(esVal),
    sampleSize: 0,
  };
}

function toRollingReturns(returns1d: number[], window: number): number[] {
  if (window <= 1) return returns1d;
  const out: number[] = [];
  for (let i = 0; i + window - 1 < returns1d.length; i++) {
    let acc = 1;
    for (let j = 0; j < window; j++) acc *= 1 + returns1d[i + j];
    out.push(acc - 1);
  }
  return out;
}

export function computeRiskMetrics(args: {
  meanReturn: number;
  volatilityScore: number;
  stressRegime: RegimeLabel;
  historicalReturns?: {
    returns1d?: number[];
    returns1w?: number[];
  };
  horizon?: "1D" | "1W";
  confidence?: 0.95 | 0.99;
  displayCapLossPct?: number;
}): {
  method: "empirical" | "normal";
  horizon: "1D" | "1W";
  confidence: 0.95 | 0.99;
  sampleSize: number;
  displayCapLossPct: number;
  varPct: number;
  esPct: number;
} {
  const horizon = args.horizon ?? "1D";
  const confidence = args.confidence ?? 0.95;
  const displayCapLossPct = args.displayCapLossPct ?? DEFAULT_DISPLAY_CAP_LOSS_PCT;

  const stressVol = (args.volatilityScore / 100) * VOL_MULTIPLIERS[args.stressRegime];
  const empiricalSeries =
    horizon === "1W"
      ? (args.historicalReturns?.returns1w ??
          (args.historicalReturns?.returns1d
            ? toRollingReturns(args.historicalReturns.returns1d, 5)
            : undefined))
      : args.historicalReturns?.returns1d;

  const minSample = horizon === "1W" ? MIN_EMPIRICAL_SAMPLE_1W : MIN_EMPIRICAL_SAMPLE_1D;
  const risk =
    empiricalSeries && empiricalSeries.length >= minSample
      ? empiricalVarEs(empiricalSeries, confidence)
      : normalVarEs({ mean: args.meanReturn, vol: stressVol, confidence });

  return {
    method: risk.method,
    horizon,
    confidence,
    sampleSize: risk.sampleSize,
    displayCapLossPct,
    varPct: risk.varPct,
    esPct: risk.esPct,
  };
}

// Regime transition matrix (empirical estimates, can be refined with historical MRDE data)
const TRANSITION_MATRIX: Record<RegimeLabel, Record<RegimeLabel, number>> = {
  STRONG_RISK_ON: {
    STRONG_RISK_ON: 0.6,
    RISK_ON: 0.25,
    NEUTRAL: 0.1,
    DEFENSIVE: 0.04,
    RISK_OFF: 0.01,
  },
  RISK_ON: {
    STRONG_RISK_ON: 0.2,
    RISK_ON: 0.5,
    NEUTRAL: 0.2,
    DEFENSIVE: 0.08,
    RISK_OFF: 0.02,
  },
  NEUTRAL: {
    STRONG_RISK_ON: 0.1,
    RISK_ON: 0.2,
    NEUTRAL: 0.4,
    DEFENSIVE: 0.2,
    RISK_OFF: 0.1,
  },
  DEFENSIVE: {
    STRONG_RISK_ON: 0.02,
    RISK_ON: 0.08,
    NEUTRAL: 0.2,
    DEFENSIVE: 0.5,
    RISK_OFF: 0.2,
  },
  RISK_OFF: {
    STRONG_RISK_ON: 0.01,
    RISK_ON: 0.04,
    NEUTRAL: 0.15,
    DEFENSIVE: 0.3,
    RISK_OFF: 0.5,
  },
};

// Regime factor preference vectors (how much each regime favors each factor)
const REGIME_FACTOR_PREFERENCE: Record<RegimeLabel, FactorProfile> = {
  STRONG_RISK_ON: { value: 0.15, growth: 0.45, momentum: 0.3, lowVol: 0.1 },
  RISK_ON: { value: 0.2, growth: 0.4, momentum: 0.25, lowVol: 0.15 },
  NEUTRAL: { value: 0.25, growth: 0.25, momentum: 0.25, lowVol: 0.25 },
  DEFENSIVE: { value: 0.35, growth: 0.1, momentum: 0.15, lowVol: 0.4 },
  RISK_OFF: { value: 0.4, growth: 0.05, momentum: 0.1, lowVol: 0.45 },
};

// Volatility multipliers per regime (how much vol changes under each regime)
const VOL_MULTIPLIERS: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: 0.85,
  RISK_ON: 1.0,
  NEUTRAL: 1.1,
  DEFENSIVE: 1.25,
  RISK_OFF: 1.6,
};

/**
 * Calculate factor alignment score for a given regime.
 * Higher score = asset's factor profile aligns well with regime preferences.
 */
function calculateFactorAlignment(
  assetFactors: FactorProfile,
  regime: RegimeLabel,
): number {
  const prefs = REGIME_FACTOR_PREFERENCE[regime];
  
  // Normalize asset factors to z-scores (simplified: assume mean=50, std=15)
  const zValue = (assetFactors.value - 50) / 15;
  const zGrowth = (assetFactors.growth - 50) / 15;
  const zMomentum = (assetFactors.momentum - 50) / 15;
  const zLowVol = (assetFactors.lowVol - 50) / 15;

  const alignment =
    zValue * prefs.value +
    zGrowth * prefs.growth +
    zMomentum * prefs.momentum +
    zLowVol * prefs.lowVol;

  // Scale to 0-100 range (alignment can be negative if misaligned)
  return Math.round(Math.max(0, Math.min(100, 50 + alignment * 10)));
}

/**
 * Calculate regime-conditional expected return.
 * Baseline drift + factor-adjusted alpha - liquidity penalty.
 */
function calculateRegimeReturn(
  baselineDrift: number,
  factorAlignment: number,
  liquidityFragility: number,
  regime: RegimeLabel,
): number {
  const betaFactor = 0.15; // factor sensitivity coefficient
  const deltaRegime = regime === "RISK_OFF" ? 0.08 : regime === "DEFENSIVE" ? 0.04 : 0;

  const factorAlpha = betaFactor * ((factorAlignment - 50) / 50); // -0.15 to +0.15
  const liquidityPenalty = liquidityFragility * deltaRegime;

  return baselineDrift + factorAlpha - liquidityPenalty;
}

/**
 * Calculate fragility score (0-100).
 * Higher = more fragile (high vol, low liquidity, high correlation, poor defensive alignment).
 */
function calculateFragility(
  signals: AssetSignals,
  factorProfile: FactorProfile,
  correlationToBenchmark: number,
): number {
  const volComponent = signals.volatility; // already 0-100
  const liquidityComponent = 100 - signals.liquidity; // invert
  const corrComponent = Math.abs(correlationToBenchmark) * 100; // 0-100
  const defensiveAlignment = calculateFactorAlignment(factorProfile, "DEFENSIVE");
  const defensiveComponent = 100 - defensiveAlignment; // invert (low defensive = high fragility)

  const fragility =
    volComponent * 0.3 +
    liquidityComponent * 0.25 +
    corrComponent * 0.25 +
    defensiveComponent * 0.2;

  return Math.round(Math.max(0, Math.min(100, fragility)));
}

/**
 * Main scenario engine calculation.
 */
export function calculateScenarios(
  signals: AssetSignals,
  factorProfile: FactorProfile,
  currentRegime: MarketContextSnapshot,
  correlationToBenchmark: number = 0.5,
  historicalReturns?: {
    returns1d?: number[];
    returns1w?: number[];
  },
  riskOptions?: {
    horizon?: "1D" | "1W";
    confidence?: 0.95 | 0.99;
    displayCapLossPct?: number;
  },
): ScenarioResult {
  const currentRegimeLabel = currentRegime.regime.label as RegimeLabel;

  // 1. Calculate factor alignment for each regime
  const factorAlignment: Record<RegimeLabel, number> = {
    STRONG_RISK_ON: calculateFactorAlignment(factorProfile, "STRONG_RISK_ON"),
    RISK_ON: calculateFactorAlignment(factorProfile, "RISK_ON"),
    NEUTRAL: calculateFactorAlignment(factorProfile, "NEUTRAL"),
    DEFENSIVE: calculateFactorAlignment(factorProfile, "DEFENSIVE"),
    RISK_OFF: calculateFactorAlignment(factorProfile, "RISK_OFF"),
  };

  // 2. Calculate liquidity fragility (0-1)
  const liquidityFragility = (100 - signals.liquidity) / 100;

  // 3. Baseline drift (simplified: use trend + momentum as proxy)
  const baselineDrift = ((signals.trend + signals.momentum) / 200 - 0.5) * 0.2; // -0.1 to +0.1

  // 4. Calculate regime-conditional returns
  const regimeReturns: Record<RegimeLabel, number> = {
    STRONG_RISK_ON: calculateRegimeReturn(
      baselineDrift,
      factorAlignment.STRONG_RISK_ON,
      liquidityFragility,
      "STRONG_RISK_ON",
    ),
    RISK_ON: calculateRegimeReturn(
      baselineDrift,
      factorAlignment.RISK_ON,
      liquidityFragility,
      "RISK_ON",
    ),
    NEUTRAL: calculateRegimeReturn(
      baselineDrift,
      factorAlignment.NEUTRAL,
      liquidityFragility,
      "NEUTRAL",
    ),
    DEFENSIVE: calculateRegimeReturn(
      baselineDrift,
      factorAlignment.DEFENSIVE,
      liquidityFragility,
      "DEFENSIVE",
    ),
    RISK_OFF: calculateRegimeReturn(
      baselineDrift,
      factorAlignment.RISK_OFF,
      liquidityFragility,
      "RISK_OFF",
    ),
  };

  // 5. Forward regime probabilities (1-step transition)
  const transitionProbs = TRANSITION_MATRIX[currentRegimeLabel];

  // 6. Base case: probability-weighted expected return
  const baseCase =
    (Object.keys(transitionProbs) as RegimeLabel[]).reduce(
      (sum, r) => sum + transitionProbs[r] * regimeReturns[r],
      0,
    );

  // 7. Bull case: max return among risk-on regimes
  const bullRegime: RegimeLabel =
    regimeReturns.STRONG_RISK_ON > regimeReturns.RISK_ON
      ? "STRONG_RISK_ON"
      : "RISK_ON";
  const bullReturn = regimeReturns[bullRegime];
  const bullConfidence = transitionProbs[bullRegime];

  // 8. Bear case: min return among risk-off regimes
  const bearRegime: RegimeLabel =
    regimeReturns.RISK_OFF < regimeReturns.DEFENSIVE ? "RISK_OFF" : "DEFENSIVE";
  const bearReturn = regimeReturns[bearRegime];
  const bearConfidence = transitionProbs[bearRegime];

  // 9. VaR and ES
  const risk = computeRiskMetrics({
    meanReturn: bearReturn,
    volatilityScore: signals.volatility,
    stressRegime: bearRegime,
    historicalReturns,
    horizon: riskOptions?.horizon,
    confidence: riskOptions?.confidence,
    displayCapLossPct: riskOptions?.displayCapLossPct,
  });

  const var5 = risk.varPct;
  const es5 = risk.esPct;

  // 10. Fragility score
  const fragility = calculateFragility(signals, factorProfile, correlationToBenchmark);

  return {
    bullCase: {
      expectedReturn: Math.round(bullReturn * 10000) / 100, // as %
      regime: bullRegime,
      confidence: Math.round(bullConfidence * 100),
    },
    baseCase: {
      expectedReturn: Math.round(baseCase * 10000) / 100,
      regimeProbabilities: Object.fromEntries(
        (Object.keys(transitionProbs) as RegimeLabel[]).map((r) => [
          r,
          Math.round(transitionProbs[r] * 100),
        ]),
      ) as Record<RegimeLabel, number>,
    },
    bearCase: {
      expectedReturn: Math.round(bearReturn * 10000) / 100,
      regime: bearRegime,
      confidence: Math.round(bearConfidence * 100),
    },
    var5,
    es5,
    fragility,
    metadata: {
      currentRegime: currentRegimeLabel,
      factorAlignment,
      volatilityMultipliers: VOL_MULTIPLIERS,
      liquidityFragility: Math.round(liquidityFragility * 100),
      risk: {
        method: risk.method,
        confidence: risk.confidence,
        horizon: risk.horizon,
        sampleSize: risk.sampleSize,
        displayCapLossPct: risk.displayCapLossPct,
      },
    },
  };
}
