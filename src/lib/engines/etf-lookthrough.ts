import { PrismaClient, ScoreType } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "etf-lookthrough" });

// ─── Types ──────────────────────────────────────────────────────────

export interface Holding {
  symbol?: string | null;
  name?: string | null;
  weight?: number | null;
}

export interface SectorWeight {
  sector: string;
  weight: number | null;
}

export interface TopHoldingsData {
  holdings?: Holding[];
  sectorWeights?: SectorWeight[];
  equityHoldings?: {
    priceToEarnings?: number | null;
    priceToBook?: number | null;
    priceToSales?: number | null;
    medianMarketCap?: number | null;
    threeYearEarningsGrowth?: number | null;
  } | null;
  bondHoldings?: {
    maturity?: number | null;
    duration?: number | null;
  } | null;
}

export type BehavioralProfile =
  | "growth-sensitive"
  | "rate-sensitive"
  | "defensive-leaning"
  | "cyclical-tilted"
  | "volatility-sensitive"
  | "balanced";

export interface ConcentrationMetrics {
  hhi: number;
  top1Weight: number;
  top3Weight: number;
  top5Weight: number;
  top10Weight: number;
  holdingCount: number;
  level: "low" | "moderate" | "high";
}

export interface GeographicExposure {
  US: number;
  IN: number;
  other: number;
  matchedCount: number;
  totalCount: number;
}

export interface LookthroughScores {
  trend: number | null;
  momentum: number | null;
  volatility: number | null;
  sentiment: number | null;
  liquidity: number | null;
  trust: number | null;
  weightedAvg: number | null;
  matchRate: number;
}

export interface FactorExposure {
  value: number;
  growth: number;
  momentum: number;
  quality: number;
  size: number;
  dominant: string;
}

export interface ETFLookthroughResult {
  concentration: ConcentrationMetrics;
  geographic: GeographicExposure;
  lookthroughScores: LookthroughScores;
  factorExposure: FactorExposure;
  behavioral: BehavioralProfile;
  sectorBreakdown: { sector: string; weight: number }[];
  computedAt: string;
}

// ─── Sector → Factor Mapping ────────────────────────────────────────

const SECTOR_FACTOR_MAP: Record<string, { value: number; growth: number; momentum: number; quality: number; size: number }> = {
  technology: { value: 0.1, growth: 0.4, momentum: 0.3, quality: 0.15, size: 0.05 },
  communication_services: { value: 0.15, growth: 0.35, momentum: 0.25, quality: 0.15, size: 0.1 },
  consumer_cyclical: { value: 0.2, growth: 0.3, momentum: 0.2, quality: 0.15, size: 0.15 },
  consumer_defensive: { value: 0.3, growth: 0.1, momentum: 0.1, quality: 0.35, size: 0.15 },
  financial_services: { value: 0.35, growth: 0.15, momentum: 0.15, quality: 0.25, size: 0.1 },
  healthcare: { value: 0.2, growth: 0.3, momentum: 0.2, quality: 0.2, size: 0.1 },
  industrials: { value: 0.25, growth: 0.15, momentum: 0.2, quality: 0.2, size: 0.2 },
  energy: { value: 0.35, growth: 0.1, momentum: 0.25, quality: 0.15, size: 0.15 },
  utilities: { value: 0.35, growth: 0.05, momentum: 0.1, quality: 0.3, size: 0.2 },
  basic_materials: { value: 0.3, growth: 0.1, momentum: 0.25, quality: 0.15, size: 0.2 },
  realestate: { value: 0.35, growth: 0.1, momentum: 0.15, quality: 0.2, size: 0.2 },
};

const DEFAULT_FACTOR = { value: 0.2, growth: 0.2, momentum: 0.2, quality: 0.2, size: 0.2 };

// ─── Behavioral Profile Classification ──────────────────────────────

const GROWTH_SECTORS = new Set(["technology", "communication_services", "consumer_cyclical", "healthcare"]);
const DEFENSIVE_SECTORS = new Set(["utilities", "consumer_defensive", "healthcare"]);
const CYCLICAL_SECTORS = new Set(["energy", "basic_materials", "industrials"]);
const RATE_SECTORS = new Set(["realestate", "utilities", "financial_services"]);

function classifyBehavioralProfile(
  sectorWeights: { sector: string; weight: number }[],
  bondHoldings?: { maturity?: number | null; duration?: number | null } | null,
  beta?: number | null,
): BehavioralProfile {
  if (beta != null && beta > 1.5) return "volatility-sensitive";
  if (bondHoldings?.duration && bondHoldings.duration > 0) return "rate-sensitive";

  let growthW = 0, defensiveW = 0, cyclicalW = 0, rateW = 0;
  for (const sw of sectorWeights) {
    const key = sw.sector.toLowerCase().replace(/\s+/g, "_");
    const w = sw.weight;
    if (GROWTH_SECTORS.has(key)) growthW += w;
    if (DEFENSIVE_SECTORS.has(key)) defensiveW += w;
    if (CYCLICAL_SECTORS.has(key)) cyclicalW += w;
    if (RATE_SECTORS.has(key)) rateW += w;
  }

  const max = Math.max(growthW, defensiveW, cyclicalW, rateW);
  if (max < 30) return "balanced";
  if (growthW === max && growthW >= 40) return "growth-sensitive";
  if (defensiveW === max && defensiveW >= 35) return "defensive-leaning";
  if (cyclicalW === max && cyclicalW >= 35) return "cyclical-tilted";
  if (rateW === max && rateW >= 40) return "rate-sensitive";
  return "balanced";
}

