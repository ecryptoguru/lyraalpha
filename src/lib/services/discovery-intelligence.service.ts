/**
 * Discovery Intelligence Service — Phase 2.3
 *
 * Orchestrates the DRS pipeline:
 * 1. Fetch all assets with scores + dynamics
 * 2. Compute peer medians per asset type
 * 3. Compute DRS for each asset
 * 4. Generate headlines/context via templates
 * 5. Apply suppression rules
 * 6. Overwrite DiscoveryFeedItem table with top 50
 */

import { prisma } from "@/lib/prisma";
import { type AssetType, type ScoreType, type Prisma } from "@/generated/prisma/client";
import { computeDRS, type DRSInput, type DRSResult } from "@/lib/engines/discovery-relevance";
import { generateHeadline, generateContext } from "@/lib/services/discovery-explanation";
import { logger } from "@/lib/logger";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { asPrismaJsonValue } from "@/lib/utils/json";

const FEED_SIZE = 50;
const TTL_HOURS = 48;
const SUPPORTED_REGIONS = ["US", "IN"] as const;

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function computeDiscoveryFeed(): Promise<{ total: number; surfaced: number; suppressed: number }> {
  const startTime = Date.now();

  // 1. Fetch all assets with relevant data
  const assets = await prisma.asset.findMany({
    where: {
      lastPriceUpdate: { not: null },
      type: { in: ["CRYPTO"] },
    },
    select: {
      id: true,
      symbol: true,
      name: true,
      type: true,
      region: true,
      scoreDynamics: true,
      signalStrength: true,
      price: true,
      changePercent: true,
      currency: true,
      compatibilityScore: true,
      compatibilityLabel: true,
      lastPriceUpdate: true,
      scores: {
        where: {
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { date: "desc" },
        distinct: ["type"],
        select: { type: true, value: true },
      },
    },
  });

  // Pre-filter: assets without scoreDynamics are included but will have zero momentum
  const candidateAssets = assets;
  logger.info(
    { total: assets.length, candidates: candidateAssets.length, skipped: assets.length - candidateAssets.length },
    "Discovery: fetched assets for DRS computation",
  );

  const assetLookup = new Map(
    assets.map((a) => [a.id, { price: a.price, changePercent: a.changePercent, currency: a.currency, scores: a.scores }]),
  );

  let totalSurfaced = 0;
  let totalSuppressed = 0;

  for (const region of SUPPORTED_REGIONS) {
    const regionAssets = assets.filter((a) => (a.region ?? "US") === region);
    const regionCandidates = candidateAssets.filter((a) => (a.region ?? "US") === region);

    if (regionCandidates.length === 0) {
      logger.info(
        { region, total: regionAssets.length, candidates: regionCandidates.length },
        "Discovery: skipping region feed (no candidates)",
      );
      continue;
    }

    const peerMedians = computePeerMedians(regionAssets);
    const latestRegime = await prisma.multiHorizonRegime.findFirst({
      where: { region },
      orderBy: { date: "desc" },
      select: {
        transitionProbability: true,
        transitionDirection: true,
        current: true,
      },
    });

    const results: DRSResult[] = [];

    for (const asset of regionCandidates) {
      const input = buildDRSInput(asset, peerMedians, latestRegime);
      const partial = computeDRS(input);

      const regimeState = latestRegime
        ? extractRegimeLabel(latestRegime.current as Record<string, unknown>)
        : undefined;

      const signalLabel = asset.signalStrength
        ? (asset.signalStrength as Record<string, unknown>).label as string
        : undefined;


      const headline = generateHeadline(
        partial.archetype,
        partial.symbol,
        partial.name,
        partial.type,
        partial.inflections,
        partial.drs,
        { regimeState },
      );

      const context = generateContext(
        partial.archetype,
        partial.type,
        partial.inflections,
        partial.drs,
        {
          regimeState,
          transitionDirection: latestRegime?.transitionDirection,
          signalLabel,
        },
      );

      results.push({ ...partial, headline, context });
    }

    const topResults = stratifiedSelect(results, FEED_SIZE);
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
    const computedAt = new Date();

    const currentGen = await prisma.discoveryFeedItem.findFirst({
      where: { asset: { region } },
      select: { generation: true },
      orderBy: { computedAt: "desc" },
    });
    const newGeneration = (currentGen?.generation ?? 0) + 1;

    await prisma.$transaction([
      prisma.discoveryFeedItem.createMany({
        data: topResults.map((r) => {
          const assetData = assetLookup.get(r.assetId);
          const scoreMap =
            assetData?.scores.reduce(
              (acc, s) => ({ ...acc, [s.type]: Math.round(s.value) }),
              {} as Record<string, number>,
            ) ?? {};

          return {
            assetId: r.assetId,
            symbol: r.symbol,
            assetName: r.name,
            assetType: r.type,
            drs: r.drs,
            archetype: r.archetype,
            headline: r.headline,
            context: r.context,
            inflections: r.inflections.length > 0 ? asPrismaJsonValue(r.inflections) as Prisma.InputJsonValue : undefined,
            scores: Object.keys(scoreMap).length > 0 ? asPrismaJsonValue(scoreMap) as Prisma.InputJsonValue : undefined,
            price: assetData?.price ?? null,
            changePercent: assetData?.changePercent ?? null,
            currency: assetData?.currency ?? null,
            isEliteOnly: r.isEliteOnly,
            isSuppressed: r.isSuppressed,
            suppressionReason: r.suppressionReason || null,
            generation: newGeneration,
            computedAt,
            expiresAt,
          };
        }),
      }),
      prisma.discoveryFeedItem.deleteMany({
        where: { generation: { lt: newGeneration }, asset: { region } },
      }),
    ]);

    const surfaced = topResults.filter((r) => !r.isSuppressed).length;
    const suppressed = topResults.filter((r) => r.isSuppressed).length;
    totalSurfaced += surfaced;
    totalSuppressed += suppressed;

    logger.info(
      { region, total: regionAssets.length, surfaced, suppressed, feedSize: topResults.length },
      "Discovery: region feed computed",
    );
  }

  await invalidateCacheByPrefix("discovery:feed:");

  const elapsed = Date.now() - startTime;
  logger.info(
    { total: assets.length, surfaced: totalSurfaced, suppressed: totalSuppressed, elapsed: `${elapsed}ms` },
    "Discovery: feed computation complete",
  );

  return { total: assets.length, surfaced: totalSurfaced, suppressed: totalSuppressed };
}

// ─── Peer Median Computation ────────────────────────────────────────────────

interface AssetWithScores {
  type: AssetType;
  scores: { type: ScoreType; value: number }[];
}

function computePeerMedians(
  assets: AssetWithScores[],
): Record<string, Record<string, number>> {
  // Group scores by asset type → score type
  const grouped: Record<string, Record<string, number[]>> = {};

  for (const asset of assets) {
    const typeKey = asset.type;
    if (!grouped[typeKey]) grouped[typeKey] = {};

    for (const score of asset.scores) {
      if (!grouped[typeKey][score.type]) grouped[typeKey][score.type] = [];
      grouped[typeKey][score.type].push(score.value);
    }
  }

  // Compute medians
  const medians: Record<string, Record<string, number>> = {};
  for (const [type, scoreMap] of Object.entries(grouped)) {
    medians[type] = {};
    for (const [scoreType, values] of Object.entries(scoreMap)) {
      values.sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      medians[type][scoreType] = values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
    }
  }

  return medians;
}

// ─── Input Builder ──────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  region: string | null;
  scoreDynamics: unknown;
  signalStrength: unknown;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  compatibilityScore: number | null;
  compatibilityLabel: string | null;
  lastPriceUpdate: Date | null;
  scores: { type: ScoreType; value: number }[];
}

