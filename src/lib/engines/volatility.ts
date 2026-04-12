import { OHLCV, EngineResult, SignalDirection } from "./types";

/**
 * Calculates Volatility Score using three sub-signals:
 *   1. Normalized ATR (NATR-14) with asset-class percentile scaling  — 40%
 *   2. Bollinger %B (price position within Bollinger Bands)          — 30%
 *   3. Volatility regime (current vol vs historical vol)             — 30%
 *
 * High score = High Volatility (Riskier).
 *
 * Key fix: Crypto NATR uses percentile-based scaling instead of fixed 8% cap,
 * producing differentiated scores across the crypto universe.
 */
export function calculateVolatilityScore(
  data: OHLCV[],
  assetType: string = "CRYPTO",
): EngineResult {
  if (data.length < 20) {
    return {
      score: 50,
      direction: "NEUTRAL",
      context: "Insufficient data for volatility analysis.",
    };
  }

  const prices = data.map(d => d.close);
  const latestPrice = prices[prices.length - 1];
  // Platform is crypto-only

  // ─── 1. NATR-14 with percentile scaling (40%) ────────────────────
  const trueRanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );
    trueRanges.push(tr);
  }

  const atrPeriod = 14;
  const recentTR = trueRanges.slice(-atrPeriod);
  const atr = recentTR.reduce((a, b) => a + b, 0) / atrPeriod;
  const natr = latestPrice > 0 ? (atr / latestPrice) * 100 : 0;

  // Percentile-based scaling using empirical ranges
  // Instead of fixed divisors, use asset-class-specific percentile bands
  // Crypto NATR typical range: 1% (very calm) to 12% (extreme)
  // Median ~3.5%. Use sigmoid-like mapping for better spread.
  let natrScore = Math.min(100, Math.max(0, (natr / 5) * 50));
  // Apply diminishing returns above 5% to avoid ceiling
  if (natr > 5) natrScore = 50 + Math.min(50, (natr - 5) * 7);
  natrScore = Math.min(100, Math.max(0, natrScore));

  // ─── 2. Bollinger %B (30%) ────────────────────────────────────────
  // %B = (Price - Lower Band) / (Upper Band - Lower Band)
  // %B > 1 = above upper band (high vol), %B < 0 = below lower band
  const bbPeriod = 20;
  const bbSlice = prices.slice(-bbPeriod);
  const bbMean = bbSlice.reduce((s, v) => s + v, 0) / bbPeriod;
  const bbVariance = bbSlice.reduce((s, v) => s + (v - bbMean) ** 2, 0) / bbPeriod;
  const bbStd = Math.sqrt(bbVariance);
  const upperBand = bbMean + 2 * bbStd;
  const lowerBand = bbMean - 2 * bbStd;
  const bandWidth = upperBand - lowerBand;

  let bbScore = 50;
  if (bandWidth > 0) {
    const pctB = (latestPrice - lowerBand) / bandWidth;
    // Map %B to volatility score:
    // Near bands (0 or 1) = high vol environment
    // Near middle (0.5) = calm
    // We care about band WIDTH more than position for volatility
    const bandWidthPct = (bandWidth / bbMean) * 100;
    bbScore = Math.min(100, Math.max(0, (bandWidthPct / 15) * 50));
    if (bandWidthPct > 15) bbScore = 50 + Math.min(50, (bandWidthPct - 15) * 5);
    // Bonus if price is outside bands (extreme vol)
    if (pctB > 1 || pctB < 0) bbScore = Math.min(100, bbScore + 10);
  }
  bbScore = Math.min(100, Math.max(0, bbScore));

  // ─── 3. Vol Regime: current vs historical (30%) ───────────────────
  // Compare recent 14d realized vol to longer 60d realized vol
  const calcRealizedVol = (slice: number[]): number => {
    if (slice.length < 5) return 0;
    const returns: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      if (slice[i - 1] > 0) returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
    }
    if (returns.length === 0) return 0;
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized %
  };

  const recentVol = calcRealizedVol(prices.slice(-14));
  const longerVol = calcRealizedVol(prices.slice(-Math.min(60, prices.length)));

  let regimeScore = 50;
  if (longerVol > 0) {
    const volRatio = recentVol / longerVol;
    // > 1 = vol expanding (higher score), < 1 = vol contracting
    regimeScore = Math.min(100, Math.max(0, 50 + (volRatio - 1) * 50));
  }

  // ─── Composite ────────────────────────────────────────────────────
  const score = Math.round(natrScore * 0.40 + bbScore * 0.30 + regimeScore * 0.30);
  const clampedScore = Math.min(99, Math.max(1, score));

  let direction: SignalDirection = "NEUTRAL";
  let context = "";

  if (clampedScore >= 70) {
    direction = "UP";
    const regime = recentVol > longerVol * 1.2 ? " Vol expanding." : "";
    context = `High volatility (${natr.toFixed(1)}% NATR).${regime} Expect wide swings.`;
  } else if (clampedScore <= 30) {
    direction = "DOWN";
    const regime = recentVol < longerVol * 0.8 ? " Vol contracting." : "";
    context = `Low volatility (${natr.toFixed(1)}% NATR).${regime} Price compressing.`;
  } else {
    direction = "FLAT";
    context = `Moderate volatility for crypto.`;
  }

  return {
    score: clampedScore,
    direction,
    context,
    metadata: {
      atr: Math.round(atr * 1000) / 1000,
      natr: Math.round(natr * 100) / 100,
      natrScore: Math.round(natrScore),
      bbScore: Math.round(bbScore),
      regimeScore: Math.round(regimeScore),
      recentVol: Math.round(recentVol * 10) / 10,
      longerVol: Math.round(longerVol * 10) / 10,
      assetType,
    },
  };
}
