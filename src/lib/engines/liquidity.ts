import { EngineResult, OHLCV } from "./types";
import { MarketQuote } from "@/types/market-data";
import { ENGINE_THRESHOLDS } from "./constants";

/**
 * Optional enrichment data for multi-dimensional liquidity scoring.
 * When provided, the engine blends volume-depth with stability, trend,
 * relative-volume, short-interest, and market-cap signals.
 */
export interface LiquidityEnrichment {
  history?: OHLCV[];
  avgVolume3M?: number | null;
  shortRatio?: number | null;
  marketCap?: string | null;
}

// ─── Dimension weights ──────────────────────────────────────────────
const W = {
  DEPTH: 0.40,
  STABILITY: 0.15,
  TREND: 0.15,
  RELATIVE: 0.15,
  SHORT_DRAG: 0.05,
  CAP_TIER: 0.10,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function sma(values: number[], period: number): number {
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
}

// ─── Sub-scores ─────────────────────────────────────────────────────

/** D1: Dollar-volume depth (original logic, 0-100) */
function depthScore(dollarVolume: number): number {
  const T = ENGINE_THRESHOLDS.LIQUIDITY;
  if (dollarVolume > T.INSTITUTIONAL_GRADE)
    return T.INSTITUTIONAL_SCORE_MIN + Math.min(9, (dollarVolume - T.INSTITUTIONAL_GRADE) / 100_000_000);
  if (dollarVolume > T.HIGH_LIQUIDITY)
    return T.HIGH_SCORE_MIN + ((dollarVolume - T.HIGH_LIQUIDITY) / (T.INSTITUTIONAL_GRADE - T.HIGH_LIQUIDITY)) * (T.INSTITUTIONAL_SCORE_MIN - T.HIGH_SCORE_MIN);
  if (dollarVolume > T.MEDIUM_LIQUIDITY)
    return T.MEDIUM_SCORE_MIN + ((dollarVolume - T.MEDIUM_LIQUIDITY) / (T.HIGH_LIQUIDITY - T.MEDIUM_LIQUIDITY)) * (T.HIGH_SCORE_MIN - T.MEDIUM_SCORE_MIN);
  if (dollarVolume > T.LOW_LIQUIDITY)
    return T.LOW_SCORE_MAX + ((dollarVolume - T.LOW_LIQUIDITY) / (T.MEDIUM_LIQUIDITY - T.LOW_LIQUIDITY)) * (T.MEDIUM_SCORE_MIN - T.LOW_SCORE_MAX);
  return Math.max(1, (dollarVolume / T.LOW_LIQUIDITY) * T.LOW_SCORE_MAX);
}

/** D2: Volume stability — low coefficient of variation = high score */
function stabilityScore(volumes: number[]): number {
  if (volumes.length < 5) return 50;
  const recent = volumes.slice(-20);
  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  if (mean === 0) return 10;
  const cv = stdDev(recent) / mean; // coefficient of variation
  // CV < 0.3 → very stable (90+), CV > 1.5 → erratic (10)
  return Math.round(Math.max(10, Math.min(95, 100 - cv * 60)));
}

/** D3: Volume trend — 5d SMA vs 20d SMA ratio */
function trendScore(volumes: number[]): number {
  if (volumes.length < 20) return 50;
  const short = sma(volumes, 5);
  const long = sma(volumes, 20);
  if (long === 0) return 50;
  const ratio = short / long;
  // ratio > 1.5 → surging (90), ratio < 0.5 → drying up (15)
  return Math.round(Math.max(10, Math.min(95, 50 + (ratio - 1) * 80)));
}

/** D4: Relative volume — today vs 3-month average */
function relativeVolumeScore(spotVolume: number, avg3M: number): number {
  if (!avg3M || avg3M === 0) return 50;
  const ratio = spotVolume / avg3M;
  // ratio > 2 → unusual activity (90), ratio < 0.3 → very quiet (20)
  return Math.round(Math.max(10, Math.min(95, 50 + (ratio - 1) * 40)));
}

/** D5: Short-interest drag — high short ratio = liquidity drag */
function shortDragScore(shortRatio: number | null | undefined): number {
  if (!shortRatio || shortRatio <= 0) return 70; // No data = neutral-positive
  // shortRatio < 2 → healthy (85), > 10 → heavy drag (15)
  return Math.round(Math.max(10, Math.min(90, 90 - shortRatio * 8)));
}

/** D6: Market-cap tier — larger caps inherently more liquid */
function capTierScore(marketCap: string | null | undefined): number {
  const cap = parseFloat(marketCap || "0");
  if (cap >= 100_000_000_000) return 95; // Mega
  if (cap >= 10_000_000_000) return 80;  // Large
  if (cap >= 2_000_000_000) return 65;   // Mid
  if (cap >= 300_000_000) return 45;     // Small
  return 25;                              // Micro
}

// ─── Context generator ──────────────────────────────────────────────

function generateContext(
  score: number,
  dims: { depth: number; stability: number; trend: number; relative: number; shortDrag: number; capTier: number },
): string {
  if (score >= 85) return "Deep institutional liquidity. Minimal slippage expected.";
  if (score >= 70) return "Strong liquidity. Suitable for most position sizes.";
  if (score >= 55) return "Adequate liquidity for retail sizing.";
  if (score >= 40) {
    const warnings: string[] = [];
    if (dims.stability < 40) warnings.push("erratic volume");
    if (dims.trend < 35) warnings.push("declining volume trend");
    if (dims.shortDrag < 30) warnings.push("heavy short interest");
    return `Thin liquidity${warnings.length ? ` (${warnings.join(", ")})` : ""}. Use limit orders.`;
  }
  return "Low liquidity. High slippage risk. Size positions carefully.";
}

// ─── Main export ────────────────────────────────────────────────────

/**
 * Multi-dimensional liquidity scoring engine.
 * Backward-compatible: works with just a MarketQuote (depth-only),
 * but produces richer scores when enrichment data is provided.
 */
export function calculateLiquidityScore(
  quote: MarketQuote,
  enrichment?: LiquidityEnrichment,
): EngineResult {
  const volume = quote.regularMarketVolume || 0;
  const price = quote.regularMarketPrice || 0;
  const avgVol10 = quote.averageDailyVolume10Day || volume;
  const dollarVolume = avgVol10 * price;

  const depth = depthScore(dollarVolume);

  // If no enrichment, fall back to depth-only (original behavior)
  if (!enrichment || !enrichment.history || enrichment.history.length < 5) {
    const score = Math.round(Math.min(100, depth));
    return {
      score,
      direction: score > 80 ? "UP" : score < 40 ? "DOWN" : "FLAT",
      context: score >= 85 ? "Deep institutional liquidity. Minimal slippage expected."
        : score >= 70 ? "Strong liquidity. Suitable for most position sizes."
        : score >= 55 ? "Adequate liquidity for retail sizing."
        : score >= 40 ? "Thin liquidity. Use limit orders."
        : "Low liquidity. High slippage risk.",
      metadata: { dollarVolume, volume, avgVol10 },
    };
  }

  // Extract volume series from OHLCV
  const volumes = enrichment.history.map(d => d.volume).filter(v => v > 0);

  const dims = {
    depth,
    stability: stabilityScore(volumes),
    trend: trendScore(volumes),
    relative: relativeVolumeScore(volume, enrichment.avgVolume3M || 0),
    shortDrag: shortDragScore(enrichment.shortRatio),
    capTier: capTierScore(enrichment.marketCap),
  };

  const score = Math.round(Math.min(100, Math.max(1,
    dims.depth * W.DEPTH +
    dims.stability * W.STABILITY +
    dims.trend * W.TREND +
    dims.relative * W.RELATIVE +
    dims.shortDrag * W.SHORT_DRAG +
    dims.capTier * W.CAP_TIER
  )));

  return {
    score,
    direction: score > 80 ? "UP" : score < 40 ? "DOWN" : "FLAT",
    context: generateContext(score, dims),
    metadata: {
      dollarVolume,
      volume,
      avgVol10,
      dimensions: dims,
    },
  };
}
