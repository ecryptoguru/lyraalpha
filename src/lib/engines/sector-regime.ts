/**
 * Sector Regime Engine (Phase 2)
 * Calculates sector-level market regimes and rotation metrics
 */

import { prisma } from "../prisma";
import { MarketRegime } from "./market-regime";
import { AssetSignals } from "./compatibility";
import { SECTOR_REGIME } from "./constants";

export interface SectorRegimeData {
  sectorId: string;
  sectorName: string;
  regime: MarketRegime;
  regimeScore: number;
  participationRate: number; // % of crypto assets trending up
  relativeStrength: number; // Sector vs market
  rotationMomentum: number; // Inflow/outflow trend
  leadershipScore: number; // Is sector leading?
  drivers: string[];
}

/**
 * Calculate sector-level regime
 */
export async function calculateSectorRegime(
  sectorId: string,
): Promise<SectorRegimeData | null> {
  // Get sector info
  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: { id: true, name: true },
  });

  if (!sector) return null;

  // Get all active crypto assets in sector with scores
  const sectorAssets = await prisma.stockSector.findMany({
    where: { sectorId, isActive: true },
    include: {
      asset: {
        select: {
          symbol: true,
          scores: {
            take: 6,
            orderBy: { date: "desc" },
            select: { type: true, value: true },
          },
        },
      },
    },
    orderBy: { eligibilityScore: "desc" },
  });

  if (sectorAssets.length === 0) return null;

  // Extract signals for each asset
  const assetSignals: AssetSignals[] = sectorAssets.map((asset) => {
    const signals: AssetSignals = {
      trend: 0,
      momentum: 0,
      volatility: 0,
      liquidity: 0,
      sentiment: 0,
      trust: 0,
    };

    asset.asset.scores.forEach((score) => {
      const type = score.type.toLowerCase() as keyof AssetSignals;
      if (type in signals) {
        signals[type] = score.value;
      }
    });

    return signals;
  });

  // 1. Calculate participation rate (% trending up)
  const trendingUp = assetSignals.filter((s) => s.trend > 55).length;
  const participationRate = (trendingUp / assetSignals.length) * 100;

  // 2. Calculate average sector metrics
  const avgTrend =
    assetSignals.reduce((sum, s) => sum + s.trend, 0) / assetSignals.length;
  const avgMomentum =
    assetSignals.reduce((sum, s) => sum + s.momentum, 0) / assetSignals.length;
  const avgVolatility =
    assetSignals.reduce((sum, s) => sum + s.volatility, 0) /
    assetSignals.length;
  const avgSentiment =
    assetSignals.reduce((sum, s) => sum + s.sentiment, 0) / assetSignals.length;

  // 3. Calculate relative strength (vs market)
  // Get global market trend
  const allAssets = await prisma.assetScore.findMany({
    where: {
      type: "TREND",
      date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { value: true },
    distinct: ["assetId"],
  });

  const marketAvgTrend =
    allAssets.length > 0
      ? allAssets.reduce((sum, s) => sum + s.value, 0) / allAssets.length
      : 50;

  const relativeStrength = avgTrend - marketAvgTrend;

  // 4. Calculate rotation momentum (trend of relative strength)
  // Simplified: use momentum as proxy
  const rotationMomentum = avgMomentum - 50; // Deviation from neutral

  // 5. Calculate leadership score
  // High participation + positive relative strength + positive momentum = leadership
  const leadershipScore =
    ((participationRate / 100) * 0.4 +
      (Math.max(0, relativeStrength + 50) / 100) * 0.3 +
      (Math.max(0, rotationMomentum + 50) / 100) * 0.3) *
    100;

  // 6. Classify sector regime
    const volStateScore = 100 - avgVolatility;
    const riskScore = avgSentiment * 0.6 + (avgMomentum / 100) * 40;
    const w = SECTOR_REGIME.WEIGHTS;
    const regimeScore = 
      participationRate * w.PARTICIPATION + 
      volStateScore * w.VOLATILITY + 
      riskScore * w.RISK;

  let regime: MarketRegime = "NEUTRAL";
  if (regimeScore >= 75) regime = "STRONG_RISK_ON";
  else if (regimeScore >= 60) regime = "RISK_ON";
  else if (regimeScore <= 30) regime = "RISK_OFF";
  else if (regimeScore <= 45) regime = "DEFENSIVE";

  // 7. Generate drivers
  const drivers: string[] = [];
  if (participationRate >= 70) drivers.push("Broad sector participation");
  if (relativeStrength > 5) drivers.push("Outperforming market");
  if (relativeStrength < -5) drivers.push("Underperforming market");
  if (leadershipScore >= 70) drivers.push("Sector leadership detected");
  if (rotationMomentum > 10) drivers.push("Positive rotation momentum");
  if (rotationMomentum < -10) drivers.push("Negative rotation momentum");

  return {
    sectorId,
    sectorName: sector.name,
    regime,
    regimeScore: Math.round(regimeScore),
    participationRate: Math.round(participationRate),
    relativeStrength: Math.round(relativeStrength * 10) / 10,
    rotationMomentum: Math.round(rotationMomentum * 10) / 10,
    leadershipScore: Math.round(leadershipScore),
    drivers,
  };
}

