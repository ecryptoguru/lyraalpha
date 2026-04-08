import { OHLCV } from "./types";

/**
 * Filter out high-frequency noise by keeping only one price per hour/day.
 * This handles cases where multiple price updates occur within the same hour
 * or where data sources provide redundant/conflicting entries for the same timestamp.
 */
export function cleanHistory(history: OHLCV[]): OHLCV[] {
  if (history.length < 2) return history;

  const seen = new Set<string>();
  const cleaned: OHLCV[] = [];

  // Sort descending to get latest first if multiple per slot
  const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const h of sorted) {
    // Round to nearest hour to eliminate high-frequency spikes/duplicates
    const date = new Date(h.date);
    const slot = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}H${date.getUTCHours()}`;
    
    if (!seen.has(slot)) {
      seen.add(slot);
      cleaned.push(h);
    }
  }

  // Return sorted ascending (oldest to newest)
  return cleaned.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ─── Shared Math Utilities ──────────────────────────────────────────
// Consolidated from duplicated implementations across:
// correlation-hub.ts, correlation-regime.ts, sector-regime.ts,
// factor-alignment.ts, factor-attribution.ts, score-dynamics.ts, liquidity.ts

/**
 * Standard deviation of a numeric array.
 * Used by: correlation-regime, factor-alignment, score-dynamics, liquidity
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Pearson correlation between two equal-length numeric arrays.
 * Used by: correlation-hub, sector-regime, backtest harness
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 5 || n !== y.length) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : Math.round((num / denom) * 100) / 100;
}

/**
 * Calculate daily returns from a price series.
 * Used by: correlation-hub, sector-regime, factor-attribution, mutual-fund-analytics
 */
export function dailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * Simple Moving Average of last N values from an array.
 */
export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential Moving Average series.
 */
export function emaSeries(src: number[], period: number): number[] {
  if (src.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [src[0]];
  for (let i = 1; i < src.length; i++) {
    result.push(src[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}
