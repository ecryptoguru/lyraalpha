import { PrismaClient } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { getCommodityProfile, COMMODITY_SYMBOLS } from "@/lib/data/commodity-profiles";
import type { MarketRegime } from "./market-regime";

const logger = createLogger({ service: "commodity-intelligence" });

// ─── Types ──────────────────────────────────────────────────────────

export interface RegimeConditionedReturn {
  regime: MarketRegime;
  avgReturn: number;
  count: number;
}

export interface RegimeProfile {
  sensitivity: Record<MarketRegime, number>; // correlation with regime score
  conditionedReturns: RegimeConditionedReturn[];
  safeHavenScore: number; // 0-100, higher = better safe haven
  inflationSensitivity: number; // -1 to 1 correlation
  usdSensitivity: number; // -1 to 1 correlation
  dominantRegime: MarketRegime;
}

export interface SeasonalPattern {
  monthlyReturns: Record<string, number>; // { jan: -1.2, feb: 0.8, ... }
  currentMonthSignal: "strong" | "weak" | "neutral";
  currentMonthAvgReturn: number;
  strongestMonth: string;
  weakestMonth: string;
  volumePattern: Record<string, number>; // relative volume by month (1.0 = average)
}

export interface CorrelationEntry {
  symbol: string;
  name: string;
  correlation: number;
  cluster: string;
}

export interface CorrelationProfile {
  topCorrelated: CorrelationEntry[];
  topAntiCorrelated: CorrelationEntry[];
  clusterGroup: string;
  diversificationValue: "high" | "moderate" | "low";
  avgCrossCorrelation: number;
}

export interface CommodityIntelligenceResult {
  regimeProfile: RegimeProfile;
  seasonality: SeasonalPattern;
  correlations: CorrelationProfile;
  structuralContext: {
    cluster: string;
    supplyContext: string;
    demandDrivers: string;
    geopoliticalSensitivity: string;
    storageCost: string;
    inflationHedge: boolean;
    safeHavenCandidate: boolean;
    seasonalNotes: string;
  } | null;
  computedAt: string;
}

// ─── Month Helpers ──────────────────────────────────────────────────

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LABELS: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April",
  may: "May", jun: "June", jul: "July", aug: "August",
  sep: "September", oct: "October", nov: "November", dec: "December",
};

// ─── Core Engine ────────────────────────────────────────────────────

