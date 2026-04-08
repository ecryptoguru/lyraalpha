import { OHLCV, EngineResult, SignalDirection } from "./types";

/**
 * Calculates Momentum Score using a composite of three indicators:
 *   1. RSI-14 (mean-reversion adjusted)  — 35%
 *   2. MACD histogram direction           — 35%
 *   3. Rate of Change (20d)               — 30%
 *
 * Key fix: RSI extremes are treated as mean-reversion signals.
 * RSI > 80 is penalized (overbought risk), RSI < 20 gets a floor (oversold bounce).
 * The composite blends trend-following (MACD, ROC) with oscillator (RSI).
 */
export function calculateMomentumScore(data: OHLCV[]): EngineResult {
  if (data.length < 26) {
    return {
      score: 50,
      direction: "NEUTRAL",
      context: "Insufficient data for momentum analysis (need 26+ bars).",
    };
  }

  const prices = data.map(d => d.close);

  // ─── 1. RSI-14 (mean-reversion adjusted) — 35% ───────────────────
  const rsiPeriod = 14;
  let gains = 0, losses = 0;
  for (let i = 1; i <= rsiPeriod; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  let avgGain = gains / rsiPeriod;
  let avgLoss = losses / rsiPeriod;
  for (let i = rsiPeriod + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    avgGain = (avgGain * 13 + (change > 0 ? change : 0)) / 14;
    avgLoss = (avgLoss * 13 + (change < 0 ? Math.abs(change) : 0)) / 14;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  // Mean-reversion adjustment: penalize extremes
  // RSI 30-70 maps linearly to 25-75 (healthy momentum zone)
  // RSI > 80 caps at 65 (overbought risk)
  // RSI < 20 floors at 35 (oversold bounce potential)
  let rsiScore: number;
  if (rsi >= 30 && rsi <= 70) {
    // Linear map [30, 70] → [25, 75]
    rsiScore = 25 + ((rsi - 30) / 40) * 50;
  } else if (rsi > 70) {
    // Diminishing returns above 70, cap at 65 for extreme overbought
    rsiScore = 75 - Math.min(10, (rsi - 70) / 3);
  } else {
    // Below 30: floor at 35 (oversold = potential bounce, not pure bearish)
    rsiScore = Math.max(15, 25 - ((30 - rsi) / 3));
  }

  // ─── 2. MACD Histogram — 35% ─────────────────────────────────────
  // EMA helper
  const ema = (src: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result: number[] = [src[0]];
    for (let i = 1; i < src.length; i++) {
      result.push(src[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };

  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);

  // Use last 5 bars of histogram to detect direction and acceleration
  const recentHist = histogram.slice(-5);
  const latestHist = recentHist[recentHist.length - 1];
  const prevHist = recentHist[0];
  const histAccel = latestHist - prevHist; // Positive = accelerating

  // Normalize histogram relative to price (as %)
  const histPct = (latestHist / prices[prices.length - 1]) * 100;

  // Score: positive histogram + accelerating = bullish
  let macdScore = 50;
  if (histPct > 0) {
    macdScore = 50 + Math.min(40, histPct * 20);
    if (histAccel > 0) macdScore = Math.min(95, macdScore + 5);
  } else {
    macdScore = 50 - Math.min(40, Math.abs(histPct) * 20);
    if (histAccel < 0) macdScore = Math.max(5, macdScore - 5);
  }
  macdScore = Math.min(100, Math.max(0, macdScore));

  // ─── 3. Rate of Change (20d) — 30% ───────────────────────────────
  const rocPeriod = Math.min(20, prices.length - 1);
  const rocPrice = prices[prices.length - 1 - rocPeriod];
  const roc = rocPrice > 0 ? ((prices[prices.length - 1] - rocPrice) / rocPrice) * 100 : 0;

  // Map ROC: ±15% → [0, 100]
  const rocScore = Math.min(100, Math.max(0, 50 + (roc / 15) * 50));

  // ─── Composite ────────────────────────────────────────────────────
  const score = Math.round(rsiScore * 0.35 + macdScore * 0.35 + rocScore * 0.30);
  const clampedScore = Math.min(99, Math.max(1, score));

  let direction: SignalDirection = "FLAT";
  let context = "";

  if (clampedScore >= 65) {
    direction = "UP";
    context = rsi > 70
      ? "Strong momentum but overbought risk. MACD confirms trend."
      : "Positive momentum across RSI, MACD, and ROC.";
  } else if (clampedScore <= 35) {
    direction = "DOWN";
    context = rsi < 30
      ? "Weak momentum but oversold. Potential bounce setup."
      : "Negative momentum. MACD and ROC confirm downtrend.";
  } else {
    direction = "FLAT";
    context = "Mixed momentum signals. No strong directional bias.";
  }

  return {
    score: clampedScore,
    direction,
    context,
    metadata: {
      rsi: Math.round(rsi * 10) / 10,
      rsiScore: Math.round(rsiScore),
      macdScore: Math.round(macdScore),
      rocScore: Math.round(rocScore),
      roc: Math.round(roc * 100) / 100,
      macdHistogram: Math.round(latestHist * 1000) / 1000,
    },
  };
}