/**
 * Calculate all sector regimes
 */
export async function calculateAllSectorRegimes(): Promise<SectorRegimeData[]> {
  const sectors = await prisma.sector.findMany({
    select: { id: true },
  });

  const results: SectorRegimeData[] = [];

  for (const sector of sectors) {
    const regimeData = await calculateSectorRegime(sector.id);
    if (regimeData) {
      results.push(regimeData);
    }
  }

  return results;
}

/**
 * Store sector regime in database
 */
export async function storeSectorRegime(sectorId: string): Promise<void> {
  const regimeData = await calculateSectorRegime(sectorId);

  if (!regimeData) return;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.sectorRegime.upsert({
    where: { sectorId_date: { sectorId, date: today } },
    create: {
      sectorId,
      date: today,
      regime: regimeData.regime,
      regimeScore: regimeData.regimeScore,
      participationRate: regimeData.participationRate,
      relativeStrength: regimeData.relativeStrength,
      rotationMomentum: regimeData.rotationMomentum,
      leadershipScore: regimeData.leadershipScore,
      context: JSON.stringify({ drivers: regimeData.drivers }),
    },
    update: {
      regime: regimeData.regime,
      regimeScore: regimeData.regimeScore,
      participationRate: regimeData.participationRate,
      relativeStrength: regimeData.relativeStrength,
      rotationMomentum: regimeData.rotationMomentum,
      leadershipScore: regimeData.leadershipScore,
      context: JSON.stringify({ drivers: regimeData.drivers }),
    },
  });
}

/**
 * Store all sector regimes at once
 */
export async function storeAllSectorRegimes(): Promise<void> {
  const sectors = await prisma.sector.findMany({ select: { id: true } });
  await Promise.all(sectors.map(s => storeSectorRegime(s.id)));
}

/**
 * Get latest sector regime from database
 */
export async function getLatestSectorRegime(
  sectorId: string,
): Promise<SectorRegimeData | null> {
  const latest = await prisma.sectorRegime.findFirst({
    where: { sectorId },
    orderBy: { date: "desc" },
    include: { sector: { select: { name: true } } },
  });

  if (!latest) return null;

  const context = latest.context ? JSON.parse(latest.context) : { drivers: [] };

  return {
    sectorId: latest.sectorId,
    sectorName: latest.sector.name,
    regime: latest.regime as MarketRegime,
    regimeScore: latest.regimeScore,
    participationRate: latest.participationRate,
    relativeStrength: latest.relativeStrength,
    rotationMomentum: latest.rotationMomentum,
    leadershipScore: latest.leadershipScore,
    drivers: context.drivers || [],
  };
}

/**
 * Identify sector rotation opportunities
 */
export async function identifySectorRotations(): Promise<{
  leadingSectors: SectorRegimeData[];
  laggingSectors: SectorRegimeData[];
  rotatingIn: SectorRegimeData[];
  rotatingOut: SectorRegimeData[];
}> {
  const allRegimes = await calculateAllSectorRegimes();

  // Sort by leadership score
  const sorted = [...allRegimes].sort(
    (a, b) => b.leadershipScore - a.leadershipScore,
  );

  const leadingSectors = sorted.filter((s) => s.leadershipScore >= 70);
  const laggingSectors = sorted.filter((s) => s.leadershipScore <= 30);
  const rotatingIn = sorted.filter(
    (s) => s.rotationMomentum > 10 && s.leadershipScore < 70,
  );
  const rotatingOut = sorted.filter(
    (s) => s.rotationMomentum < -10 && s.leadershipScore > 30,
  );

  return {
    leadingSectors,
    laggingSectors,
    rotatingIn,
    rotatingOut,
  };
}

