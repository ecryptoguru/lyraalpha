/**
 * Portfolio Backtesting Engine
 * Reconstructs synthetic portfolio NAV from price history (constant-weight).
 * Compares against region-aware benchmarks.
 * Non-predictive, historical replay only.
 */

export interface BacktestHoldingInput {
  symbol: string;
  weight: number;
  priceHistory: { date: string; close: number }[];
}

export interface BacktestDataPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export interface BacktestPeriodStats {
  period: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  alpha: number;
}

export interface PortfolioBacktestResult {
  dataPoints: BacktestDataPoint[];
  periodStats: BacktestPeriodStats[];
  cumulativeReturn: number | null;
  benchmarkCumulativeReturn: number | null;
  alpha: number | null;
  maxDrawdown: number | null;
  benchmarkMaxDrawdown: number | null;
  rollingSharpePeriods: { date: string; sharpe: number }[];
  benchmarkLabel: string;
  dataCount: number;
}

const TRADING_DAYS = 252;
const RISK_FREE_DAILY: Record<string, number> = {
  US: 0.045 / TRADING_DAYS,
  IN: 0.065 / TRADING_DAYS,
};

const BENCHMARK_LABELS: Record<string, string> = {
  US: "S&P 500 (SPY)",
  IN: "Nifty 50",
};

function computeReturns(values: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    if (prev > 0) returns.push((values[i] - prev) / prev);
  }
  return returns;
}

function computeMaxDrawdown(values: number[]): number {
  let peak = values[0] ?? 0;
  let maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return -maxDD;
}

function rollingSharpePeriod(
  window: number[],
  rfDaily: number,
): number | null {
  if (window.length < 2) return null;
  const avg = window.reduce((s, r) => s + r, 0) / window.length;
  const variance = window.reduce((s, r) => s + (r - avg) ** 2, 0) / (window.length - 1);
  const vol = Math.sqrt(variance);
  if (vol === 0) return null;
  return ((avg - rfDaily) / vol) * Math.sqrt(TRADING_DAYS);
}

function alignDates(holdings: BacktestHoldingInput[]): string[] {
  if (holdings.length === 0) return [];
  const dateSets = holdings.map((h) => new Set(h.priceHistory.map((p) => p.date)));
  // Start from the smallest set to minimise iterations
  dateSets.sort((a, b) => a.size - b.size);
  const [smallest, ...rest] = dateSets;
  const common: string[] = [];
  for (const d of smallest) {
    if (rest.every((s) => s.has(d))) common.push(d);
  }
  return common.sort();
}