export class CommodityIntelligenceEngine {
  /**
   * Compute full commodity intelligence for a single commodity asset.
   * Requires: price history (365d+), market regime history, and cross-asset price data.
   */
  static async compute(
    prisma: PrismaClient,
    assetId: string,
    symbol: string,
  ): Promise<CommodityIntelligenceResult | null> {
    try {
      // Fetch price history (last 365 days)
      const priceHistory = await prisma.priceHistory.findMany({
        where: { assetId },
        orderBy: { date: "asc" },
        select: { date: true, close: true, volume: true },
      });

      if (priceHistory.length < 60) {
        logger.debug({ symbol, count: priceHistory.length }, "Insufficient price history for commodity intelligence");
        return null;
      }

      // Fetch market regime history (US regime as the reference)
      const rawRegimes = await prisma.marketRegime.findMany({
        where: { region: "US" },
        orderBy: { date: "asc" },
        select: { date: true, state: true, context: true },
      });
      // Normalize to { date, regime, score } shape
      const regimeHistory = rawRegimes.map(r => {
        let score = 50;
        if (r.context) {
          try {
            const ctx = JSON.parse(r.context);
            score = ctx?.regime?.score ?? 50;
          } catch { /* use default */ }
        }
        return { date: r.date, regime: r.state, score };
      });

      // Fetch all commodity price histories for correlation computation
      const allCommodityAssets = await prisma.asset.findMany({
        where: { type: "COMMODITY" },
        select: {
          id: true,
          symbol: true,
          name: true,
          priceHistory: {
            orderBy: { date: "asc" },
            select: { date: true, close: true },
          },
        },
      });

      // Also fetch gold (GC=F) for inflation proxy and SPY for risk-on/off
      const proxyAssets = await prisma.asset.findMany({
        where: { symbol: { in: ["SPY", "GC=F", "TLT"] } },
        select: {
          symbol: true,
          priceHistory: {
            orderBy: { date: "asc" },
            select: { date: true, close: true },
          },
        },
      });

      // 1. Compute daily returns
      const returns = this.computeReturns(priceHistory);

      // 2. Regime sensitivity profile
      const regimeProfile = this.computeRegimeProfile(returns, regimeHistory, proxyAssets);

      // 3. Seasonal patterns
      const seasonality = this.computeSeasonality(priceHistory);

      // 4. Correlation profile
      const correlations = this.computeCorrelations(
        symbol,
        priceHistory,
        allCommodityAssets.filter(a => a.symbol !== symbol),
        proxyAssets,
      );

      // 5. Structural context from static profiles
      const profile = getCommodityProfile(symbol);
      const structuralContext = profile ? {
        cluster: profile.cluster,
        supplyContext: profile.supplyContext,
        demandDrivers: profile.demandDrivers,
        geopoliticalSensitivity: profile.geopoliticalSensitivity,
        storageCost: profile.storageCost,
        inflationHedge: profile.inflationHedge,
        safeHavenCandidate: profile.safeHavenCandidate,
        seasonalNotes: profile.seasonalNotes,
      } : null;

      return {
        regimeProfile,
        seasonality,
        correlations,
        structuralContext,
        computedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn({ symbol, err: String(err) }, "Commodity intelligence computation failed");
      return null;
    }
  }

  // ─── Daily Returns ────────────────────────────────────────────────

  static computeReturns(
    prices: { date: Date; close: number; volume: number }[],
  ): { date: Date; ret: number; volume: number }[] {
    const returns: { date: Date; ret: number; volume: number }[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1].close > 0) {
        returns.push({
          date: prices[i].date,
          ret: (prices[i].close - prices[i - 1].close) / prices[i - 1].close,
          volume: prices[i].volume,
        });
      }
    }
    return returns;
  }

  // ─── Regime Sensitivity ───────────────────────────────────────────

  static computeRegimeProfile(
    returns: { date: Date; ret: number }[],
    regimeHistory: { date: Date; regime: string; score: number | null }[],
    proxyAssets: { symbol: string; priceHistory: { date: Date; close: number }[] }[],
  ): RegimeProfile {
    // Build date → regime map
    const regimeMap = new Map<string, { regime: MarketRegime; score: number }>();
    for (const r of regimeHistory) {
      const key = r.date.toISOString().split("T")[0];
      regimeMap.set(key, { regime: r.regime as MarketRegime, score: r.score ?? 50 });
    }

    // Compute regime-conditioned returns
    const regimeBuckets: Record<string, number[]> = {};
    const regimeScores: { score: number; ret: number }[] = [];
    const ALL_REGIMES: MarketRegime[] = ["STRONG_RISK_ON", "RISK_ON", "NEUTRAL", "DEFENSIVE", "RISK_OFF", "TRANSITIONING"];

    for (const regime of ALL_REGIMES) {
      regimeBuckets[regime] = [];
    }

    for (const r of returns) {
      const key = r.date.toISOString().split("T")[0];
      const regime = regimeMap.get(key);
      if (regime) {
        regimeBuckets[regime.regime]?.push(r.ret);
        regimeScores.push({ score: regime.score, ret: r.ret });
      }
    }

    // Conditioned returns
    const conditionedReturns: RegimeConditionedReturn[] = ALL_REGIMES
      .filter(regime => regimeBuckets[regime].length > 0)
      .map(regime => ({
        regime,
        avgReturn: mean(regimeBuckets[regime]) * 100, // as percentage
        count: regimeBuckets[regime].length,
      }));

    // Sensitivity: correlation of commodity returns with regime score
    const sensitivity: Record<MarketRegime, number> = {} as Record<MarketRegime, number>;
    for (const regime of ALL_REGIMES) {
      const bucket = regimeBuckets[regime];
      sensitivity[regime] = bucket.length > 5 ? mean(bucket) * 100 : 0;
    }

    // Safe haven score: how well does this commodity perform during RISK_OFF/DEFENSIVE?
    const riskOffReturns = [...(regimeBuckets["RISK_OFF"] || []), ...(regimeBuckets["DEFENSIVE"] || [])];
    const riskOffAvg = riskOffReturns.length > 0 ? mean(riskOffReturns) : 0;
    // Safe haven: positive in risk-off, relative outperformance
    const safeHavenRaw = riskOffAvg > 0 ? 70 + (riskOffAvg * 1000) : 30 + (riskOffAvg * 1000);
    const safeHavenScore = Math.max(0, Math.min(100, Math.round(safeHavenRaw)));

    // Inflation sensitivity: correlation with gold (GC=F) as inflation proxy
    const goldAsset = proxyAssets.find(a => a.symbol === "GC=F");
    const inflationSensitivity = goldAsset
      ? this.computePairCorrelation(returns.map(r => ({ date: r.date, close: r.ret })), this.computeReturnsFromPrices(goldAsset.priceHistory))
      : 0;

    // USD sensitivity: inverse of gold correlation (simplified proxy)
    const usdSensitivity = -inflationSensitivity * 0.7; // gold is ~70% inverse of USD

    // Dominant regime: where does this commodity perform best?
    const dominantRegime = conditionedReturns.length > 0
      ? conditionedReturns.reduce((best, cr) => cr.avgReturn > best.avgReturn ? cr : best).regime
      : "NEUTRAL" as MarketRegime;

    return {
      sensitivity,
      conditionedReturns,
      safeHavenScore,
      inflationSensitivity: round(inflationSensitivity, 3),
      usdSensitivity: round(usdSensitivity, 3),
      dominantRegime,
    };
  }

  // ─── Seasonal Patterns ────────────────────────────────────────────

  static computeSeasonality(
    prices: { date: Date; close: number; volume: number }[],
  ): SeasonalPattern {
    // Group returns by month
    const monthlyReturns: Record<string, number[]> = {};
    const monthlyVolumes: Record<string, number[]> = {};
    for (const m of MONTH_NAMES) {
      monthlyReturns[m] = [];
      monthlyVolumes[m] = [];
    }

    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1].close <= 0) continue;
      const ret = (prices[i].close - prices[i - 1].close) / prices[i - 1].close;
      const monthIdx = prices[i].date.getMonth();
      const monthKey = MONTH_NAMES[monthIdx];
      monthlyReturns[monthKey].push(ret);
      if (prices[i].volume > 0) {
        monthlyVolumes[monthKey].push(prices[i].volume);
      }
    }

    // Average return per month (annualized-ish: daily avg * ~21 trading days)
    const avgReturns: Record<string, number> = {};
    for (const m of MONTH_NAMES) {
      avgReturns[m] = monthlyReturns[m].length > 0
        ? round(mean(monthlyReturns[m]) * 21 * 100, 2) // monthly return as %
        : 0;
    }

    // Volume pattern (relative to overall average)
    const allVolumes = Object.values(monthlyVolumes).flat();
    const avgVolume = allVolumes.length > 0 ? mean(allVolumes) : 1;
    const volumePattern: Record<string, number> = {};
    for (const m of MONTH_NAMES) {
      const mVol = monthlyVolumes[m].length > 0 ? mean(monthlyVolumes[m]) : avgVolume;
      volumePattern[m] = round(mVol / avgVolume, 2);
    }

    // Current month signal
    const currentMonth = MONTH_NAMES[new Date().getMonth()];
    const currentReturn = avgReturns[currentMonth];
    const allReturns = Object.values(avgReturns);
    const returnStd = std(allReturns);
    const returnMean = mean(allReturns);

    let currentMonthSignal: "strong" | "weak" | "neutral" = "neutral";
    if (returnStd > 0) {
      const zScore = (currentReturn - returnMean) / returnStd;
      if (zScore > 0.5) currentMonthSignal = "strong";
      else if (zScore < -0.5) currentMonthSignal = "weak";
    }

    // Strongest and weakest months
    const sortedMonths = MONTH_NAMES.slice().sort((a, b) => avgReturns[b] - avgReturns[a]);
    const strongestMonth = MONTH_LABELS[sortedMonths[0]];
    const weakestMonth = MONTH_LABELS[sortedMonths[sortedMonths.length - 1]];

    return {
      monthlyReturns: avgReturns,
      currentMonthSignal,
      currentMonthAvgReturn: currentReturn,
      strongestMonth,
      weakestMonth,
      volumePattern,
    };
  }

  // ─── Correlation Profile ──────────────────────────────────────────

  static computeCorrelations(
    symbol: string,
    priceHistory: { date: Date; close: number }[],
    otherCommodities: { id: string; symbol: string; name: string; priceHistory: { date: Date; close: number }[] }[],
    proxyAssets: { symbol: string; priceHistory: { date: Date; close: number }[] }[],
  ): CorrelationProfile {
    const myReturns = this.computeReturnsFromPrices(priceHistory);
    const entries: CorrelationEntry[] = [];

    // Correlate with other commodities
    for (const other of otherCommodities) {
      if (other.priceHistory.length < 30) continue;
      const otherReturns = this.computeReturnsFromPrices(other.priceHistory);
      const corr = this.computePairCorrelation(myReturns, otherReturns);
      const profile = getCommodityProfile(other.symbol);
      entries.push({
        symbol: other.symbol,
        name: other.name || other.symbol,
        correlation: round(corr, 3),
        cluster: profile?.cluster || "unknown",
      });
    }

    // Correlate with SPY and TLT
    for (const proxy of proxyAssets) {
      if (proxy.priceHistory.length < 30) {
        continue;
      }
      const proxyReturns = this.computeReturnsFromPrices(proxy.priceHistory);
      const corr = this.computePairCorrelation(myReturns, proxyReturns);
      const proxyCommodityProfile = getCommodityProfile(proxy.symbol);
      const name = proxy.symbol === "SPY"
        ? "S&P 500 (SPY)"
        : proxy.symbol === "TLT"
          ? "US Treasury 20Y+ (TLT)"
          : proxyCommodityProfile?.name || proxy.symbol;
      entries.push({
        symbol: proxy.symbol,
        name,
        correlation: round(corr, 3),
        cluster: proxy.symbol === "SPY"
          ? "equity"
          : proxy.symbol === "TLT"
            ? "bond"
            : proxyCommodityProfile?.cluster || "other",
      });
    }

    // Sort for top correlated and anti-correlated
    const sorted = entries.slice().sort((a, b) => b.correlation - a.correlation);
    const topCorrelated = sorted.filter(e => e.correlation > 0).slice(0, 5);
    const topAntiCorrelated = sorted.filter(e => e.correlation < 0).sort((a, b) => a.correlation - b.correlation).slice(0, 5);

    // Cluster group from static profile
    const profile = getCommodityProfile(symbol);
    const clusterGroup = profile?.cluster || "unknown";

    // Diversification value: based on avg cross-correlation
    const commodityCorrs = entries.filter(e => COMMODITY_SYMBOLS.includes(e.symbol)).map(e => Math.abs(e.correlation));
    const avgCrossCorrelation = commodityCorrs.length > 0 ? round(mean(commodityCorrs), 3) : 0;

    let diversificationValue: "high" | "moderate" | "low" = "moderate";
    if (avgCrossCorrelation < 0.3) diversificationValue = "high";
    else if (avgCrossCorrelation > 0.6) diversificationValue = "low";

    return {
      topCorrelated,
      topAntiCorrelated,
      clusterGroup,
      diversificationValue,
      avgCrossCorrelation,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  static computeReturnsFromPrices(
    prices: { date: Date; close: number }[],
  ): { date: Date; close: number }[] {
    const returns: { date: Date; close: number }[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1].close > 0) {
        returns.push({
          date: prices[i].date,
          close: (prices[i].close - prices[i - 1].close) / prices[i - 1].close,
        });
      }
    }
    return returns;
  }

  static computePairCorrelation(
    a: { date: Date; close: number }[],
    b: { date: Date; close: number }[],
  ): number {
    // Align by date
    const bMap = new Map(b.map(p => [p.date.toISOString().split("T")[0], p.close]));
    const aligned: { x: number; y: number }[] = [];

    for (const p of a) {
      const key = p.date.toISOString().split("T")[0];
      const bVal = bMap.get(key);
      if (bVal !== undefined) {
        aligned.push({ x: p.close, y: bVal });
      }
    }

    if (aligned.length < 20) return 0;

    const xArr = aligned.map(p => p.x);
    const yArr = aligned.map(p => p.y);
    return pearsonCorrelation(xArr, yArr);
  }
}

// ─── Math Utilities ─────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const mx = mean(x);
  const my = mean(y);

  let num = 0;
  let dx2 = 0;
  let dy2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return 0;
  return num / denom;
}
