/**
 * Portfolio Risk Engine
 * Computes institutional-grade risk metrics from synthetic portfolio NAV.
 * Region-aware risk-free rate: US 4.5% / IN 6.5% (annualized).
 */

export interface RiskHoldingInput {
  symbol: string;
  weight: number;
  priceHistory: number[];
}

export interface PortfolioRiskResult {
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  beta: number | null;
  maxDrawdown: number | null;
  var95: number | null;
  var99: number | null;
  cvar95: number | null;
  calmarRatio: number | null;
  annualizedReturn: number | null;
  annualizedVolatility: number | null;
  dataPoints: number;
}

const TRADING_DAYS = 252;
const RISK_FREE_RATE: Record<string, number> = {
  US: 0.045,
  IN: 0.065,
};

function dailyRiskFreeRate(region: string): number {
  const annual = RISK_FREE_RATE[region] ?? RISK_FREE_RATE.US;
  return annual / TRADING_DAYS;
}

function computeReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], avg?: number): number {
  if (arr.length < 2) return 0;
  const m = avg ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function buildSyntheticNAV(holdings: RiskHoldingInput[]): number[] {
  if (holdings.length === 0) return [];

  const minLen = Math.min(...holdings.map((h) => h.priceHistory.length));
  if (minLen < 2) return [];

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const normalizedHoldings = holdings.map((h) => ({
    ...h,
    weight: totalWeight > 0 ? h.weight / totalWeight : 1 / holdings.length,
  }));

  const nav: number[] = [];
  for (let i = 0; i < minLen; i++) {
    const dayValue = normalizedHoldings.reduce((s, h) => {
      const price = h.priceHistory[h.priceHistory.length - minLen + i];
      return s + (price ?? 0) * h.weight;
    }, 0);
    nav.push(dayValue);
  }
  return nav;
}

function computeMaxDrawdown(nav: number[]): number | null {
  if (nav.length < 2) return null;
  let peak = nav[0];
  let maxDD = 0;
  for (const price of nav) {
    if (price > peak) peak = price;
    const dd = peak > 0 ? (peak - price) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return -maxDD;
}

function computeVaR(returns: number[], confidence: number): number | null {
  if (returns.length < 20) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return sorted[idx] ?? null;
}

function computeCVaR(returns: number[], var95: number): number | null {
  if (returns.length < 20) return null;
  const tailReturns = returns.filter((r) => r <= var95);
  if (tailReturns.length === 0) return null;
  return mean(tailReturns);
}

function computeBeta(portfolioReturns: number[], benchmarkReturns: number[]): number | null {
  const len = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (len < 20) return null;

  const pRet = portfolioReturns.slice(-len);
  const bRet = benchmarkReturns.slice(-len);

  const pMean = mean(pRet);
  const bMean = mean(bRet);

  let covariance = 0;
  let benchmarkVariance = 0;
  for (let i = 0; i < len; i++) {
    covariance += (pRet[i] - pMean) * (bRet[i] - bMean);
    benchmarkVariance += (bRet[i] - bMean) ** 2;
  }

  if (benchmarkVariance === 0) return null;
  return covariance / benchmarkVariance;
}

export function computePortfolioRisk(
  holdings: RiskHoldingInput[],
  region: string = "US",
  benchmarkReturns?: number[],
): PortfolioRiskResult {
  const empty: PortfolioRiskResult = {
    sharpeRatio: null,
    sortinoRatio: null,
    beta: null,
    maxDrawdown: null,
    var95: null,
    var99: null,
    cvar95: null,
    calmarRatio: null,
    annualizedReturn: null,
    annualizedVolatility: null,
    dataPoints: 0,
  };

  const nav = buildSyntheticNAV(holdings);
  if (nav.length < 20) return empty;

  const returns = computeReturns(nav);
  if (returns.length < 10) return empty;

  const rfDaily = dailyRiskFreeRate(region);
  const avgReturn = mean(returns);
  const vol = stddev(returns, avgReturn);

  const annualizedReturn = avgReturn * TRADING_DAYS;
  const annualizedVolatility = vol * Math.sqrt(TRADING_DAYS);

  const excessReturn = avgReturn - rfDaily;
  const sharpeRatio = vol > 0 ? (excessReturn / vol) * Math.sqrt(TRADING_DAYS) : null;

  const downsideReturns = returns.filter((r) => r < rfDaily);
  const downsideVol = stddev(downsideReturns);
  const sortinoRatio = downsideVol > 0
    ? (excessReturn * TRADING_DAYS) / (downsideVol * Math.sqrt(TRADING_DAYS))
    : null;

  const maxDrawdown = computeMaxDrawdown(nav);
  const var95 = computeVaR(returns, 0.95);
  const var99 = computeVaR(returns, 0.99);
  const cvar95 = var95 !== null ? computeCVaR(returns, var95) : null;

  const calmarRatio =
    maxDrawdown !== null && maxDrawdown < 0 && annualizedReturn !== null
      ? annualizedReturn / Math.abs(maxDrawdown)
      : null;

  const beta = benchmarkReturns ? computeBeta(returns, benchmarkReturns) : null;

  return {
    sharpeRatio: sharpeRatio !== null ? Math.round(sharpeRatio * 100) / 100 : null,
    sortinoRatio: sortinoRatio !== null ? Math.round(sortinoRatio * 100) / 100 : null,
    beta: beta !== null ? Math.round(beta * 100) / 100 : null,
    maxDrawdown: maxDrawdown !== null ? Math.round(maxDrawdown * 10000) / 10000 : null,
    var95: var95 !== null ? Math.round(var95 * 10000) / 10000 : null,
    var99: var99 !== null ? Math.round(var99 * 10000) / 10000 : null,
    cvar95: cvar95 !== null ? Math.round(cvar95 * 10000) / 10000 : null,
    calmarRatio: calmarRatio !== null ? Math.round(calmarRatio * 100) / 100 : null,
    annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
    annualizedVolatility: Math.round(annualizedVolatility * 10000) / 10000,
    dataPoints: returns.length,
  };
}