// ─── Core Engine ────────────────────────────────────────────────────

export class ETFLookthroughEngine {
  /**
   * Compute full lookthrough analysis for an ETF.
   * Requires: topHoldings JSON (from Yahoo), access to DB for constituent matching.
   */
  static async compute(
    prisma: PrismaClient,
    etfAssetId: string,
    topHoldings: TopHoldingsData,
    etfBeta?: number | null,
  ): Promise<ETFLookthroughResult | null> {
    const holdings = topHoldings.holdings;
    if (!holdings || holdings.length === 0) {
      logger.debug({ etfAssetId }, "No holdings data — skipping lookthrough");
      return null;
    }

    // 1. Concentration metrics
    const concentration = this.computeConcentration(holdings);

    // 2. Sector breakdown (normalize)
    const sectorBreakdown = this.normalizeSectors(topHoldings.sectorWeights || []);

    // 3. Cross-reference holdings against our stock universe
    const holdingSymbols = holdings
      .filter((h) => h.symbol && h.weight && h.weight > 0)
      .map((h) => h.symbol!);

    // Fetch matched assets with their latest score per type
    const matchedAssets = holdingSymbols.length > 0
      ? await prisma.asset.findMany({
          where: { symbol: { in: holdingSymbols } },
          select: {
            symbol: true,
            region: true,
            scores: {
              orderBy: { date: "desc" },
              distinct: ["type"],
              select: { type: true, value: true },
            },
          },
        })
      : [];

    const assetMap = new Map(matchedAssets.map((a) => [
      a.symbol,
      {
        symbol: a.symbol,
        region: a.region,
        scores: a.scores.map((s) => ({ type: s.type, score: s.value })),
      },
    ]));

    // 4. Geographic exposure
    const geographic = this.computeGeographic(holdings, assetMap);

    // 5. Lookthrough scores (weighted constituent DSE scores)
    const lookthroughScores = this.computeLookthroughScores(holdings, assetMap);

    // 6. Factor exposure from sector weights
    const factorExposure = this.computeFactorExposure(sectorBreakdown);

    // 7. Behavioral profile
    const behavioral = classifyBehavioralProfile(
      sectorBreakdown,
      topHoldings.bondHoldings,
      etfBeta,
    );

    return {
      concentration,
      geographic,
      lookthroughScores,
      factorExposure,
      behavioral,
      sectorBreakdown,
      computedAt: new Date().toISOString(),
    };
  }

  // ─── Concentration ──────────────────────────────────────────────

  static computeConcentration(holdings: Holding[]): ConcentrationMetrics {
    const weights = holdings
      .filter((h) => h.weight != null && h.weight > 0)
      .map((h) => h.weight!)
      .sort((a, b) => b - a);

    if (weights.length === 0) {
      return { hhi: 0, top1Weight: 0, top3Weight: 0, top5Weight: 0, top10Weight: 0, holdingCount: 0, level: "low" };
    }

    // Normalize weights to sum to 100
    const total = weights.reduce((s, w) => s + w, 0);
    const normalized = total > 0 ? weights.map((w) => (w / total) * 100) : weights;

    // HHI: sum of squared weights (as fractions)
    const hhi = normalized.reduce((s, w) => s + (w / 100) ** 2, 0);

    const sumN = (n: number) => normalized.slice(0, n).reduce((s, w) => s + w, 0);
    const top1Weight = Math.round(sumN(1) * 100) / 100;
    const top3Weight = Math.round(sumN(3) * 100) / 100;
    const top5Weight = Math.round(sumN(5) * 100) / 100;
    const top10Weight = Math.round(sumN(10) * 100) / 100;

    // Classification
    let level: "low" | "moderate" | "high" = "low";
    if (hhi > 0.15 || top1Weight > 20) level = "high";
    else if (hhi > 0.06 || top5Weight > 50) level = "moderate";

    return {
      hhi: Math.round(hhi * 10000) / 10000,
      top1Weight,
      top3Weight,
      top5Weight,
      top10Weight,
      holdingCount: weights.length,
      level,
    };
  }

  // ─── Sector Normalization ───────────────────────────────────────

