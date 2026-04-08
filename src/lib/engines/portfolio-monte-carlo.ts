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
  } }[];
  mode: SimulationMode;
  horizon: number;
  paths: number;
  region: string;
  currentRegime?: RegimeLabel;
  stressInjectStep?: number;
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

function buildHoldingParams(holdings: MCSimulationInput["holdings"]): {
  weights: number[];
  baseVols: number[];
  liquidityFragilities: number[];
  factorAlignments: number[];
} {
  const totalValue = holdings.reduce((s, h) => {
    const price = h.avgPrice > 0 ? h.avgPrice : 1;
    return s + h.quantity * price;
  }, 0);

  const weights = holdings.map((h) => {
    const price = h.avgPrice > 0 ? h.avgPrice : 1;
    return totalValue > 0 ? (h.quantity * price) / totalValue : 1 / holdings.length;
  });

  const baseVols = holdings.map((h) => {
    const volScore = h.asset.avgVolatilityScore ?? 50;
    return (volScore / 100) * 0.025;
  });

  const liquidityFragilities = holdings.map((h) => {
    const liq = h.asset.avgLiquidityScore ?? 50;
    return 1 - liq / 100;
  });

  const factorAlignments = holdings.map((h) => {
    const compat = h.asset.compatibilityScore ?? 50;
    return compat / 100;
  });

  return { weights, baseVols, liquidityFragilities, factorAlignments };
}

export async function runMonteCarloSimulation(input: MCSimulationInput): Promise<MCSimulationResult> {
  const { holdings, mode, horizon, paths, currentRegime = "NEUTRAL", stressInjectStep = Math.floor(horizon / 2) } = input;

  if (holdings.length === 0) {
    throw new Error("No holdings provided for simulation");
  }

  const { weights, baseVols, liquidityFragilities, factorAlignments } = buildHoldingParams(holdings);
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
      const gamma = REGIME_CORRELATION_GAMMA[regime];
      const eta = REGIME_LIQUIDITY_ETA[regime];

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

        const assetReturn = drift + sigmaRegime * correlatedNoise;
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
