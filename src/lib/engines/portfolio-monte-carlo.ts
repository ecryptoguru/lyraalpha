/**
 * Portfolio Monte Carlo Regime-Aware Simulation Engine
 * RS-MGBM: Regime-Switching Multivariate Geometric Brownian Motion
 * Based on montecarlo.md spec — non-predictive, probabilistic, risk-centric.
 */

export type SimulationMode = "A" | "B" | "C" | "D";

export type RegimeLabel = "STRONG_RISK_ON" | "RISK_ON" | "NEUTRAL" | "DEFENSIVE" | "RISK_OFF";

const REGIME_INDEX: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: 0,
  RISK_ON: 1,
  NEUTRAL: 2,
  DEFENSIVE: 3,
  RISK_OFF: 4,
};

const REGIME_LABELS: RegimeLabel[] = [
  "STRONG_RISK_ON",
  "RISK_ON",
  "NEUTRAL",
  "DEFENSIVE",
  "RISK_OFF",
];

const TRANSITION_MATRIX: number[][] = [
  [0.70, 0.20, 0.07, 0.02, 0.01],
  [0.15, 0.60, 0.15, 0.07, 0.03],
  [0.05, 0.15, 0.55, 0.18, 0.07],
  [0.02, 0.08, 0.20, 0.55, 0.15],
  [0.01, 0.04, 0.10, 0.25, 0.60],
];

const REGIME_VOL_MULTIPLIER: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: -0.20,
  RISK_ON: -0.05,
  NEUTRAL: 0.0,
  DEFENSIVE: 0.25,
  RISK_OFF: 0.65,
};

const REGIME_DRIFT_TILT: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: 0.0003,
  RISK_ON: 0.0001,
  NEUTRAL: 0.0,
  DEFENSIVE: -0.0001,
  RISK_OFF: -0.0004,
};

const REGIME_CORRELATION_GAMMA: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: 0.0,
  RISK_ON: 0.05,
  NEUTRAL: 0.15,
  DEFENSIVE: 0.35,
  RISK_OFF: 0.65,
};

const REGIME_LIQUIDITY_ETA: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: 0.0,
  RISK_ON: 0.02,
  NEUTRAL: 0.05,
  DEFENSIVE: 0.12,
  RISK_OFF: 0.25,
};

// Regime-dependent base-volatility multipliers for crypto portfolios (MC-1)
// Replaces flat 0.045 with state-aware calibration: bull = calmer, stress = fatter tails.
const CRYPTO_VOL_MULTIPLIERS: Record<RegimeLabel, number> = {
  STRONG_RISK_ON: 0.040,
  RISK_ON: 0.045,
  NEUTRAL: 0.055,
  DEFENSIVE: 0.075,
  RISK_OFF: 0.100,
};

export interface MCHoldingInput {
  symbol: string;
  weight: number;
  avgVolatilityScore: number | null;
  avgLiquidityScore: number | null;
  compatibilityScore: number | null;
  asset?: {
    factorAlignment?: unknown;
    correlationData?: unknown;
  };
}

export interface MCSimulationInput {
  holdings: { symbol: string; quantity: number; avgPrice: number; asset: MCHoldingInput["asset"] & {
    avgVolatilityScore: number | null;
    avgLiquidityScore: number | null;
    compatibilityScore: number | null;
    type?: string | null;
    fundingRate?: number | null;
    openInterestPercentile?: number | null;
  } }[];
  mode: SimulationMode;
  horizon: number;
  paths: number;
  region: string;
  currentRegime?: RegimeLabel;
  stressInjectStep?: number;
  isCryptoPortfolio?: boolean;
}

export interface MCSimulationResult {
  expectedReturn: number;
  medianReturn: number;
  p25Return: number;
  p75Return: number;
  var5: number;
  es5: number;
  maxDrawdownMean: number;
  maxDrawdownP95: number;
  regimeForecast: Record<RegimeLabel, number>;
  fragilityMean: number;
  fragilityP95: number;
  pathCount: number;
  horizon: number;
  mode: SimulationMode;
}

function sampleNextRegime(current: RegimeLabel, rng: () => number): RegimeLabel {
  const row = TRANSITION_MATRIX[REGIME_INDEX[current]];
  const u = rng();
  let cumulative = 0;
  for (let i = 0; i < row.length; i++) {
    cumulative += row[i];
    if (u <= cumulative) return REGIME_LABELS[i];
  }
  return current;
}