  static normalizeSectors(sectorWeights: SectorWeight[]): { sector: string; weight: number }[] {
    const valid = sectorWeights
      .filter((s) => s.weight != null && s.weight > 0)
      .map((s) => ({ sector: s.sector, weight: s.weight! }));

    if (valid.length === 0) return [];

    const total = valid.reduce((s, sw) => s + sw.weight, 0);
    return valid
      .map((s) => ({
        sector: s.sector,
        weight: total > 0 ? Math.round((s.weight / total) * 10000) / 100 : s.weight,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  // ─── Geographic Exposure ────────────────────────────────────────

  static computeGeographic(
    holdings: Holding[],
    assetMap: Map<string, { symbol: string; region: string | null }>,
  ): GeographicExposure {
    let us = 0, india = 0, other = 0, matched = 0;
    const totalWeight = holdings
      .filter((h) => h.weight != null && h.weight > 0)
      .reduce((s, h) => s + h.weight!, 0);

    for (const h of holdings) {
      if (!h.symbol || !h.weight || h.weight <= 0) continue;
      const normalizedWeight = totalWeight > 0 ? (h.weight / totalWeight) * 100 : h.weight;
      const asset = assetMap.get(h.symbol);
      if (asset) {
        matched++;
        if (asset.region === "IN") india += normalizedWeight;
        else us += normalizedWeight;
      } else {
        other += normalizedWeight;
      }
    }

    return {
      US: Math.round(us * 100) / 100,
      IN: Math.round(india * 100) / 100,
      other: Math.round(other * 100) / 100,
      matchedCount: matched,
      totalCount: holdings.filter((h) => h.symbol && h.weight && h.weight > 0).length,
    };
  }

  // ─── Lookthrough Scores ─────────────────────────────────────────

  static computeLookthroughScores(
    holdings: Holding[],
    assetMap: Map<string, { symbol: string; scores: { type: ScoreType; score: number }[] }>,
  ): LookthroughScores {
    const scoreTypes: ScoreType[] = ["TREND", "MOMENTUM", "VOLATILITY", "SENTIMENT", "LIQUIDITY", "TRUST"] as ScoreType[];
    const accum: Record<string, { weighted: number; totalWeight: number }> = {};
    for (const t of scoreTypes) {
      accum[t] = { weighted: 0, totalWeight: 0 };
    }

    let matchedWeight = 0;
    const totalWeight = holdings
      .filter((h) => h.weight != null && h.weight > 0)
      .reduce((s, h) => s + h.weight!, 0);

    for (const h of holdings) {
      if (!h.symbol || !h.weight || h.weight <= 0) continue;
      const normalizedWeight = totalWeight > 0 ? h.weight / totalWeight : 0;

      const asset = assetMap.get(h.symbol);
      if (!asset || asset.scores.length === 0) continue;

      matchedWeight += normalizedWeight;
      const scoreMap = new Map(asset.scores.map((s) => [s.type, s.score]));

      for (const t of scoreTypes) {
        const score = scoreMap.get(t);
        if (score != null) {
          accum[t].weighted += score * normalizedWeight;
          accum[t].totalWeight += normalizedWeight;
        }
      }
    }

    const resolve = (t: string) => {
      const a = accum[t];
      return a.totalWeight > 0 ? Math.round((a.weighted / a.totalWeight) * 100) / 100 : null;
    };

    const scores = {
      trend: resolve("TREND"),
      momentum: resolve("MOMENTUM"),
      volatility: resolve("VOLATILITY"),
      sentiment: resolve("SENTIMENT"),
      liquidity: resolve("LIQUIDITY"),
      trust: resolve("TRUST"),
    };

    const validScores = Object.values(scores).filter((s) => s != null) as number[];
    const weightedAvg = validScores.length > 0
      ? Math.round((validScores.reduce((s, v) => s + v, 0) / validScores.length) * 100) / 100
      : null;

    return {
      ...scores,
      weightedAvg,
      matchRate: Math.round(matchedWeight * 10000) / 100,
    };
  }

  // ─── Factor Exposure ────────────────────────────────────────────

  static computeFactorExposure(sectorBreakdown: { sector: string; weight: number }[]): FactorExposure {
    let value = 0, growth = 0, momentum = 0, quality = 0, size = 0;
    let totalWeight = 0;

    for (const sw of sectorBreakdown) {
      const key = sw.sector.toLowerCase().replace(/\s+/g, "_");
      const factors = SECTOR_FACTOR_MAP[key] || DEFAULT_FACTOR;
      const w = sw.weight / 100;
      totalWeight += w;

      value += factors.value * w;
      growth += factors.growth * w;
      momentum += factors.momentum * w;
      quality += factors.quality * w;
      size += factors.size * w;
    }

    // Normalize to 0-100 scale
    const scale = totalWeight > 0 ? 100 / totalWeight : 0;
    const result = {
      value: Math.round(value * scale),
      growth: Math.round(growth * scale),
      momentum: Math.round(momentum * scale),
      quality: Math.round(quality * scale),
      size: Math.round(size * scale),
    };

    // Determine dominant factor
    const entries = Object.entries(result) as [string, number][];
    const [dominant] = entries.sort((a, b) => b[1] - a[1]);

    return { ...result, dominant: dominant[0] };
  }
}
