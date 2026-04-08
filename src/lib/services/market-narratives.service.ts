import { prisma } from "@/lib/prisma";
import { withStaleWhileRevalidate } from "@/lib/redis";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { calculateNarrativeDivergence } from "@/lib/engines/narrative-divergence";
import { cleanAssetText, getFriendlyAssetName, getFriendlySymbol } from "@/lib/format-utils";

const MARKET_NARRATIVES_TTL_SECONDS = 5 * 60;
const MARKET_NARRATIVES_STALE_SECONDS = 15 * 60;

function marketNarrativesCacheKey(region: string): string {
  return `market:narratives:${region}`;
}

export interface NarrativeTheme {
  id: string;
  title: string;
  summary: string;
  tone: "strengthening" | "weakening";
  signal: string;
  relatedAssets: Array<{ symbol: string; label: string }>;
}

export interface NarrativeLinkedAsset {
  symbol: string;
  name: string;
  type: string;
  changePercent: number | null;
  avgSentimentScore: number | null;
  mediaSentiment: number | null;
  divergenceScore: number;
  direction: "ALIGNED" | "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE";
  explanation: string;
  signal: "CAUTION" | "NEUTRAL" | "CONFIRMATION";
  discoveryHeadline: string | null;
  discoveryArchetype: string | null;
}

export interface NarrativeStoryMapNode {
  source: string;
  target: string;
  context: string;
}

export interface MarketNarrativesData {
  generatedAt: string;
  region: string;
  regimeLabel: string;
  regimeSentence: string;
  marketOverview: string;
  factorRotationSignal: string | null;
  discoveryHighlight: string | null;
  strengtheningThemes: NarrativeTheme[];
  weakeningThemes: NarrativeTheme[];
  linkedAssets: NarrativeLinkedAsset[];
  storyMap: NarrativeStoryMapNode[];
  source?: "briefing" | "fallback";
}