function buildDRSInput(
  asset: AssetRow,
  peerMedians: Record<string, Record<string, number>>,
  latestRegime: { transitionProbability: number; transitionDirection: string; current: unknown } | null,
): DRSInput {
  // Latest scores as Record<ScoreType, value>
  const latestScores: Record<string, number> = {};
  for (const score of asset.scores) {
    latestScores[score.type] = score.value;
  }

  // Peer medians for this asset type
  const typePeerMedians = peerMedians[asset.type] || {};

  // Regime alignment
  let regimeAlignment: DRSInput["regimeAlignment"] = null;
  if (latestRegime && asset.compatibilityScore != null) {
    regimeAlignment = {
      arcsScore: asset.compatibilityScore,
      transitionProbability: latestRegime.transitionProbability,
      transitionDirection: latestRegime.transitionDirection,
    };
  }

  // Sync age in hours
  const lastSyncAge = asset.lastPriceUpdate
    ? (Date.now() - asset.lastPriceUpdate.getTime()) / (1000 * 60 * 60)
    : 999;

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    type: asset.type,
    region: asset.region,
    scoreDynamics: asset.scoreDynamics as DRSInput["scoreDynamics"],
    latestScores,
    peerMedians: typePeerMedians,
    regimeAlignment,
    etfLookthrough: null,
    signalStrength: asset.signalStrength as DRSInput["signalStrength"],
    lastSyncAge,
  };
}

