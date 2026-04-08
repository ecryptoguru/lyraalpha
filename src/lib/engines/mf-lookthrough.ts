import { PrismaClient, ScoreType } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "mf-lookthrough" });

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
}

export type MFBehavioralProfile =
  | "large-cap-stable"
  | "mid-cap-growth"
  | "flexi-cap-active"
  | "sectoral-concentrated"
  | "hybrid-balanced"
  | "debt-income"
  | "index-tracking";

export interface ConcentrationMetrics {
  hhi: number;
  top1Weight: number;
  top3Weight: number;
  top5Weight: number;
  top10Weight: number;
  holdingCount: number;
  level: "low" | "moderate" | "high";
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

export interface StyleAnalysis {
  declaredCategory: string;
  actualLargeCapPct: number;
  actualMidCapPct: number;
  actualSmallCapPct: number;
  styleDriftDetected: boolean;
  driftDescription: string | null;
}

export interface MFLookthroughResult {
  concentration: ConcentrationMetrics;
  lookthroughScores: LookthroughScores;
  styleAnalysis: StyleAnalysis;
  sectorBreakdown: { sector: string; weight: number }[];
  behavioral: MFBehavioralProfile;
  computedAt: string;
}

// ─── Market Cap Classification ──────────────────────────────────────

const LARGE_CAP_THRESHOLD = 200_000_000_000; // ₹20,000 Cr (~$2.4B)
const MID_CAP_THRESHOLD = 50_000_000_000;    // ₹5,000 Cr (~$600M)

// ─── Sector Normalization ───────────────────────────────────────────

function normalizeSectors(sectorWeights: SectorWeight[]): { sector: string; weight: number }[] {
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

// ─── Behavioral Profile Classification ──────────────────────────────

function classifyMFBehavior(opts: {
  category: string;
  styleAnalysis: StyleAnalysis;
  sectorBreakdown: { sector: string; weight: number }[];
  rSquared?: number | null;
  expenseRatio?: number | null;
  hasBondHoldings?: boolean;
}): MFBehavioralProfile {
  const cat = (opts.category || "").toLowerCase();

  // Debt / income funds
  if (cat.includes("debt") || cat.includes("liquid") || cat.includes("money market") || cat.includes("gilt") || opts.hasBondHoldings) {
    return "debt-income";
  }

  // Hybrid / balanced
  if (cat.includes("hybrid") || cat.includes("balanced") || cat.includes("arbitrage")) {
    return "hybrid-balanced";
  }

  // Index funds / very high R²
  if (cat.includes("index") || cat.includes("nifty") || cat.includes("sensex") || (opts.rSquared != null && opts.rSquared > 0.95 && opts.expenseRatio != null && opts.expenseRatio < 0.005)) {
    return "index-tracking";
  }

  // Sectoral / thematic
  if (cat.includes("sectoral") || cat.includes("thematic") || cat.includes("banking") || cat.includes("pharma") || cat.includes("technology") || cat.includes("infrastructure")) {
    return "sectoral-concentrated";
  }

  // Check top sector concentration for sectoral detection
  if (opts.sectorBreakdown.length > 0 && opts.sectorBreakdown[0].weight > 60) {
    return "sectoral-concentrated";
  }

  // Large cap
  if (cat.includes("large cap") || cat.includes("largecap") || cat.includes("bluechip")) {
    return "large-cap-stable";
  }

  // Mid / small cap
  if (cat.includes("mid cap") || cat.includes("midcap") || cat.includes("small cap") || cat.includes("smallcap")) {
    return "mid-cap-growth";
  }

  // Flexi cap / multi cap
  if (cat.includes("flexi") || cat.includes("multi") || cat.includes("focused")) {
    return "flexi-cap-active";
  }

  // Default based on style analysis
  if (opts.styleAnalysis.actualLargeCapPct > 65) return "large-cap-stable";
  if (opts.styleAnalysis.actualMidCapPct > 40) return "mid-cap-growth";
  return "flexi-cap-active";
}

// ─── Core Engine ────────────────────────────────────────────────────

export class MFLookthroughEngine {
  static async compute(
    prisma: PrismaClient,
    mfAssetId: string,
    topHoldings: TopHoldingsData,
    category: string,
    opts?: { rSquared?: number | null; expenseRatio?: number | null },
  ): Promise<MFLookthroughResult | null> {
    const holdings = topHoldings.holdings;
    if (!holdings || holdings.length === 0) {
      logger.debug({ mfAssetId }, "No holdings data — skipping MF lookthrough");
      return null;
    }

    // 1. Concentration metrics
    const concentration = this.computeConcentration(holdings);

    // 2. Sector breakdown
    const sectorBreakdown = normalizeSectors(topHoldings.sectorWeights || []);

    // 3. Cross-reference holdings against Indian stock universe
    const holdingSymbols = holdings
      .filter((h) => h.symbol && h.weight && h.weight > 0)
      .map((h) => {
        // Normalize: MF holdings may have .NS suffix or not
        const sym = h.symbol!;
        return sym.endsWith(".NS") ? sym : `${sym}.NS`;
      });

    // Also try without .NS for broader matching
    const allSymbols = [
      ...holdingSymbols,
      ...holdings
        .filter((h) => h.symbol && h.weight && h.weight > 0)
        .map((h) => h.symbol!.replace(".NS", "")),
    ];

    const matchedAssets = allSymbols.length > 0
      ? await prisma.asset.findMany({
          where: { symbol: { in: [...new Set(allSymbols)] } },
          select: {
            symbol: true,
            marketCap: true,
            scores: {
              orderBy: { date: "desc" },
              distinct: ["type"],
              select: { type: true, value: true },
            },
          },
        })
      : [];

    // Build map supporting both .NS and non-.NS lookups
    const assetMap = new Map<string, {
      symbol: string;
      marketCap: string | null;
      scores: { type: ScoreType; score: number }[];
    }>();
    for (const a of matchedAssets) {
      const entry = {
        symbol: a.symbol,
        marketCap: a.marketCap,
        scores: a.scores.map((s) => ({ type: s.type, score: s.value })),
      };
      assetMap.set(a.symbol, entry);
      // Also set without .NS
      if (a.symbol.endsWith(".NS")) {
        assetMap.set(a.symbol.replace(".NS", ""), entry);
      }
    }

    // 4. Lookthrough scores
    const lookthroughScores = this.computeLookthroughScores(holdings, assetMap);

    // 5. Style analysis (market cap distribution)
    const styleAnalysis = this.computeStyleAnalysis(holdings, assetMap, category);

    // 6. Behavioral profile
    const behavioral = classifyMFBehavior({
      category,
      styleAnalysis,
      sectorBreakdown,
      rSquared: opts?.rSquared,
      expenseRatio: opts?.expenseRatio,
    });

    return {
      concentration,
      lookthroughScores,
      styleAnalysis,
      sectorBreakdown,
      behavioral,
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

    const total = weights.reduce((s, w) => s + w, 0);
    const normalized = total > 0 ? weights.map((w) => (w / total) * 100) : weights;

    const hhi = normalized.reduce((s, w) => s + (w / 100) ** 2, 0);

    const sumN = (n: number) => normalized.slice(0, n).reduce((s, w) => s + w, 0);
    const top1Weight = Math.round(sumN(1) * 100) / 100;
    const top3Weight = Math.round(sumN(3) * 100) / 100;
    const top5Weight = Math.round(sumN(5) * 100) / 100;
    const top10Weight = Math.round(sumN(10) * 100) / 100;

    let level: "low" | "moderate" | "high" = "low";
    if (hhi > 0.12 || top1Weight > 15) level = "high";
    else if (hhi > 0.05 || top5Weight > 40) level = "moderate";

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

      // Try both with and without .NS
      const sym = h.symbol;
      const asset = assetMap.get(sym) || assetMap.get(sym.replace(".NS", "")) || assetMap.get(`${sym}.NS`);
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

  // ─── Style Analysis ─────────────────────────────────────────────

  static computeStyleAnalysis(
    holdings: Holding[],
    assetMap: Map<string, { symbol: string; marketCap: string | null }>,
    declaredCategory: string,
  ): StyleAnalysis {
    let largeCapW = 0, midCapW = 0, smallCapW = 0, unmatchedW = 0;
    const totalWeight = holdings
      .filter((h) => h.weight != null && h.weight > 0)
      .reduce((s, h) => s + h.weight!, 0);

    for (const h of holdings) {
      if (!h.symbol || !h.weight || h.weight <= 0) continue;
      const w = totalWeight > 0 ? (h.weight / totalWeight) * 100 : h.weight;

      const sym = h.symbol;
      const asset = assetMap.get(sym) || assetMap.get(sym.replace(".NS", "")) || assetMap.get(`${sym}.NS`);

      if (!asset || !asset.marketCap) {
        unmatchedW += w;
        continue;
      }

      const mcap = parseFloat(asset.marketCap);
      if (isNaN(mcap)) {
        unmatchedW += w;
        continue;
      }

      if (mcap >= LARGE_CAP_THRESHOLD) largeCapW += w;
      else if (mcap >= MID_CAP_THRESHOLD) midCapW += w;
      else smallCapW += w;
    }

    // Normalize matched portion
    const matchedTotal = largeCapW + midCapW + smallCapW;
    if (matchedTotal > 0) {
      const scale = 100 / (matchedTotal + unmatchedW);
      largeCapW *= scale;
      midCapW *= scale;
      smallCapW *= scale;
    }

    const actualLargeCapPct = Math.round(largeCapW * 100) / 100;
    const actualMidCapPct = Math.round(midCapW * 100) / 100;
    const actualSmallCapPct = Math.round(smallCapW * 100) / 100;

    // Detect style drift
    const cat = (declaredCategory || "").toLowerCase();
    let styleDriftDetected = false;
    let driftDescription: string | null = null;

    if ((cat.includes("large cap") || cat.includes("largecap") || cat.includes("bluechip")) && actualLargeCapPct < 60) {
      styleDriftDetected = true;
      driftDescription = `Declared Large Cap but only ${actualLargeCapPct.toFixed(0)}% in large caps. ${actualMidCapPct.toFixed(0)}% mid-cap exposure detected.`;
    } else if ((cat.includes("mid cap") || cat.includes("midcap")) && actualMidCapPct < 40) {
      styleDriftDetected = true;
      driftDescription = `Declared Mid Cap but only ${actualMidCapPct.toFixed(0)}% in mid caps. ${actualLargeCapPct.toFixed(0)}% large-cap exposure detected.`;
    } else if ((cat.includes("small cap") || cat.includes("smallcap")) && actualSmallCapPct < 40) {
      styleDriftDetected = true;
      driftDescription = `Declared Small Cap but only ${actualSmallCapPct.toFixed(0)}% in small caps. ${actualLargeCapPct.toFixed(0)}% large-cap, ${actualMidCapPct.toFixed(0)}% mid-cap exposure.`;
    }

    return {
      declaredCategory: declaredCategory || "Unknown",
      actualLargeCapPct,
      actualMidCapPct,
      actualSmallCapPct,
      styleDriftDetected,
      driftDescription,
    };
  }
}
