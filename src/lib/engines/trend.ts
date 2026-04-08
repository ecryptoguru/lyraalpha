import { OHLCV, EngineResult, SignalDirection } from "./types";
import { ENGINE_THRESHOLDS } from "./constants";

/**
 * Calculates Trend Score using gradient distance-from-SMA, slope analysis,
 * and multi-timeframe alignment. Produces a continuous 0-100 score instead
 * of binary above/below thresholds.
 *
 * Sub-signals:
 *   1. Price distance from SMA200 (gradient, not binary)    — 25%
 *   2. Price distance from SMA50                            — 20%
 *   3. SMA alignment (50 vs 200, or 20 vs 50)              — 15%
 *   4. Price slope (linear regression over 20d)             — 20%
 *   5. Higher-low structure (recent swing analysis)         — 20%
 */
export function calculateTrendScore(data: OHLCV[]): EngineResult {
  if (data.length < ENGINE_THRESHOLDS.TREND.TIER_3_MIN_DAYS) {
    return {
      score: 50,
      direction: "NEUTRAL",
      context: `Insufficient data for trend analysis (Need > ${ENGINE_THRESHOLDS.TREND.TIER_3_MIN_DAYS} days)`,
    };
  }

  const prices = data.map((d) => d.close);
  const price = prices[prices.length - 1];

  // Helper: Simple Moving Average
  const sma = (period: number): number | null => {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  // Helper: Gradient distance score — how far price is from SMA, normalized
  // Returns 0-100 where 50 = at SMA, 100 = far above, 0 = far below
  const gradientDistance = (smaVal: number, maxPct: number): number => {
    const pctDist = ((price - smaVal) / smaVal) * 100; // e.g., +5% above SMA
    // Map [-maxPct, +maxPct] → [0, 100], clamped
    return Math.min(100, Math.max(0, 50 + (pctDist / maxPct) * 50));
  };

  // Helper: Linear regression slope over N bars, annualized as % per day
  const slope = (n: number): number => {
    const slice = prices.slice(-n);
    if (slice.length < 5) return 0;
    const len = slice.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < len; i++) {
      sumX += i;
      sumY += slice[i];
      sumXY += i * slice[i];
      sumX2 += i * i;
    }
    const rawSlope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    // Normalize as daily % change relative to current price
    return price > 0 ? (rawSlope / price) * 100 : 0;
  };

  // Helper: Higher-low structure — count of higher lows in recent swing points
  const higherLowScore = (): number => {
    // Find local minima (swing lows) in last 60 bars
    const lookback = Math.min(prices.length, 60);
    const recent = prices.slice(-lookback);
    const lows: number[] = [];
    for (let i = 2; i < recent.length - 2; i++) {
      if (recent[i] <= recent[i - 1] && recent[i] <= recent[i - 2] &&
          recent[i] <= recent[i + 1] && recent[i] <= recent[i + 2]) {
        lows.push(recent[i]);
      }
    }
    if (lows.length < 2) return 50; // Not enough swings
    // Count consecutive higher lows
    let higherCount = 0;
    let lowerCount = 0;
    for (let i = 1; i < lows.length; i++) {
      if (lows[i] > lows[i - 1]) higherCount++;
      else lowerCount++;
    }
    const total = higherCount + lowerCount;
    if (total === 0) return 50;
    return Math.round((higherCount / total) * 100);
  };

  const reasons: string[] = [];
  let s1 = 50, s2 = 50, s3 = 50, s4 = 50, s5 = 50;
  let w1 = 0.25, w2 = 0.20, w3 = 0.15, w4 = 0.20, w5 = 0.20;
  const metadata: Record<string, unknown> = { price };

  // TIER 1: Full data (200+ days)
  if (data.length >= ENGINE_THRESHOLDS.TREND.TIER_1_MIN_DAYS) {
    const sma200 = sma(200)!;
    const sma50 = sma(50)!;
    metadata.sma200 = sma200;
    metadata.sma50 = sma50;

    // S1: Gradient distance from SMA200 (max ±15% range)
    s1 = gradientDistance(sma200, 15);
    reasons.push(price > sma200
      ? `${((price - sma200) / sma200 * 100).toFixed(1)}% above 200d avg`
      : `${((sma200 - price) / sma200 * 100).toFixed(1)}% below 200d avg`);

    // S2: Gradient distance from SMA50 (max ±10% range)
    s2 = gradientDistance(sma50, 10);

    // S3: SMA alignment — how far SMA50 is above/below SMA200
    const crossPct = ((sma50 - sma200) / sma200) * 100;
    s3 = Math.min(100, Math.max(0, 50 + crossPct * 10));
    if (sma50 > sma200) reasons.push("Golden Cross active");
    else reasons.push("Death Cross structure");
  }
  // TIER 2: Medium data (50-199 days)
  else if (data.length >= ENGINE_THRESHOLDS.TREND.TIER_2_MIN_DAYS) {
    const sma50 = sma(50)!;
    const sma20 = sma(20)!;
    metadata.sma50 = sma50;
    metadata.sma20 = sma20;
    metadata.mode = "medium_term";

    s1 = gradientDistance(sma50, 12);
    s2 = gradientDistance(sma20, 8);
    const crossPct = ((sma20 - sma50) / sma50) * 100;
    s3 = Math.min(100, Math.max(0, 50 + crossPct * 12));
    // Reduce long-term weight, boost short-term
    w1 = 0.20; w2 = 0.25; w3 = 0.15; w4 = 0.20; w5 = 0.20;
    reasons.push("Medium-term analysis (50-199d)");
  }
  // TIER 3: Short data (20-49 days)
  else {
    const sma20 = sma(20)!;
    metadata.sma20 = sma20;
    metadata.mode = "short_term";

    s1 = gradientDistance(sma20, 8);
    const sma10 = sma(10);
    s2 = sma10 ? gradientDistance(sma10, 6) : 50;
    s3 = 50; // No cross to measure
    // Boost slope and structure weights
    w1 = 0.20; w2 = 0.15; w3 = 0.05; w4 = 0.30; w5 = 0.30;
    reasons.push("Short-term analysis (<50d)");
  }

  // S4: Price slope (20-day linear regression)
  const slopeVal = slope(20);
  metadata.slope20d = Math.round(slopeVal * 1000) / 1000;
  // Map daily slope: ±0.5% per day → [0, 100]
  s4 = Math.min(100, Math.max(0, 50 + (slopeVal / 0.5) * 50));
  if (slopeVal > 0.1) reasons.push(`Positive slope (+${slopeVal.toFixed(2)}%/d)`);
  else if (slopeVal < -0.1) reasons.push(`Negative slope (${slopeVal.toFixed(2)}%/d)`);

  // S5: Higher-low structure
  s5 = higherLowScore();
  metadata.higherLowScore = s5;
  if (s5 > 65) reasons.push("Higher-low structure intact");
  else if (s5 < 35) reasons.push("Lower-low pattern forming");

  // Composite
  const score = Math.round(s1 * w1 + s2 * w2 + s3 * w3 + s4 * w4 + s5 * w5);
  const clampedScore = Math.min(99, Math.max(1, score));

  let direction: SignalDirection = "NEUTRAL";
  if (clampedScore >= 65) direction = "UP";
  else if (clampedScore <= 35) direction = "DOWN";
  else direction = "FLAT";

  metadata.breakdown = { s1, s2, s3, s4, s5 };

  return {
    score: clampedScore,
    direction,
    context: reasons.join(". "),
    metadata,
  };
}
