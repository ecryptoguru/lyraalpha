/**
 * Score Dynamics Engine (Phase 1)
 * Calculates temporal dynamics for asset scores including momentum, acceleration, and trends
 */

import { prisma } from "../prisma";
import { ScoreType } from "@/generated/prisma/client";

export interface ScoreDynamics {
  momentum: number; // 1-week change in score
  acceleration: number; // Rate of change of momentum
  volatility: number; // Standard deviation of score
  trend: "IMPROVING" | "STABLE" | "DETERIORATING";
  percentileRank: number; // 0-100 vs all assets
  sectorPercentile: number; // 0-100 vs sector peers
}

// In-memory cache for score distributions to avoid massive DB scans on every request
// Keys: ScoreType, Value: { scores: number[], timestamp: number }
const GLOBAL_SCORE_CACHE: Record<string, { scores: { value: number }[]; timestamp: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const SCORE_CACHE_MAX_KEYS = 12; // 6 ScoreTypes + buffer; evict oldest on overflow

/**
 * Calculate score dynamics for a specific asset and score type
 */
export async function calculateScoreDynamics(
  assetId: string,
  scoreType: ScoreType,
  sectorId?: string,
  cachedAllScores?: { value: number }[],
  prefetchedSectorScores?: { value: number; assetId: string }[],
  prefetchedHistoricalScores?: { value: number; date: Date }[],
): Promise<ScoreDynamics | null> {
  // Use pre-fetched historical scores if available
  let historicalScores = prefetchedHistoricalScores;
  
  if (!historicalScores) {
    historicalScores = await prisma.assetScore.findMany({
      where: { assetId, type: scoreType },
      orderBy: { date: "desc" },
      take: 30,
    });
  }

  if (historicalScores.length < 2) {
    return null; // Need at least 2 points for a trend
  }

  const values = historicalScores.map((s) => s.value);
  const count = values.length;

  // Check if all values are identical (static data — no real history yet)
  const uniqueValues = new Set(values);
  const isStaticData = uniqueValues.size === 1;

  // Static data means no genuine dynamics can be computed.
  // Return null so the dynamics layer abstains rather than fabricating circular signal.
  if (isStaticData) return null;

  const momentumLookback = Math.min(6, count - 1);
  const momentum = values[0] - values[momentumLookback];

  let acceleration = 0;
  if (count >= 14) {
    const prevMomentum = values[7] - values[13];
    acceleration = momentum - prevMomentum;
  } else if (count >= 4) {
    const mid = Math.floor(count / 2);
    const m1 = values[0] - values[mid];
    const m2 = values[mid] - values[count - 1];
    acceleration = m1 - m2;
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const calculatedVariance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const volatility = Math.sqrt(calculatedVariance);

  let trend: "IMPROVING" | "STABLE" | "DETERIORATING" = "STABLE";
  const threshold = momentumLookback < 6 ? 2 : 5;

  if (momentum > threshold && acceleration >= -2) trend = "IMPROVING";
  else if (momentum < -threshold && acceleration <= 2) trend = "DETERIORATING";

  // 5. Percentile rank (vs all assets)
  let allScores = cachedAllScores;
  
  if (!allScores) {
    const now = Date.now();
    const cached = GLOBAL_SCORE_CACHE[scoreType];
    
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      allScores = cached.scores;
    } else {
      allScores = await prisma.assetScore.findMany({
        where: {
          type: scoreType,
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        },
        select: { value: true },
        distinct: ["assetId"],
      });
      const cacheKeys = Object.keys(GLOBAL_SCORE_CACHE);
      if (cacheKeys.length >= SCORE_CACHE_MAX_KEYS) {
        const oldest = cacheKeys.reduce((a, b) => GLOBAL_SCORE_CACHE[a].timestamp < GLOBAL_SCORE_CACHE[b].timestamp ? a : b);
        delete GLOBAL_SCORE_CACHE[oldest];
      }
      GLOBAL_SCORE_CACHE[scoreType] = { scores: allScores, timestamp: now };
    }
  }

  const currentValue = values[0];
  const lowerCount = allScores.filter((s) => s.value < currentValue).length;
  const percentileRank = allScores.length > 0 ? (lowerCount / allScores.length) * 100 : 50;

  // 6. Sector percentile
  let sectorPercentile = 50;
  if (sectorId) {
    let sectorScores = prefetchedSectorScores;
    
    if (!sectorScores) {
      const sectorAssets = await prisma.stockSector.findMany({
        where: { sectorId, isActive: true },
        select: { assetId: true },
      });

      sectorScores = await prisma.assetScore.findMany({
        where: {
          assetId: { in: sectorAssets.map((a) => a.assetId) },
          type: scoreType,
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { value: true, assetId: true },
        distinct: ["assetId"],
      });
    }

    const sectorLowerCount = sectorScores.filter(
      (s) => s.value < currentValue,
    ).length;
    sectorPercentile =
      sectorScores.length > 0
        ? (sectorLowerCount / sectorScores.length) * 100
        : 50;
  }

  return {
    momentum: Math.round(momentum * 1000) / 1000,
    acceleration: Math.round(acceleration * 1000) / 1000,
    volatility: Math.round(volatility * 1000) / 1000,
    trend,
    percentileRank: Math.round(percentileRank),
    sectorPercentile: Math.round(sectorPercentile),
  };
}

/**
 * Pre-fetched context passed to calculateAllScoreDynamicsBulk.
 * Fetch once for all assets, pass to each call — eliminates N×global-scan.
 */
export interface BulkDynamicsContext {
  globalByType: Map<ScoreType, { value: number }[]>;
  sectorScoresByAsset: Map<string, Map<ScoreType, { value: number; assetId: string }[]>>;
  sectorIdByAsset: Map<string, string>;
}

/**
 * Build the shared context needed by calculateAllScoreDynamicsBulk.
 * Call ONCE before processing all assets — O(1) DB queries regardless of asset count.
 */
export async function buildBulkDynamicsContext(
  assetIds: string[],
): Promise<BulkDynamicsContext> {
  const scoreTypes: ScoreType[] = ["TREND", "MOMENTUM", "VOLATILITY", "SENTIMENT", "LIQUIDITY", "TRUST"];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Fetch all global score distributions in one query
  // 2. Fetch all sector mappings for all assets in one query
  const [globalScores, allSectorMappings] = await Promise.all([
    prisma.assetScore.findMany({
      where: { type: { in: scoreTypes }, date: { gte: sevenDaysAgo } },
      select: { value: true, type: true },
      distinct: ["assetId", "type"],
    }),
    prisma.stockSector.findMany({
      where: { assetId: { in: assetIds }, isActive: true },
      select: { assetId: true, sectorId: true },
    }),
  ]);

  // Build global distribution map
  const globalByType = new Map<ScoreType, { value: number }[]>();
  for (const s of globalScores) {
    const list = globalByType.get(s.type) || [];
    list.push({ value: s.value });
    globalByType.set(s.type, list);
  }

  // Build sector ID map per asset
  const sectorIdByAsset = new Map<string, string>();
  const uniqueSectorIds = new Set<string>();
  for (const m of allSectorMappings) {
    sectorIdByAsset.set(m.assetId, m.sectorId);
    uniqueSectorIds.add(m.sectorId);
  }

  // 3. Fetch all sector peer scores in one query (all sectors at once)
  const sectorScoresByAsset = new Map<string, Map<ScoreType, { value: number; assetId: string }[]>>();
  if (uniqueSectorIds.size > 0) {
    const allPeerMappings = await prisma.stockSector.findMany({
      where: { sectorId: { in: [...uniqueSectorIds] }, isActive: true },
      select: { assetId: true, sectorId: true },
    });
    const peerIds = [...new Set(allPeerMappings.map(p => p.assetId))];
    const sectorIdByPeer = new Map(allPeerMappings.map(p => [p.assetId, p.sectorId]));

    const peerScores = await prisma.assetScore.findMany({
      where: { assetId: { in: peerIds }, type: { in: scoreTypes }, date: { gte: sevenDaysAgo } },
      select: { value: true, assetId: true, type: true },
      distinct: ["assetId", "type"],
    });

    // Group peer scores by sectorId → type
    const sectorTypeMap = new Map<string, Map<ScoreType, { value: number; assetId: string }[]>>();
    for (const s of peerScores) {
      const sid = sectorIdByPeer.get(s.assetId);
      if (!sid) continue;
      let typeMap = sectorTypeMap.get(sid);
      if (!typeMap) { typeMap = new Map(); sectorTypeMap.set(sid, typeMap); }
      const list = typeMap.get(s.type as ScoreType) || [];
      list.push({ value: s.value, assetId: s.assetId });
      typeMap.set(s.type as ScoreType, list);
    }

    // Map each asset to its sector's type map
    for (const assetId of assetIds) {
      const sid = sectorIdByAsset.get(assetId);
      if (sid && sectorTypeMap.has(sid)) {
        sectorScoresByAsset.set(assetId, sectorTypeMap.get(sid)!);
      }
    }
  }

  return { globalByType, sectorScoresByAsset, sectorIdByAsset };
}

/**
 * Bulk-optimized version: accepts pre-fetched context so no global DB scans per asset.
 * Returns { id, dynamics } pairs for batch writing — caller handles persistence.
 */
export async function calculateAllScoreDynamicsBulk(
  assetId: string,
  context: BulkDynamicsContext,
): Promise<{ id: string; dynamics: ScoreDynamics }[]> {
  const scoreTypes: ScoreType[] = ["TREND", "MOMENTUM", "VOLATILITY", "SENTIMENT", "LIQUIDITY", "TRUST"];

  const [allHistorical, allLatest] = await Promise.all([
    prisma.assetScore.findMany({
      where: { assetId, type: { in: scoreTypes } },
      orderBy: { date: "desc" },
      take: 180,
      select: { id: true, value: true, date: true, type: true },
    }),
    prisma.assetScore.findMany({
      where: { assetId, type: { in: scoreTypes } },
      orderBy: { date: "desc" },
      distinct: ["type"],
      select: { id: true, value: true, type: true },
    }),
  ]);

  if (allLatest.length === 0) return [];

  const historicalByType = new Map<ScoreType, { value: number; date: Date }[]>();
  for (const s of allHistorical) {
    const list = historicalByType.get(s.type) || [];
    list.push({ value: s.value, date: s.date });
    historicalByType.set(s.type, list);
  }

  const sectorId = context.sectorIdByAsset.get(assetId);
  const sectorTypeMap = context.sectorScoresByAsset.get(assetId);

  const updates: { id: string; dynamics: ScoreDynamics }[] = [];
  await Promise.all(
    allLatest.map(async (latest) => {
      const dynamics = await calculateScoreDynamics(
        assetId,
        latest.type,
        sectorId,
        context.globalByType.get(latest.type),
        sectorTypeMap?.get(latest.type),
        historicalByType.get(latest.type),
      );
      if (dynamics) updates.push({ id: latest.id, dynamics });
    })
  );

  return updates;
}



/**
 * Helper: Calculate trend from time series
 */
export function classifyScoreTrend(
  values: number[],
): "IMPROVING" | "STABLE" | "DETERIORATING" {
  if (values.length < 3) return "STABLE";

  // Simple linear regression slope
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((sum, v) => sum + v, 0);
  const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (slope > 0.5) return "IMPROVING";
  if (slope < -0.5) return "DETERIORATING";
  return "STABLE";
}
