import { prisma } from "@/lib/prisma";
import { withStaleWhileRevalidate } from "@/lib/redis";
import { personalBriefingCacheKey } from "@/lib/cache-keys";
import { getFriendlyAssetName, getFriendlySymbol } from "@/lib/format-utils";

const PERSONAL_BRIEFING_TTL_SECONDS = 5 * 60;
const PERSONAL_BRIEFING_STALE_SECONDS = 10 * 60;

export interface PersonalBriefingAsset {
  symbol: string;
  name: string;
  type: string;
  changePercent: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  compatibilityScore: number | null;
  compatibilityLabel: string | null;
  signalScore: number | null;
  signalLabel: string | null;
}

export interface PersonalBriefing {
  date: string;
  watchlistCount: number;
  topAssets: PersonalBriefingAsset[];
  misaligned: string[];
  strongMomentum: string[];
  summary: string;
}

export interface PersonalBriefingResponse {
  briefing: PersonalBriefing | null;
  reason?: "empty_watchlist" | "no_assets";
}

function buildSummary(
  topAssets: { symbol: string; name: string; type: string; signalLabel: string | null; compatibilityLabel: string | null }[],
  misaligned: string[],
  strongMomentum: string[],
  assetLookup: Map<string, { name: string; type: string }>,
): string {
  const parts: string[] = [];

  if (topAssets.length > 0) {
    const top = topAssets[0];
    const displayName = getFriendlySymbol(top.symbol, top.type, top.name);
    parts.push(`${displayName} leads your watchlist with ${top.signalLabel ?? "strong"} signal strength.`);
  }

  if (strongMomentum.length > 0) {
    parts.push(`${strongMomentum.slice(0, 2).map((symbol) => {
      const asset = assetLookup.get(symbol);
      return getFriendlyAssetName(symbol, asset?.name);
    }).join(", ")} showing strong momentum today.`);
  }

  if (misaligned.length > 0) {
    parts.push(`${misaligned.slice(0, 2).map((symbol) => {
      const asset = assetLookup.get(symbol);
      return getFriendlyAssetName(symbol, asset?.name);
    }).join(", ")} ${misaligned.length === 1 ? "is" : "are"} regime-misaligned — review positioning.`);
  }

  return parts.join(" ") || "Your watchlist is synchronized with current market conditions.";
}

async function computePersonalBriefing(userId: string): Promise<PersonalBriefingResponse> {
  const today = new Date().toISOString().split("T")[0];

  const watchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { symbol: true },
  });

  if (watchlist.length === 0) {
    return { briefing: null, reason: "empty_watchlist" };
  }

  const symbols = watchlist.map((w) => w.symbol);

  const assets = await prisma.asset.findMany({
    where: { symbol: { in: symbols } },
    select: {
      symbol: true,
      name: true,
      type: true,
      changePercent: true,
      avgTrendScore: true,
      avgMomentumScore: true,
      compatibilityScore: true,
      compatibilityLabel: true,
      signalStrength: true,
    },
  });

  if (assets.length === 0) {
    return { briefing: null, reason: "no_assets" };
  }

  const sorted = [...assets].sort((a, b) => {
    const aSignal = ((a.signalStrength as Record<string, unknown> | null)?.score as number) ?? 0;
    const bSignal = ((b.signalStrength as Record<string, unknown> | null)?.score as number) ?? 0;
    return bSignal - aSignal;
  });

  const assetLookup = new Map(assets.map((asset) => [asset.symbol, { name: asset.name, type: asset.type }]));

  const topAssets = sorted.slice(0, 5).map((a) => ({
    symbol: a.symbol,
    name: a.name,
    type: a.type,
    changePercent: a.changePercent,
    trendScore: a.avgTrendScore,
    momentumScore: a.avgMomentumScore,
    compatibilityScore: a.compatibilityScore,
    compatibilityLabel: a.compatibilityLabel,
    signalScore: ((a.signalStrength as Record<string, unknown> | null)?.score as number) ?? null,
    signalLabel: ((a.signalStrength as Record<string, unknown> | null)?.label as string) ?? null,
  }));

  const misaligned = assets
    .filter((a) => (a.compatibilityScore ?? 100) < 40)
    .map((a) => a.symbol);

  const strongMomentum = assets
    .filter((a) => (a.avgMomentumScore ?? 0) > 70)
    .map((a) => a.symbol);

  return {
    briefing: {
      date: today,
      watchlistCount: symbols.length,
      topAssets,
      misaligned,
      strongMomentum,
      summary: buildSummary(topAssets, misaligned, strongMomentum, assetLookup),
    },
  };
}

export class PersonalBriefingService {
  static async getBriefing(userId: string): Promise<PersonalBriefingResponse> {
    const result = await withStaleWhileRevalidate(
      {
        key: personalBriefingCacheKey(userId),
        ttlSeconds: PERSONAL_BRIEFING_TTL_SECONDS,
        staleSeconds: PERSONAL_BRIEFING_STALE_SECONDS,
        fetcher: () => computePersonalBriefing(userId),
      },
    );

    return result ?? { briefing: null, reason: "empty_watchlist" };
  }
}
