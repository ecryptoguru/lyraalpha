import { OHLCV, EngineResult, SignalDirection } from "./types";

/**
 * Volume-Price Sentiment Engine
 *
 * Derives a market-sentiment proxy from OHLCV data using four sub-signals:
 *   1. OBV (On-Balance Volume) trend — accumulation vs distribution   (40%)
 *   2. Volume-price divergence — price rising on falling volume        (25%)
 *   3. Buying pressure (Chaikin-style close position in range)         (20%)
 *   4. Volume trend — rising vs falling average volume                 (15%)
 *
 * No external news API required — purely derived from available market data.
 */
export function calculateSentimentScore(
  data?: OHLCV[],
): EngineResult {
  // Fallback for callers that don't pass OHLCV yet (backward-compat)
  if (!data || data.length < 20) {
    return {
      score: 50,
      direction: "NEUTRAL",
      context: "Insufficient volume data for sentiment analysis.",
      metadata: { method: "fallback" },
    };
  }

  const recent = data.slice(-60); // Use up to 60 days
  const lookback = Math.min(recent.length, 40);
  const window = recent.slice(-lookback);

  // ─── 1. OBV Trend (40%) ───────────────────────────────────────────
  // On-Balance Volume: cumulative sum of signed volume
  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < window.length; i++) {
    const change = window[i].close - window[i - 1].close;
    obv += change > 0 ? window[i].volume : change < 0 ? -window[i].volume : 0;
    obvSeries.push(obv);
  }

  // Compare OBV SMA-10 vs OBV SMA-20 for trend
  const obvRecent = obvSeries.slice(-10);
  const obvOlder = obvSeries.slice(-20, -10);
  const obvRecentAvg = obvRecent.reduce((s, v) => s + v, 0) / obvRecent.length;
  const obvOlderAvg = obvOlder.length > 0
    ? obvOlder.reduce((s, v) => s + v, 0) / obvOlder.length
    : obvRecentAvg;

  // Normalize: positive delta = accumulation, negative = distribution
  const obvRange = Math.max(Math.abs(obvRecentAvg), Math.abs(obvOlderAvg), 1);
  const obvDelta = (obvRecentAvg - obvOlderAvg) / obvRange;
  const obvScore = Math.min(100, Math.max(0, 50 + obvDelta * 50));

  // ─── 2. Volume-Price Divergence (25%) ─────────────────────────────
  // Compare price direction vs volume direction over last 10 days
  const last10 = window.slice(-10);
  const priceChange = (last10[last10.length - 1].close - last10[0].close) / last10[0].close;
  const volFirst5 = last10.slice(0, 5).reduce((s, d) => s + d.volume, 0) / 5;
  const volLast5 = last10.slice(5).reduce((s, d) => s + d.volume, 0) / 5;
  const volChange = volFirst5 > 0 ? (volLast5 - volFirst5) / volFirst5 : 0;

  let divScore = 50;
  if (priceChange > 0.01 && volChange > 0.05) {
    // Price up + volume up = strong bullish confirmation
    divScore = 70 + Math.min(30, priceChange * 200);
  } else if (priceChange > 0.01 && volChange < -0.05) {
    // Price up + volume down = bearish divergence
    divScore = 35 - Math.min(15, Math.abs(volChange) * 50);
  } else if (priceChange < -0.01 && volChange > 0.05) {
    // Price down + volume up = capitulation / bearish
    divScore = 25 - Math.min(15, volChange * 30);
  } else if (priceChange < -0.01 && volChange < -0.05) {
    // Price down + volume down = selling exhaustion (mildly bullish)
    divScore = 55 + Math.min(15, Math.abs(volChange) * 30);
  }
  divScore = Math.min(100, Math.max(0, divScore));

  // ─── 3. Buying Pressure — Chaikin-style (20%) ────────────────────
  // Close Location Value: (close - low) / (high - low) averaged over recent bars
  const clvWindow = window.slice(-14);
  let clvSum = 0;
  let clvCount = 0;
  for (const bar of clvWindow) {
    const range = bar.high - bar.low;
    if (range > 0) {
      clvSum += (bar.close - bar.low) / range; // 0 = closed at low, 1 = closed at high
      clvCount++;
    }
  }
  const avgClv = clvCount > 0 ? clvSum / clvCount : 0.5;
  const pressureScore = Math.min(100, Math.max(0, avgClv * 100));

  // ─── 4. Volume Trend (15%) ────────────────────────────────────────
  // Is average volume rising or falling? Rising volume = more conviction
  const vol20 = window.slice(-20).reduce((s, d) => s + d.volume, 0) / Math.min(20, window.length);
  const vol10 = window.slice(-10).reduce((s, d) => s + d.volume, 0) / Math.min(10, window.length);
  const volTrendRatio = vol20 > 0 ? vol10 / vol20 : 1;
  // > 1 = rising volume, < 1 = falling
  const volTrendScore = Math.min(100, Math.max(0, 50 + (volTrendRatio - 1) * 100));

  // ─── Composite ────────────────────────────────────────────────────
  const score = Math.round(
    obvScore * 0.40 +
    divScore * 0.25 +
    pressureScore * 0.20 +
    volTrendScore * 0.15
  );

  const clampedScore = Math.min(99, Math.max(1, score));

  let direction: SignalDirection = "FLAT";
  let context = "";

  if (clampedScore >= 65) {
    direction = "UP";
    context = "Accumulation detected. Volume confirms price action.";
  } else if (clampedScore <= 35) {
    direction = "DOWN";
    context = "Distribution pattern. Volume diverging from price.";
  } else {
    direction = "FLAT";
    context = "Neutral volume-price dynamics.";
  }

  return {
    score: clampedScore,
    direction,
    context,
    metadata: {
      method: "volume-price",
      obvScore: Math.round(obvScore),
      divScore: Math.round(divScore),
      pressureScore: Math.round(pressureScore),
      volTrendScore: Math.round(volTrendScore),
    },
  };
}