// ─── Stratified Selection ────────────────────────────────────────────────────

/**
 * Stratified selection ensures type diversity in the feed.
 * 1. Group eligible (non-suppressed) results by asset type, sorted by DRS desc
 * 2. Reserve minimum slots per type (proportional to universe, min 2 per type with data)
 * 3. Fill remaining slots from the global DRS-ranked pool
 * 4. Append suppressed items at the end (they're stored but hidden in the UI)
 */
function stratifiedSelect(results: DRSResult[], feedSize: number): DRSResult[] {
  const suppressed = results.filter((r) => r.isSuppressed);

  // Pre-sort eligible by DRS desc once — reused for both per-type groups and fill-remaining pool
  const eligible = results.filter((r) => !r.isSuppressed).sort((a, b) => b.drs - a.drs);

  // Group eligible by type (order within each group is already DRS desc from the sort above)
  const byType: Record<string, DRSResult[]> = {};
  for (const r of eligible) {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push(r);
  }

  const typeKeys = Object.keys(byType);
  const totalEligible = eligible.length;
  const maxSurfaced = feedSize;

  // Reserve minimum slots: proportional to type's share of universe, min 2 per type
  const reserved: Record<string, number> = {};
  let totalReserved = 0;
  for (const type of typeKeys) {
    const share = byType[type].length / totalEligible;
    const minSlots = Math.max(2, Math.round(share * maxSurfaced * 0.6)); // 60% proportional
    const capped = Math.min(minSlots, byType[type].length);
    reserved[type] = capped;
    totalReserved += capped;
  }

  // If over-reserved, scale down proportionally
  if (totalReserved > maxSurfaced) {
    const scale = maxSurfaced / totalReserved;
    totalReserved = 0;
    for (const type of typeKeys) {
      reserved[type] = Math.max(1, Math.floor(reserved[type] * scale));
      totalReserved += reserved[type];
    }
  }

  // Pick reserved items per type (top DRS within each type)
  const selected = new Set<string>();
  const feed: DRSResult[] = [];

  for (const type of typeKeys) {
    const count = reserved[type];
    for (let i = 0; i < count && i < byType[type].length; i++) {
      feed.push(byType[type][i]);
      selected.add(byType[type][i].assetId);
    }
  }

  // Fill remaining slots from global DRS-ranked pool (already sorted desc — no re-sort needed)
  if (feed.length < maxSurfaced) {
    for (const r of eligible) {
      if (feed.length >= maxSurfaced) break;
      if (!selected.has(r.assetId)) {
        feed.push(r);
        selected.add(r.assetId);
      }
    }
  }

  // Sort final feed by DRS desc
  feed.sort((a, b) => b.drs - a.drs);

  // Append suppressed items (stored but hidden)
  const suppressedTop = suppressed
    .sort((a, b) => b.drs - a.drs)
    .slice(0, Math.max(0, feedSize - feed.length));

  return [...feed, ...suppressedTop];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractRegimeLabel(current: Record<string, unknown>): string {
  if (current && typeof current === "object" && "label" in current) {
    return current.label as string;
  }
  return "unknown";
}