/**
 * Cross-Sector Correlation Regime — return-based analysis.
 *
 * Computes average daily returns per sector from constituent OHLCV data,
 * then calculates pairwise Pearson correlations between sector return series.
 * Detects MACRO_DRIVEN (high avg corr), SECTOR_SPECIFIC (low), or TRANSITIONING.
 */

export type CrossSectorRegime = "MACRO_DRIVEN" | "SECTOR_SPECIFIC" | "TRANSITIONING";

export interface CrossSectorCorrelationResult {
  avgCorrelation: number;
  dispersion: number;
  regime: CrossSectorRegime;
  trend: "RISING" | "STABLE" | "FALLING";
  sectorDispersionIndex: number; // spread of sector returns (0-100)
  topCorrelatedPairs: { a: string; b: string; corr: number }[];
  leastCorrelatedPairs: { a: string; b: string; corr: number }[];
  implications: string;
  guidance: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function dailyReturns(closes: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) ret.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return ret;
}

const LOOKBACK_DAYS = 60;

export async function calculateCrossSectorCorrelation(): Promise<CrossSectorCorrelationResult> {
  const fallback: CrossSectorCorrelationResult = {
    avgCorrelation: 0,
    dispersion: 0,
    regime: "SECTOR_SPECIFIC",
    trend: "STABLE",
    sectorDispersionIndex: 50,
    topCorrelatedPairs: [],
    leastCorrelatedPairs: [],
    implications: "Insufficient sector data for correlation analysis.",
    guidance: "Diversify across sectors as a default strategy.",
  };

  // 1. Get all sectors with active crypto assets
  const sectors = await prisma.sector.findMany({
    where: { stockSectors: { some: { isActive: true } } },
    select: {
      id: true,
      name: true,
      stockSectors: {
        where: { isActive: true },
        select: { assetId: true },
      },
    },
  });

  if (sectors.length < 3) return fallback;

  // 2. Collect asset IDs and fetch price history in bulk
  const allAssetIds = [...new Set(sectors.flatMap(s => s.stockSectors.map(ss => ss.assetId)))];

  const priceData = await prisma.priceHistory.findMany({
    where: {
      assetId: { in: allAssetIds },
      date: { gte: new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
    },
    select: { assetId: true, date: true, close: true },
    orderBy: { date: "asc" },
  });

  // Group by asset
  const assetPrices = new Map<string, { date: string; close: number }[]>();
  for (const p of priceData) {
    const key = p.assetId;
    if (!assetPrices.has(key)) assetPrices.set(key, []);
    assetPrices.get(key)!.push({ date: p.date.toISOString().split("T")[0], close: p.close });
  }

  // 3. Compute average daily returns per sector
  const sectorReturns = new Map<string, { name: string; returns: number[] }>();

  for (const sector of sectors) {
    const memberReturns: number[][] = [];
    for (const ss of sector.stockSectors) {
      const prices = assetPrices.get(ss.assetId);
      if (!prices || prices.length < 10) continue;
      const closes = prices.map(p => p.close);
      memberReturns.push(dailyReturns(closes));
    }
    if (memberReturns.length < 2) continue;

    // Average returns across members for each day
    const minLen = Math.min(...memberReturns.map(r => r.length));
    if (minLen < 5) continue;
    const avgReturns: number[] = [];
    for (let i = 0; i < minLen; i++) {
      const daySum = memberReturns.reduce((s, r) => s + (r[i] || 0), 0);
      avgReturns.push(daySum / memberReturns.length);
    }
    sectorReturns.set(sector.id, { name: sector.name, returns: avgReturns });
  }

  const sectorIds = [...sectorReturns.keys()];
  if (sectorIds.length < 3) return fallback;

  // 4. Pairwise Pearson correlations
  const pairs: { a: string; b: string; aName: string; bName: string; corr: number }[] = [];
  for (let i = 0; i < sectorIds.length; i++) {
    for (let j = i + 1; j < sectorIds.length; j++) {
      const ra = sectorReturns.get(sectorIds[i])!;
      const rb = sectorReturns.get(sectorIds[j])!;
      const corr = pearsonCorrelation(ra.returns, rb.returns);
      pairs.push({ a: sectorIds[i], b: sectorIds[j], aName: ra.name, bName: rb.name, corr });
    }
  }

  if (pairs.length === 0) return fallback;

  const correlations = pairs.map(p => p.corr);
  const avgCorrelation = correlations.reduce((s, c) => s + c, 0) / correlations.length;
  const corrMean = avgCorrelation;
  const corrVariance = correlations.reduce((s, c) => s + (c - corrMean) ** 2, 0) / correlations.length;
  const dispersion = Math.sqrt(corrVariance);

  // 5. Correlation trend: compare first-half vs second-half avg correlation
  // Use return series split to detect if correlations are rising
  let trend: "RISING" | "STABLE" | "FALLING" = "STABLE";
  if (sectorIds.length >= 3) {
    const halfLen = Math.floor(sectorReturns.get(sectorIds[0])!.returns.length / 2);
    if (halfLen >= 5) {
      const earlyCorrs: number[] = [];
      const lateCorrs: number[] = [];
      for (let i = 0; i < sectorIds.length; i++) {
        for (let j = i + 1; j < sectorIds.length; j++) {
          const ra = sectorReturns.get(sectorIds[i])!.returns;
          const rb = sectorReturns.get(sectorIds[j])!.returns;
          earlyCorrs.push(pearsonCorrelation(ra.slice(0, halfLen), rb.slice(0, halfLen)));
          lateCorrs.push(pearsonCorrelation(ra.slice(halfLen), rb.slice(halfLen)));
        }
      }
      const earlyAvg = earlyCorrs.reduce((s, c) => s + c, 0) / earlyCorrs.length;
      const lateAvg = lateCorrs.reduce((s, c) => s + c, 0) / lateCorrs.length;
      const delta = lateAvg - earlyAvg;
      if (delta > 0.08) trend = "RISING";
      else if (delta < -0.08) trend = "FALLING";
    }
  }

  // 6. Sector dispersion index (spread of cumulative returns)
  const cumulativeReturns: number[] = [];
  for (const [, data] of sectorReturns) {
    const cumRet = data.returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    cumulativeReturns.push(cumRet * 100);
  }
  const retMean = cumulativeReturns.reduce((s, r) => s + r, 0) / cumulativeReturns.length;
  const retStd = Math.sqrt(cumulativeReturns.reduce((s, r) => s + (r - retMean) ** 2, 0) / cumulativeReturns.length);
  // Normalize: 0-100 where higher = more dispersion
  const sectorDispersionIndex = Math.round(Math.min(100, Math.max(0, retStd * 10)));

  // 7. Regime classification
  let regime: CrossSectorRegime = "SECTOR_SPECIFIC";
  if (avgCorrelation > 0.6) regime = "MACRO_DRIVEN";
  else if (avgCorrelation > 0.35 && trend === "RISING") regime = "TRANSITIONING";
  else if (avgCorrelation <= 0.35) regime = "SECTOR_SPECIFIC";

  // 8. Top/least correlated pairs
  const sorted = [...pairs].sort((a, b) => b.corr - a.corr);
  const topCorrelatedPairs = sorted.slice(0, 3).map(p => ({ a: p.aName, b: p.bName, corr: Math.round(p.corr * 100) / 100 }));
  const leastCorrelatedPairs = sorted.slice(-3).reverse().map(p => ({ a: p.aName, b: p.bName, corr: Math.round(p.corr * 100) / 100 }));

  // 9. Implications and guidance
  const implications = regime === "MACRO_DRIVEN"
    ? `Sectors moving in sync (avg ρ=${avgCorrelation.toFixed(2)}). Macro forces dominating — diversification benefits reduced.`
    : regime === "TRANSITIONING"
    ? `Sector correlations rising (avg ρ=${avgCorrelation.toFixed(2)}, trend: ${trend}). Potential regime shift — monitor for macro convergence.`
    : `Sectors showing divergent behavior (avg ρ=${avgCorrelation.toFixed(2)}). Asset selection and sector selection critical.`;

  const guidance = regime === "MACRO_DRIVEN"
    ? "Focus on market timing over sector selection. Reduce position concentration. Consider hedging macro exposure."
    : regime === "TRANSITIONING"
    ? "Prepare for potential correlation spike. Review sector-concentrated positions. Increase cash or hedge tail risk."
    : "Sector rotation opportunities available. Overweight leading sectors, underweight lagging. Asset selection adds alpha.";

  return {
    avgCorrelation: Math.round(avgCorrelation * 100) / 100,
    dispersion: Math.round(dispersion * 100) / 100,
    regime,
    trend,
    sectorDispersionIndex,
    topCorrelatedPairs,
    leastCorrelatedPairs,
    implications,
    guidance,
  };
}