function average(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function normalizeNarrativeOverview(regimeLabel: string, marketOverview: string | null | undefined): string {
  const cleanOverview = marketOverview?.trim();
  if (cleanOverview) return cleanOverview;

  return `${regimeLabel} is the clearest market story right now and it is shaping how risk, leadership and positioning are showing up across assets.`;
}

function normalizeNarrativeSentence(regimeLabel: string, regimeSentence: string | null | undefined): string {
  const cleanSentence = regimeSentence?.trim();
  if (cleanSentence) return cleanSentence;

  return `${regimeLabel} is the current market backdrop and it is the main lens for understanding which stories are gaining support and which ones are fading.`;
}

function normalizeNarrativeSignalText(signal: string | null | undefined): string | null {
  const cleanSignal = signal?.trim();
  return cleanSignal || null;
}

function storySourceLabel(direction: NarrativeLinkedAsset["direction"]): string {
  if (direction === "BULLISH_DIVERGENCE") return "Headline skepticism";
  if (direction === "BEARISH_DIVERGENCE") return "Headline optimism";
  return "Signal confirmation";
}

async function buildMarketNarratives(region: string): Promise<MarketNarrativesData | null> {
  const [dailyBriefing, gainers, losers, assets] = await Promise.all([
    DailyBriefingService.getBriefing(region),
    prisma.asset.findMany({
      where: { region, price: { gt: 0 }, changePercent: { gt: 0 } },
      orderBy: { changePercent: "desc" },
      take: 4,
      select: { symbol: true, name: true, changePercent: true },
    }),
    prisma.asset.findMany({
      where: { region, price: { gt: 0 }, changePercent: { lt: 0 } },
      orderBy: { changePercent: "asc" },
      take: 4,
      select: { symbol: true, name: true, changePercent: true },
    }),
    prisma.asset.findMany({
      where: {
        region,
        price: { gt: 0 },
        avgSentimentScore: { not: null },
        evidence: { some: { sentimentScore: { not: null } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: {
        symbol: true,
        name: true,
        type: true,
        changePercent: true,
        avgSentimentScore: true,
        evidence: {
          where: { sentimentScore: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 5,
          select: { sentimentScore: true },
        },
        discoveryFeedItems: {
          where: { isSuppressed: false },
          orderBy: { computedAt: "desc" },
          take: 1,
          select: { headline: true, archetype: true },
        },
      },
    }),
  ]);

  const fallbackRegimeLabel = "NEUTRAL";
  const activeRegimeLabel = dailyBriefing?.regimeLabel ?? fallbackRegimeLabel;
  const activeRegimeSentence = normalizeNarrativeSentence(activeRegimeLabel, dailyBriefing?.regimeSentence);
  const activeMarketOverview = normalizeNarrativeOverview(
    activeRegimeLabel,
    dailyBriefing?.marketOverview ?? (gainers[0]
      ? `${getFriendlyAssetName(gainers[0].symbol, gainers[0].name)} is helping define the current market tone, while leadership still looks selective rather than broad.`
      : losers[0]
      ? `${getFriendlyAssetName(losers[0].symbol, losers[0].name)} is one of the clearest weak spots right now, which keeps the market story cautious.`
      : `${activeRegimeLabel} is still the main backdrop and the next best read comes from fresh discovery signals and relative strength changes.`),
  );
  const rawDiscoveryHighlight = dailyBriefing?.discoveryHighlight
    ?? (assets.find((asset) => asset.discoveryFeedItems[0]?.headline)?.discoveryFeedItems[0]?.headline ?? null);
  const activeDiscoveryHighlight = normalizeNarrativeSignalText(
    rawDiscoveryHighlight ? cleanAssetText(rawDiscoveryHighlight) : null,
  );
  const activeFactorRotationSignal = normalizeNarrativeSignalText(dailyBriefing?.factorRotationSignal);

  const linkedAssets: NarrativeLinkedAsset[] = [];

  for (const asset of assets) {
      const mediaSentiment = average(
        asset.evidence
          .map((item) => item.sentimentScore)
          .filter((value): value is number => value != null),
      );

      if (mediaSentiment == null || asset.avgSentimentScore == null) {
        continue;
      }

      const divergence = calculateNarrativeDivergence(mediaSentiment, asset.avgSentimentScore, asset.evidence.length);
      const discoveryItem = asset.discoveryFeedItems[0] ?? null;

      linkedAssets.push({
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        changePercent: asset.changePercent,
        avgSentimentScore: asset.avgSentimentScore,
        mediaSentiment,
        divergenceScore: divergence.divergenceScore,
        direction: divergence.direction,
        explanation: divergence.explanation,
        signal: divergence.signal,
        discoveryHeadline: discoveryItem?.headline ?? null,
        discoveryArchetype: discoveryItem?.archetype ?? null,
      });
  }

  linkedAssets.sort((a, b) => b.divergenceScore - a.divergenceScore);
  linkedAssets.splice(6);

  const bullishDivergences = linkedAssets.filter((asset) => asset.direction === "BULLISH_DIVERGENCE").slice(0, 3);
  const bearishDivergences = linkedAssets.filter((asset) => asset.direction === "BEARISH_DIVERGENCE").slice(0, 3);

  const strengtheningThemes: NarrativeTheme[] = [];
  const weakeningThemes: NarrativeTheme[] = [];

  if (activeFactorRotationSignal) {
    strengtheningThemes.push({
      id: "factor-rotation",
      title: "Leadership rotation is active",
      summary: activeFactorRotationSignal.trim(),
      tone: "strengthening",
      signal: activeRegimeLabel,
      relatedAssets: gainers.slice(0, 2).map((asset) => ({
        symbol: asset.symbol,
        label: getFriendlyAssetName(asset.symbol, asset.name),
      })),
    });
  }

  if (activeDiscoveryHighlight) {
    strengtheningThemes.push({
      id: "fresh-opportunity",
      title: "Fresh opportunity is starting to stand out",
      summary: activeDiscoveryHighlight.trim(),
      tone: "strengthening",
      signal: "Discovery",
      relatedAssets: [
        ...linkedAssets
          .filter((asset) => asset.discoveryHeadline)
          .slice(0, 2)
          .map((asset) => ({
            symbol: asset.symbol,
            label: getFriendlySymbol(asset.symbol, asset.type, asset.name),
          })),
        ...gainers.slice(0, 1).map((asset) => ({
          symbol: asset.symbol,
          label: getFriendlyAssetName(asset.symbol, asset.name),
        })),
      ].slice(0, 2),
    });
  }

  if (bullishDivergences.length > 0) {
    strengtheningThemes.push({
      id: "bullish-divergence",
      title: "Negative headlines are lagging improving internals",
      summary: `${bullishDivergences.map((asset) => getFriendlySymbol(asset.symbol, asset.type, asset.name)).join(", ")} look stronger in the engine than the current media narrative suggests.`,
      tone: "strengthening",
      signal: "Contrarian setup",
      relatedAssets: bullishDivergences.map((asset) => ({
        symbol: asset.symbol,
        label: getFriendlySymbol(asset.symbol, asset.type, asset.name),
      })),
    });
  }

  const risksToWatch = dailyBriefing?.risksToWatch?.slice(0, 2) ?? [
    losers[0]
      ? `${getFriendlyAssetName(losers[0].symbol, losers[0].name)} is one of the clearest weak pockets in the tape and is worth monitoring for broader spillover.`
      : `Leadership is still narrow, so the backdrop needs stronger follow-through before a cleaner story emerges.`,
  ];

  risksToWatch.forEach((risk, index) => {
    weakeningThemes.push({
      id: `risk-${index}`,
      title: index === 0 ? "Pressure point to monitor" : "Secondary risk building",
      summary: risk,
      tone: "weakening",
      signal: "Risk watch",
      relatedAssets: losers.slice(index, index + 2).map((asset) => ({
        symbol: asset.symbol,
        label: getFriendlyAssetName(asset.symbol, asset.name),
      })),
    });
  });

  if (bearishDivergences.length > 0) {
    weakeningThemes.push({
      id: "bearish-divergence",
      title: "Optimistic headlines may be outrunning the data",
      summary: `${bearishDivergences.map((asset) => getFriendlySymbol(asset.symbol, asset.type, asset.name)).join(", ")} are receiving more positive narrative support than current engine sentiment confirms.`,
      tone: "weakening",
      signal: "Caution",
      relatedAssets: bearishDivergences.map((asset) => ({
        symbol: asset.symbol,
        label: getFriendlySymbol(asset.symbol, asset.type, asset.name),
      })),
    });
  }

  const storyMap: NarrativeStoryMapNode[] = [
    {
      source: activeRegimeLabel,
      target: "Market tone",
      context: activeRegimeSentence,
    },
    ...(activeFactorRotationSignal
      ? [{ source: "Factor rotation", target: "Sector leadership", context: activeFactorRotationSignal.trim() }]
      : []),
    ...(activeDiscoveryHighlight
      ? [{ source: "Discovery", target: "Fresh leadership", context: activeDiscoveryHighlight }]
      : []),
    ...linkedAssets.slice(0, 3).map((asset) => ({
      source: storySourceLabel(asset.direction),
      target: getFriendlySymbol(asset.symbol, asset.type, asset.name),
      context: asset.explanation,
    })),
  ];

  return {
    generatedAt: new Date().toISOString(),
    region,
    regimeLabel: activeRegimeLabel,
    regimeSentence: activeRegimeSentence,
    marketOverview: activeMarketOverview,
    factorRotationSignal: activeFactorRotationSignal,
    discoveryHighlight: activeDiscoveryHighlight,
    strengtheningThemes: strengtheningThemes.slice(0, 3),
    weakeningThemes: weakeningThemes.slice(0, 3),
    linkedAssets,
    storyMap,
    source: !dailyBriefing || dailyBriefing.source === "live_fallback" ? "fallback" : "briefing",
  };
}

export class MarketNarrativesService {
  static async getNarratives(region: string): Promise<MarketNarrativesData | null> {
    const result = await withStaleWhileRevalidate({
      key: marketNarrativesCacheKey(region),
      ttlSeconds: MARKET_NARRATIVES_TTL_SECONDS,
      staleSeconds: MARKET_NARRATIVES_STALE_SECONDS,
      fetcher: () => buildMarketNarratives(region),
    });

    return result ?? buildMarketNarratives(region);
  }

  static async warmNarratives(regions: string[] = ["US", "IN"]): Promise<Record<string, boolean>> {
    const results = await Promise.all(
      regions.map(async (region) => {
        const narratives = await this.getNarratives(region);
        return [region, Boolean(narratives)] as const;
      }),
    );

    return Object.fromEntries(results);
  }
}