/**
 * Generate a non-repeating 32-bit seed using crypto randomness when available,
 * falling back to a time-based XOR. Avoids the module-level counter race
 * in concurrent serverless invocations.
 */
function uniqueSeed(): number {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  // Fallback: mix high-res timestamp bits with a random mantissa slice.
  const t = Date.now();
  const r = Math.random();
  return ((t ^ (r * 0x100000000)) >>> 0) || 1;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform — returns a pair of independent N(0,1) samples.
 * Callers should consume both values to halve RNG calls per simulation step.
 */
function boxMullerPair(rng: () => number): [number, number] {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  const mag = Math.sqrt(-2 * Math.log(u1));
  const angle = 2 * Math.PI * u2;
  return [mag * Math.cos(angle), mag * Math.sin(angle)];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function computePathMaxDrawdown(navPath: number[]): number {
  let peak = navPath[0] ?? 1;
  let maxDD = 0;
  for (const v of navPath) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function buildHoldingParams(
  holdings: MCSimulationInput["holdings"],
  isCryptoPortfolio?: boolean,
  currentRegime: RegimeLabel = "NEUTRAL",
): {
  weights: number[];
  baseVols: number[];
  liquidityFragilities: number[];
  factorAlignments: number[];
  isCrypto: boolean;
  avgVol: number;
  maxFundingRate: number;
  maxOIPercentile: number;
} {
  const totalValue = holdings.reduce((s, h) => {
    const price = h.avgPrice > 0 ? h.avgPrice : 1;
    return s + h.quantity * price;
  }, 0);

  const weights = holdings.map((h) => {
    const price = h.avgPrice > 0 ? h.avgPrice : 1;
    return totalValue > 0 ? (h.quantity * price) / totalValue : 1 / holdings.length;
  });

  const isCrypto = isCryptoPortfolio ?? holdings.some((h) => h.asset.type === "CRYPTO");
  // Crypto assets have ~2x higher realized daily volatility than traditional assets.
  // Regime-dependent base multiplier (MC-1): calmer in bull, fatter in stress.
  const VOL_MULTIPLIER = isCrypto
    ? CRYPTO_VOL_MULTIPLIERS[currentRegime]
    : 0.025;

  const baseVols = holdings.map((h) => {
    const volScore = h.asset.avgVolatilityScore ?? 50;
    return (volScore / 100) * VOL_MULTIPLIER;
  });

  const avgVol = baseVols.reduce((s, v) => s + v, 0) / (baseVols.length || 1);

  const liquidityFragilities = holdings.map((h) => {
    const liq = h.asset.avgLiquidityScore ?? 50;
    return 1 - liq / 100;
  });

  const factorAlignments = holdings.map((h) => {
    const compat = h.asset.compatibilityScore ?? 50;
    return compat / 100;
  });

  const maxFundingRate = Math.max(
    0,
    ...holdings.map((h) => h.asset.fundingRate ?? 0),
  );
  const maxOIPercentile = Math.max(
    0,
    ...holdings.map((h) => h.asset.openInterestPercentile ?? 0),
  );

  return { weights, baseVols, liquidityFragilities, factorAlignments, isCrypto, avgVol, maxFundingRate, maxOIPercentile };
}

/**
 * Student-t(3) inverse-CDF approximation for Lévy / jump-diffusion shocks.
 * Hard-coded for df=3 — the tail inflation factor (0.35) is specific to
 * excess kurtosis at this degrees-of-freedom. Do not pass other df values.
 */
function tDistributionShockDf3(u: number): number {
  // Avoid the exact tails to prevent numerical blow-up
  const p = Math.min(Math.max(u, 1e-6), 1 - 1e-6);
  // Normal inverse-CDF via rational approximation (Peter J. Acklam)
  const z = normalInverseCdf(p);
  // Adjust for excess kurtosis of t(df=3): inflate tails ~1.35x
  const tailFactor = 1 + 0.35 / (1 + Math.exp(2 * Math.abs(z)));
  return z * tailFactor;
}

function normalInverseCdf(p: number): number {
  // Acklam approximation for the inverse standard-normal CDF
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239e0;
  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;
  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838e0;
  const c4 = -2.549732539343734e0;
  const c5 = 4.374664141464968e0;
  const c6 = 2.938163982698783e0;
  const d1 = 7.784695709041502e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996e0;
  const d4 = 3.754408661907416e0;
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

export async function runMonteCarloSimulation(input: MCSimulationInput): Promise<MCSimulationResult> {
  const { holdings, mode, horizon, paths, currentRegime = "NEUTRAL", stressInjectStep = Math.floor(horizon / 2) } = input;

  if (holdings.length === 0) {
    throw new Error("No holdings provided for simulation");
  }

  const { weights, baseVols, liquidityFragilities, factorAlignments, isCrypto, avgVol, maxFundingRate, maxOIPercentile } = buildHoldingParams(holdings, input.isCryptoPortfolio, currentRegime);
  const n = holdings.length;

  const rng = mulberry32(uniqueSeed());

  const cumulativeReturns: number[] = [];
  const maxDrawdowns: number[] = [];
  const fragilityScores: number[] = [];
  const finalRegimes: RegimeLabel[] = [];

  const isMarkov = mode === "B";
  const isStress = mode === "C";
  const isFactorShock = mode === "D";

  for (let m = 0; m < paths; m++) {
    let regime: RegimeLabel = currentRegime;
    const portfolioNAV: number[] = [1.0];
    let portfolioValue = 1.0;

    // Flash-crash injection: once per simulation, a single-day -25% to -45% drawdown
    // occurs with probability scaled by portfolio volatility. Models cascading liquidations.
    // Day 4: If funding rate > 3% and OI in 90th+ percentile, double crash probability.
    let flashCrashStep = -1;
    let secondaryCrashStep = -1;
    if (isCrypto) {
      let crashProbability = Math.min(0.25, avgVol * 1.5); // ~7.5-22.5% for typical crypto vols (0.05-0.15)
      if (maxFundingRate > 0.03 && maxOIPercentile > 0.90) {
        crashProbability = Math.min(0.45, crashProbability * 2);
      }
      if (rng() < crashProbability) {
        flashCrashStep = Math.floor(rng() * horizon);
        // Secondary shock 2 days after mid-point when leverage is crowded (Day 4)
        if (maxFundingRate > 0.03 && maxOIPercentile > 0.90) {
          secondaryCrashStep = Math.min(horizon - 1, Math.floor(horizon / 2) + 2);
        }
      }
    }

    for (let t = 0; t < horizon; t++) {
      if (isMarkov) {
        regime = sampleNextRegime(regime, rng);
      } else if (isStress && t === stressInjectStep) {
        regime = "RISK_OFF";
      } else if (isFactorShock && t === stressInjectStep) {
        regime = "DEFENSIVE";
      }

      const volMultiplier = 1 + REGIME_VOL_MULTIPLIER[regime];
      const driftTilt = REGIME_DRIFT_TILT[regime];
      // MC-5: Dynamic correlation jump — in stress/flash-crash steps, crypto pairs
      // correlate up to at least 0.85 (same-sector contagion).
      let gamma = REGIME_CORRELATION_GAMMA[regime];
      if (isCrypto && (t === flashCrashStep || t === secondaryCrashStep || regime === "RISK_OFF")) {
        gamma = Math.max(gamma, 0.85);
      }
      const eta = REGIME_LIQUIDITY_ETA[regime];

      // Flash crash: single-day -25% to -45% drawdown, correlated across assets.
      // Day 5: Use t-distribution(df=3) shock for fatter tails instead of uniform draw.
      let flashCrashReturn = 0;
      if (t === flashCrashStep || t === secondaryCrashStep) {
        const u = rng();
        const tShock = tDistributionShockDf3(u);
        // Map t-shock (-inf,+inf) to crash depth 15%–55% (fatter left tail)
        const depth = 0.15 + Math.min(0.55, Math.max(0, 0.20 + tShock * 0.12));
        flashCrashReturn = -depth;
      }

      // Draw one systematic shock shared across all assets for this step.
      const [systematicZ, spareZ] = boxMullerPair(rng);
      let spareUsed = false;
      let spareValue = spareZ;

      let stepReturn = 0;
      for (let i = 0; i < n; i++) {
        const sigmaRegime = baseVols[i] * volMultiplier;
        const liquidityPenalty = eta * liquidityFragilities[i];
        const factorBoost = (factorAlignments[i] - 0.5) * 0.0002;
        const drift = driftTilt + factorBoost - liquidityPenalty;

        // Recycle the spare normal from the previous pair to avoid an extra RNG call.
        let idiosyncratic: number;
        if (!spareUsed) {
          idiosyncratic = spareValue;
          spareUsed = true;
        } else {
          const [z1, z2] = boxMullerPair(rng);
          idiosyncratic = z1;
          spareValue = z2;
          spareUsed = false;
        }

        const correlatedNoise =
          Math.sqrt(1 - gamma) * idiosyncratic + Math.sqrt(gamma) * systematicZ;

        let assetReturn = drift + sigmaRegime * correlatedNoise;

        // Apply flash crash with asset-specific sensitivity (higher vol assets crash deeper)
        if (flashCrashReturn !== 0) {
          const volRatio = baseVols[i] / (avgVol || 0.01);
          assetReturn += flashCrashReturn * Math.min(1.5, volRatio * 1.2);
        }

        stepReturn += weights[i] * assetReturn;
      }

      portfolioValue *= Math.exp(stepReturn);
      portfolioNAV.push(portfolioValue);
    }

    const cumulativeReturn = portfolioNAV[portfolioNAV.length - 1] - 1;
    cumulativeReturns.push(cumulativeReturn);
    const pathMaxDD = computePathMaxDrawdown(portfolioNAV);
    maxDrawdowns.push(pathMaxDD);
    finalRegimes.push(regime);

    const volFrag = baseVols.reduce((s, v, i) => s + v * weights[i], 0) * (1 + REGIME_VOL_MULTIPLIER[regime]);
    const liqFrag = liquidityFragilities.reduce((s, l, i) => s + l * weights[i], 0);
    const drawdownFrag = pathMaxDD;
    fragilityScores.push(
      Math.min(100, (volFrag * 40 + liqFrag * 30 + drawdownFrag * 30) * 100),
    );
  }

  const sortedReturns = [...cumulativeReturns].sort((a, b) => a - b);
  const sortedDrawdowns = [...maxDrawdowns].sort((a, b) => a - b);
  const sortedFragility = [...fragilityScores].sort((a, b) => a - b);

  const var5Idx = Math.floor(0.05 * sortedReturns.length);
  const var5 = sortedReturns[var5Idx] ?? sortedReturns[0];
  const tailReturns = sortedReturns.slice(0, var5Idx + 1);
  const es5 = tailReturns.length > 0
    ? tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length
    : var5;

  const regimeCounts: Record<RegimeLabel, number> = {
    STRONG_RISK_ON: 0, RISK_ON: 0, NEUTRAL: 0, DEFENSIVE: 0, RISK_OFF: 0,
  };
  for (const r of finalRegimes) regimeCounts[r]++;
  const regimeForecast = Object.fromEntries(
    Object.entries(regimeCounts).map(([k, v]) => [k, Math.round((v / paths) * 1000) / 1000]),
  ) as Record<RegimeLabel, number>;

  return {
    expectedReturn: Math.round((cumulativeReturns.reduce((s, r) => s + r, 0) / paths) * 10000) / 10000,
    medianReturn: Math.round(percentile(sortedReturns, 0.5) * 10000) / 10000,
    p25Return: Math.round(percentile(sortedReturns, 0.25) * 10000) / 10000,
    p75Return: Math.round(percentile(sortedReturns, 0.75) * 10000) / 10000,
    var5: Math.round(var5 * 10000) / 10000,
    es5: Math.round(es5 * 10000) / 10000,
    maxDrawdownMean: Math.round((maxDrawdowns.reduce((s, d) => s + d, 0) / paths) * 10000) / 10000,
    maxDrawdownP95: Math.round(percentile(sortedDrawdowns, 0.95) * 10000) / 10000,
    regimeForecast,
    fragilityMean: Math.round((fragilityScores.reduce((s, f) => s + f, 0) / paths) * 10) / 10,
    fragilityP95: Math.round(percentile(sortedFragility, 0.95) * 10) / 10,
    pathCount: paths,
    horizon,
    mode,
  };
}