export function computePortfolioBacktest(
  holdings: BacktestHoldingInput[],
  benchmarkHistory: { date: string; close: number }[],
  region: string = "US",
): PortfolioBacktestResult {
  const empty: PortfolioBacktestResult = {
    dataPoints: [],
    periodStats: [],
    cumulativeReturn: null,
    benchmarkCumulativeReturn: null,
    alpha: null,
    maxDrawdown: null,
    benchmarkMaxDrawdown: null,
    rollingSharpePeriods: [],
    benchmarkLabel: BENCHMARK_LABELS[region] ?? "Benchmark",
    dataCount: 0,
  };

  if (holdings.length === 0 || benchmarkHistory.length < 20) return empty;

  const commonDates = alignDates(holdings);
  if (commonDates.length < 20) return empty;

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const normalizedHoldings = holdings.map((h) => ({
    ...h,
    weight: totalWeight > 0 ? h.weight / totalWeight : 1 / holdings.length,
    priceMap: new Map(h.priceHistory.map((p) => [p.date, p.close])),
  }));

  const benchmarkMap = new Map(benchmarkHistory.map((p) => [p.date, p.close]));

  const portfolioNAV: number[] = [];
  const benchmarkNAV: number[] = [];
  const validDates: string[] = [];

  for (const date of commonDates) {
    const benchmarkPrice = benchmarkMap.get(date);
    if (benchmarkPrice === undefined) continue;

    const dayValue = normalizedHoldings.reduce((s, h) => {
      const price = h.priceMap.get(date) ?? 0;
      return s + price * h.weight;
    }, 0);

    portfolioNAV.push(dayValue);
    benchmarkNAV.push(benchmarkPrice);
    validDates.push(date);
  }

  if (portfolioNAV.length < 20) return empty;

  const base = portfolioNAV[0];
  const benchBase = benchmarkNAV[0];

  const portfolioIndexed = portfolioNAV.map((v) => (base > 0 ? (v / base) * 100 : 100));
  const benchmarkIndexed = benchmarkNAV.map((v) => (benchBase > 0 ? (v / benchBase) * 100 : 100));

  const portfolioReturns = computeReturns(portfolioNAV);
  const benchmarkReturns = computeReturns(benchmarkNAV);

  const dataPoints: BacktestDataPoint[] = validDates.map((date, i) => ({
    date,
    portfolioValue: Math.round(portfolioIndexed[i] * 100) / 100,
    benchmarkValue: Math.round(benchmarkIndexed[i] * 100) / 100,
    portfolioReturn: i > 0 ? Math.round((portfolioReturns[i - 1] ?? 0) * 10000) / 10000 : 0,
    benchmarkReturn: i > 0 ? Math.round((benchmarkReturns[i - 1] ?? 0) * 10000) / 10000 : 0,
  }));

  const last = portfolioIndexed.length - 1;
  const cumulativeReturn = last >= 0 ? (portfolioIndexed[last] - 100) / 100 : null;
  const benchmarkCumulativeReturn = last >= 0 ? (benchmarkIndexed[last] - 100) / 100 : null;
  const alpha = cumulativeReturn !== null && benchmarkCumulativeReturn !== null
    ? cumulativeReturn - benchmarkCumulativeReturn
    : null;

  const maxDrawdown = computeMaxDrawdown(portfolioNAV);
  const benchmarkMaxDrawdown = computeMaxDrawdown(benchmarkNAV);

  const rfDaily = RISK_FREE_DAILY[region] ?? RISK_FREE_DAILY.US;
  const rollingSharpePeriods: { date: string; sharpe: number }[] = [];
  const ROLLING_WINDOW = 60;
  for (let i = ROLLING_WINDOW; i < portfolioReturns.length; i++) {
    const window = portfolioReturns.slice(i - ROLLING_WINDOW, i);
    const sharpe = rollingSharpePeriod(window, rfDaily);
    if (sharpe !== null) {
      rollingSharpePeriods.push({
        date: validDates[i + 1] ?? validDates[validDates.length - 1],
        sharpe: Math.round(sharpe * 100) / 100,
      });
    }
  }

  const periodStats: BacktestPeriodStats[] = [];
  const periods = [
    { label: "1M", days: 21 },
    { label: "3M", days: 63 },
    { label: "6M", days: 126 },
    { label: "1Y", days: 252 },
  ];
  for (const { label, days } of periods) {
    if (portfolioIndexed.length > days) {
      const pRet = (portfolioIndexed[last] - portfolioIndexed[last - days]) / portfolioIndexed[last - days];
      const bRet = (benchmarkIndexed[last] - benchmarkIndexed[last - days]) / benchmarkIndexed[last - days];
      periodStats.push({
        period: label,
        portfolioReturn: Math.round(pRet * 10000) / 10000,
        benchmarkReturn: Math.round(bRet * 10000) / 10000,
        alpha: Math.round((pRet - bRet) * 10000) / 10000,
      });
    }
  }

  return {
    dataPoints,
    periodStats,
    cumulativeReturn: cumulativeReturn !== null ? Math.round(cumulativeReturn * 10000) / 10000 : null,
    benchmarkCumulativeReturn: benchmarkCumulativeReturn !== null ? Math.round(benchmarkCumulativeReturn * 10000) / 10000 : null,
    alpha: alpha !== null ? Math.round(alpha * 10000) / 10000 : null,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    benchmarkMaxDrawdown: Math.round(benchmarkMaxDrawdown * 10000) / 10000,
    rollingSharpePeriods,
    benchmarkLabel: BENCHMARK_LABELS[region] ?? "Benchmark",
    dataCount: validDates.length,
  };
}
