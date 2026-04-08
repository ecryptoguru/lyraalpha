import { OHLCV } from "./types";

export interface CorrelationData {
  [ticker: string]: number;
}

export function calculateCorrelations(
  targetHistory: OHLCV[],
  benchmarkHistory: Record<string, OHLCV[]>,
): CorrelationData {
  const correlations: CorrelationData = {};

  for (const [ticker, history] of Object.entries(benchmarkHistory)) {
    correlations[ticker] = calculatePearsonCorrelation(targetHistory, history);
  }

  return correlations;
}

function calculatePearsonCorrelation(
  history1: OHLCV[],
  history2: OHLCV[],
): number {
  // 1. Align dates (Intersection)
  const map1 = new Map(history1.map((d) => [d.date.split("T")[0], d.close]));
  const map2 = new Map(history2.map((d) => [d.date.split("T")[0], d.close]));

  const commonDates = Array.from(map1.keys())
    .filter((date) => map2.has(date))
    .sort()
    .slice(-90); // Rolling 90-day correlation

  if (commonDates.length < 20) return 0;

  // 2. Calculate daily returns
  const returns1: number[] = [];
  const returns2: number[] = [];

  for (let i = 1; i < commonDates.length; i++) {
    const p1_prev = map1.get(commonDates[i - 1])!;
    const p1_curr = map1.get(commonDates[i])!;
    const p2_prev = map2.get(commonDates[i - 1])!;
    const p2_curr = map2.get(commonDates[i])!;

    returns1.push((p1_curr - p1_prev) / p1_prev);
    returns2.push((p2_curr - p2_prev) / p2_prev);
  }

  // 3. Pearson Calculation
  const n = returns1.length;
  const sum1 = returns1.reduce((a, b) => a + b, 0);
  const sum2 = returns2.reduce((a, b) => a + b, 0);
  const sum1Sq = returns1.reduce((a, b) => a + b * b, 0);
  const sum2Sq = returns2.reduce((a, b) => a + b * b, 0);
  const pSum = returns1
    .map((v, i) => v * returns2[i])
    .reduce((a, b) => a + b, 0);

  const num = pSum - (sum1 * sum2) / n;
  const den = Math.sqrt(
    (sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n),
  );

  if (den === 0) return 0;

  return Math.round((num / den) * 100) / 100;
}
