/**
 * Daily Briefing Service — Feature #11
 *
 * Generates a daily AI market briefing by synthesizing:
 * - Market regime + transition signals
 * - Top movers (gainers/losers)
 * - Discovery feed highlights
 * - Key intelligence events
 * - Sector correlation state
 *
 * Cached in Redis for 24h per region. Triggered by cron once daily.
 */

import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis";
import { getGpt54Model } from "@/lib/ai/service";
import { buildHumanizerGuidance } from "@/lib/ai/prompts/humanizer";
import { generateText } from "ai";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { cleanAssetText, getFriendlyAssetName } from "@/lib/format-utils";
import { applyCostCeiling } from "@/lib/ai/cost-ceiling";
import { logValidationResult, validateOutput } from "@/lib/ai/output-validation";
import { recordLatencyViolation } from "@/lib/ai/alerting";

const logger = createLogger({ service: "daily-briefing" });

const CACHE_PREFIX = "lyra:daily-briefing";
const CACHE_TTL = 24 * 60 * 60; // 24 hours

export interface DailyBriefing {
  region: string;
  generatedAt: string;
  marketOverview: string;
  keyInsights: string[];
  risksToWatch: string[];
  topMovers: {
    gainers: Array<{ symbol: string; name: string; change: number }>;
    losers: Array<{ symbol: string; name: string; change: number }>;
  };
  discoveryHighlight: string | null;
  regimeLabel: string;
  regimeSentence: string;
  // Phase 3 Step 3.3 enhancements
  regimeTransitionProbability?: string;
  fragilityAlerts?: Array<{ symbol: string; score: number; level: string }>;
  narrativeDivergences?: Array<{ symbol: string; direction: string; score: number }>;
  factorRotationSignal?: string;
  source?: "cache" | "generated" | "live_fallback";
  debug?: {
    hasRegime: boolean;
    gainers: number;
    losers: number;
    events: number;
    discoveryItems: number;
    universeCount: number;
  };
}

function cacheKey(region: string): string {
  return `${CACHE_PREFIX}:${region}`;
}

interface BriefingInputs {
  regimeLabel: string;
  regimeContext: string;
  breadth: number;
  volatility: number;
  correlationRegime: string;
  avgCorrelation: number;
  totalAssets: number;
  avgChange: number;
  topGainers: Array<{ symbol: string; name: string; changePercent: number | null; type: string }>;
  topLosers: Array<{ symbol: string; name: string; changePercent: number | null; type: string }>;
  recentEvents: Array<{ title: string; type: string; severity: string }>;
  discoveryItems: Array<{ symbol: string; assetName: string; headline: string; drs: number }>;
}

function formatPercent(value: number | null | undefined): string {
  const safe = value ?? 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(2)}%`;
}

function toSentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeDiscoveryCopy(text: string, assets: Array<{ symbol: string; name?: string }> = []): string {
  return cleanAssetText(toSentenceCase(text.trim()), assets)
    .replace(/\bTrend\b/g, "trend")
    .replace(/\bMomentum\b/g, "momentum")
    .replace(/\bCrypto peers\b/g, "crypto peers");
}

function buildDiscoverySentence(item: BriefingInputs["discoveryItems"][number]): string {
  const assetLabel = getFriendlyAssetName(item.symbol, item.assetName);
  const assetRefs = [{ symbol: item.symbol, name: item.assetName }];
  return `${assetLabel} is the clearest fresh signal on the radar right now. ${normalizeDiscoveryCopy(item.headline, assetRefs)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAssetSymbols(text: string, assets: Array<{ symbol: string; name?: string }>): string {
  const uniqueAssets = Array.from(new Map(assets.map((asset) => [asset.symbol, asset])).values())
    .filter((asset) => asset.symbol.length > 1)
    .sort((a, b) => b.symbol.length - a.symbol.length);

  return uniqueAssets.reduce((result, asset) => {
    const label = getFriendlyAssetName(asset.symbol, asset.name);
    const pattern = new RegExp(`(^|[^A-Za-z0-9._-])${escapeRegex(asset.symbol)}(?=$|[^A-Za-z0-9._-])`, "g");
    return result.replace(pattern, (_, prefix: string) => `${prefix}${label}`);
  }, text);
}

function normalizeDiscoveryHighlightText(text: string | null | undefined): string | null {
  const clean = text?.trim();
  if (!clean) return null;

  const match = clean.match(/^([^:]+):\s*(.+)$/);
  if (!match) return normalizeDiscoveryCopy(clean);

  const [, rawLabel, detail] = match;
  const trimmedLabel = rawLabel.trim();
  const label = getFriendlyAssetName(trimmedLabel, trimmedLabel);
  return `${label}: ${normalizeDiscoveryCopy(detail, [{ symbol: trimmedLabel, name: trimmedLabel }])}`;
}

function parseDiscoveryHighlight(normalizedText: string | null | undefined): { label: string; detail: string } | null {
  const clean = normalizedText?.trim();
  if (!clean) return null;

  const match = clean.match(/^([^:]+):\s*(.+)$/);
  if (!match) return null;

  return { label: match[1], detail: match[2] };
}

function buildDiscoverySentenceFromHighlight(text: string | null | undefined): string | null {
  const normalized = normalizeDiscoveryHighlightText(text);
  if (!normalized) return null;
  const parsed = parseDiscoveryHighlight(normalized);
  if (!parsed) return normalized;
  return `${parsed.label} is the clearest fresh signal on the radar right now. ${parsed.detail.trim()}`;
}

function normalizeBriefingCopy(briefing: DailyBriefing): DailyBriefing {
  const assets = [
    ...briefing.topMovers.gainers.map((item) => ({ symbol: item.symbol, name: item.name })),
    ...briefing.topMovers.losers.map((item) => ({ symbol: item.symbol, name: item.name })),
  ];

  const discoveryHighlight = normalizeDiscoveryHighlightText(briefing.discoveryHighlight);
  const discoverySentence = buildDiscoverySentenceFromHighlight(discoveryHighlight);
  const parsedHighlight = parseDiscoveryHighlight(discoveryHighlight);

  let marketOverview = cleanAssetText(replaceAssetSymbols(briefing.marketOverview, assets), assets);
  if (discoverySentence) {
    const statsSentence = marketOverview.match(/^.*?tracked names\./)?.[0] ?? null;
    const trailingSentence = marketOverview.match(/(The latest institutional event flow is being shaped by .*\.|Event flow is light, so signal quality depends more on market breadth and follow-through than fresh headlines\.|[^.]+ is the clearest weak spot at [^.]*\.)$/)?.[0] ?? null;
    marketOverview = [statsSentence, discoverySentence, trailingSentence]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ");
  }

  const factorRotationSignal = parsedHighlight
    ? `Fresh signal activity is clustering around ${parsedHighlight.label}, which is the clearest rotation clue available right now.`
    : cleanAssetText(replaceAssetSymbols(briefing.factorRotationSignal ?? "", assets), assets) || undefined;

  return {
    ...briefing,
    marketOverview,
    discoveryHighlight,
    factorRotationSignal,
    keyInsights: briefing.keyInsights.map((item) => cleanAssetText(replaceAssetSymbols(item, assets), assets)),
    risksToWatch: briefing.risksToWatch.map((item) => cleanAssetText(replaceAssetSymbols(item, assets), assets)),
  };
}

function buildDebug(inputs: BriefingInputs): DailyBriefing["debug"] {
  return {
    hasRegime: inputs.regimeLabel !== "NEUTRAL" || inputs.correlationRegime !== "unknown",
    gainers: inputs.topGainers.length,
    losers: inputs.topLosers.length,
    events: inputs.recentEvents.length,
    discoveryItems: inputs.discoveryItems.length,
    universeCount: inputs.totalAssets,
  };
}

function buildLiveFallbackBriefing(region: string, inputs: BriefingInputs): DailyBriefing {
  const leadGainer = inputs.topGainers[0];
  const leadLoser = inputs.topLosers[0];
  const leadDiscovery = inputs.discoveryItems[0];
  const leadEvent = inputs.recentEvents[0];

  const marketOverviewParts = [
    `The ${region === "IN" ? "Indian" : "US"} market is currently reading ${inputs.regimeLabel.toLowerCase()}, with average asset performance at ${formatPercent(inputs.avgChange)} across ${inputs.totalAssets} tracked names.`,
    leadDiscovery
      ? buildDiscoverySentence(leadDiscovery)
      : leadGainer
      ? `${getFriendlyAssetName(leadGainer.symbol, leadGainer.name)} is leading the tape at ${formatPercent(leadGainer.changePercent)}, which is where leadership is showing up most clearly right now.`
      : `Leadership is still forming, so the best read comes from regime and risk conditions rather than a single breakout move.`,
    leadEvent
      ? `The latest institutional event flow is being shaped by ${leadEvent.title}.`
      : leadLoser
      ? `${getFriendlyAssetName(leadLoser.symbol, leadLoser.name)} is the clearest weak spot at ${formatPercent(leadLoser.changePercent)}.`
      : `Event flow is light, so signal quality depends more on market breadth and follow-through than fresh headlines.`,
  ];

  const keyInsights = [
    `Backdrop: ${inputs.regimeContext}.`,
    leadDiscovery
      ? `Freshest opportunity: ${getFriendlyAssetName(leadDiscovery.symbol, leadDiscovery.assetName)} surfaced with a DRS of ${Math.round(leadDiscovery.drs)}.`
      : leadGainer
      ? `Strongest upside move: ${getFriendlyAssetName(leadGainer.symbol, leadGainer.name)} is up ${formatPercent(leadGainer.changePercent)}.`
      : `Opportunity leadership is still developing, so the market backdrop matters more than single-name momentum.`,
    leadEvent
      ? `Latest event signal: [${leadEvent.type}/${leadEvent.severity}] ${leadEvent.title}.`
      : `Cross-sector correlation is ${inputs.correlationRegime} at ${inputs.avgCorrelation.toFixed(2)}, which is the clearest structural context available right now.`,
  ].slice(0, 3);

  const risksToWatch = [
    inputs.volatility >= 65
      ? `Volatility is elevated, so conviction should stay measured until price action settles.`
      : `Breadth is only ${Math.round(inputs.breadth)}/100, so leadership still needs broader confirmation.`,
    leadLoser
      ? `${getFriendlyAssetName(leadLoser.symbol, leadLoser.name)} is down ${formatPercent(leadLoser.changePercent)}, which is a sign that weak pockets of the tape can still punish late entries.`
      : `The current setup still needs stronger follow-through before the market earns a more confident read.`,
  ].slice(0, 2);

  return {
    region,
    generatedAt: new Date().toISOString(),
    marketOverview: marketOverviewParts.join(" "),
    keyInsights,
    risksToWatch,
    topMovers: {
      gainers: inputs.topGainers.slice(0, 3).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        change: item.changePercent ?? 0,
      })),
      losers: inputs.topLosers.slice(0, 3).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        change: item.changePercent ?? 0,
      })),
    },
    discoveryHighlight: leadDiscovery ? `${getFriendlyAssetName(leadDiscovery.symbol, leadDiscovery.assetName)}: ${normalizeDiscoveryCopy(leadDiscovery.headline, [{ symbol: leadDiscovery.symbol, name: leadDiscovery.assetName }])}` : null,
    regimeLabel: inputs.regimeLabel,
    regimeSentence: `The market is in a ${inputs.regimeLabel.toLowerCase()} regime, which means investors should judge opportunity quality through breadth, volatility and leadership confirmation before chasing deeper risk.`,
    factorRotationSignal: leadDiscovery
      ? `Fresh signal activity is clustering around ${getFriendlyAssetName(leadDiscovery.symbol, leadDiscovery.assetName)}, which is the clearest rotation clue available right now.`
      : undefined,
    source: "live_fallback",
    debug: buildDebug(inputs),
  };
}

async function collectBriefingInputs(region: string): Promise<BriefingInputs> {
  const [
    regimeRow,
    topGainers,
    topLosers,
    recentEvents,
    discoveryItems,
    marketStats,
  ] = await Promise.all([
    prisma.marketRegime.findFirst({
      where: { region, context: { startsWith: "{" } },
      orderBy: { date: "desc" },
      select: {
        state: true,
        breadthScore: true,
        vixValue: true,
        context: true,
        correlationMetrics: true,
      },
    }),
    prisma.asset.findMany({
      where: { region, changePercent: { gt: 0 }, price: { gt: 0 } },
      orderBy: { changePercent: "desc" },
      take: 5,
      select: { symbol: true, name: true, changePercent: true, type: true },
    }),
    prisma.asset.findMany({
      where: { region, changePercent: { lt: 0 }, price: { gt: 0 } },
      orderBy: { changePercent: "asc" },
      take: 5,
      select: { symbol: true, name: true, changePercent: true, type: true },
    }),
    prisma.institutionalEvent.findMany({
      where: {
        date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        asset: { region },
      },
      orderBy: { date: "desc" },
      take: 10,
      select: { title: true, type: true, severity: true },
    }),
    prisma.discoveryFeedItem.findMany({
      where: { isSuppressed: false, asset: { region } },
      orderBy: { drs: "desc" },
      take: 3,
      select: { symbol: true, assetName: true, headline: true, drs: true },
    }),
    prisma.asset.aggregate({
      where: { region, price: { gt: 0 } },
      _count: true,
      _avg: { changePercent: true },
    }),
  ]);

  const regimeLabel = regimeRow?.state?.toString().replace(/_/g, " ") || "NEUTRAL";
  let parsedContext: Record<string, { label?: string; score?: number }> | null = null;
  if (regimeRow?.context) {
    try {
      parsedContext = JSON.parse(regimeRow.context);
    } catch {
      parsedContext = null;
    }
  }

  const regimeContext = parsedContext
    ? `Regime: ${parsedContext.regime?.label ?? regimeLabel} (score ${parsedContext.regime?.score ?? 50}) | Volatility: ${parsedContext.volatility?.label ?? "NORMAL"} | Risk: ${parsedContext.risk?.label ?? "BALANCED"} | Breadth: ${parsedContext.breadth?.label ?? "MIXED"} | Liquidity: ${parsedContext.liquidity?.label ?? "ADEQUATE"}`
    : `Regime: ${regimeLabel}`;
  const breadth = parsedContext?.breadth?.score ?? regimeRow?.breadthScore ?? 50;
  const volatility = parsedContext?.volatility?.score ?? regimeRow?.vixValue ?? 50;

  const correlationMetrics = regimeRow?.correlationMetrics as Record<string, unknown> | null;
  const crossSector = correlationMetrics?.crossSector as Record<string, unknown> | undefined;

  return {
    regimeLabel,
    regimeContext,
    breadth,
    volatility,
    correlationRegime: (crossSector?.regime as string) || "unknown",
    avgCorrelation: (crossSector?.avgCorrelation as number) || 0,
    totalAssets: marketStats._count,
    avgChange: marketStats._avg.changePercent || 0,
    topGainers,
    topLosers,
    recentEvents,
    discoveryItems,
  };
}

export class DailyBriefingService {
  static async getBriefing(region: string): Promise<DailyBriefing | null> {
    const cached = await getCache<DailyBriefing>(cacheKey(region));
    if (cached) {
      return normalizeBriefingCopy({ ...cached, source: cached.source ?? "cache", debug: cached.debug });
    }

    try {
      const inputs = await collectBriefingInputs(region);
      return normalizeBriefingCopy(buildLiveFallbackBriefing(region, inputs));
    } catch (err) {
      logger.error({ err: sanitizeError(err), region }, "Daily briefing live fallback failed");
      return null;
    }
  }

  static async getBriefingStatus(region: string): Promise<{
    region: string;
    cacheAvailable: boolean;
    briefingSource: DailyBriefing["source"] | "unavailable";
    generatedAt: string | null;
    debug: DailyBriefing["debug"] | null;
  }> {
    const briefing = await this.getBriefing(region);
    return {
      region,
      cacheAvailable: Boolean(await getCache<DailyBriefing>(cacheKey(region))),
      briefingSource: briefing?.source ?? "unavailable",
      generatedAt: briefing?.generatedAt ?? null,
      debug: briefing?.debug ?? null,
    };
  }

  static async generateBriefingForRegion(region: "US" | "IN"): Promise<{
    success: boolean;
    source: DailyBriefing["source"] | null;
    generatedAt: string | null;
  }> {
    try {
      const briefing = await this.generateForRegion(region);
      await setCache(cacheKey(region), briefing, CACHE_TTL);
      logger.info({ region }, "Daily briefing generated and cached");
      return { success: true, source: briefing.source ?? "generated" as DailyBriefing["source"], generatedAt: briefing.generatedAt };
    } catch (err) {
      logger.error({ err: sanitizeError(err), region }, "Daily briefing generation failed");
      return { success: false, source: null as DailyBriefing["source"] | null, generatedAt: null as string | null };
    }
  }

  static async generateBriefings(): Promise<{
    us: { success: boolean; source: DailyBriefing["source"] | null; generatedAt: string | null };
    in: { success: boolean; source: DailyBriefing["source"] | null; generatedAt: string | null };
  }> {
    const [us, india] = await Promise.all([
      this.generateBriefingForRegion("US"),
      this.generateBriefingForRegion("IN"),
    ]);
    return { us, in: india };
  }

  private static async generateForRegion(region: string): Promise<DailyBriefing> {
    const inputs = await collectBriefingInputs(region);

    const gainersText = inputs.topGainers
      .map((g) => `${g.symbol} (${g.name}): +${g.changePercent?.toFixed(2)}%`)
      .join("\n");
    const losersText = inputs.topLosers
      .map((l) => `${l.symbol} (${l.name}): ${l.changePercent?.toFixed(2)}%`)
      .join("\n");

    const eventsText = inputs.recentEvents
      .map((e) => `[${e.type}/${e.severity}] ${e.title}`)
      .join("\n");

    const discoveryText = inputs.discoveryItems
      .map((d) => `${d.symbol} (DRS ${d.drs}): ${d.headline}`)
      .join("\n");

    const prompt = `You are Lyra, an institutional-grade financial intelligence assistant. Generate a concise daily market briefing for the ${region === "IN" ? "Indian (NSE/BSE)" : "US"} market.

${buildHumanizerGuidance("daily market briefing")}

DATA SNAPSHOT:
- Market Regime: ${inputs.regimeLabel}
- Regime Context: ${inputs.regimeContext}
- Breadth: ${inputs.breadth}% | Volatility (VIX proxy): ${inputs.volatility}
- Sector Correlation: ${inputs.correlationRegime} (ρ=${inputs.avgCorrelation.toFixed(2)})
- Universe: ${inputs.totalAssets} assets | Avg Change: ${inputs.avgChange >= 0 ? "+" : ""}${inputs.avgChange.toFixed(2)}%

TOP GAINERS:
${gainersText || "No significant gainers today."}

TOP LOSERS:
${losersText || "No significant losers today."}

INTELLIGENCE EVENTS (last 24h):
${eventsText || "No notable events."}

DISCOVERY HIGHLIGHTS:
${discoveryText || "No discovery items surfaced."}

INSTRUCTIONS:
Return ONLY a JSON object with this exact structure (no markdown, no code fences):
{
  "marketOverview": "2-3 short sentences in plain English. Say what happened, why it matters, and what to watch next.",
  "keyInsights": ["short insight 1", "short insight 2", "short insight 3"],
  "risksToWatch": ["short risk 1", "short risk 2"],
  "discoveryHighlight": "One short sentence about the most interesting discovery item, or null if none.",
  "regimeSentence": "One short sentence explaining the current regime in everyday language."
}

Rules:
- Maximum 3 key insights, 2 risks. Be specific, not generic.
- No financial advice. Focus on WHAT is happening and WHY.
- Plain English. No words like "confluence", "tailwinds", "idiosyncratic".
- Write like a person explaining the market to a smart colleague, not like a report generator.
- Reference specific assets or sectors when possible.`;

    // Apply cost ceiling to prevent runaway context from causing unexpected LLM costs
    const ceilingResult = applyCostCeiling({
      systemPrompt: "",
      context: prompt,
      historyChars: 0,
      userQuery: "Generate daily market briefing",
      plan: "ELITE",
      tier: "COMPLEX",
    });

    if (ceilingResult.exceeded) {
      logger.warn(
        { region, truncatedChars: ceilingResult.truncatedChars, originalEstimate: ceilingResult.estimatedInputTokens, newEstimate: ceilingResult.estimatedInputTokens },
        "Daily briefing cost ceiling exceeded - context truncated"
      );
    }

    // Track latency for the LLM call
    const llmStart = Date.now();
    const result = await generateText({
      model: getGpt54Model("lyra-nano"),
      prompt: ceilingResult.truncatedContext,
    });
    const llmLatencyMs = Date.now() - llmStart;

    // Latency budget: daily briefing is a cron job, budget is 30 seconds
    const LATENCY_BUDGET_MS = 30_000;
    if (llmLatencyMs > LATENCY_BUDGET_MS) {
      recordLatencyViolation(true, llmLatencyMs, "COMPLEX").catch((e) =>
        logger.warn({ err: e }, "Failed to record latency violation")
      );
      logger.warn(
        { region, llmLatencyMs, budget: LATENCY_BUDGET_MS },
        "Daily briefing LLM latency exceeded budget"
      );
    }

    const cleaned = result.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Validate output structure (non-blocking, logs warnings)
    const validationResult = validateOutput(
      cleaned,
      "COMPLEX",
      "ELITE",
      false, // not educational
      "standard",
      "GLOBAL",
    );
    logValidationResult(validationResult);

    const parsed = JSON.parse(cleaned) as {
      marketOverview: string;
      keyInsights: string[];
      risksToWatch: string[];
      discoveryHighlight: string | null;
      regimeSentence: string;
    };

    return {
      region,
      generatedAt: new Date().toISOString(),
      marketOverview: parsed.marketOverview,
      keyInsights: parsed.keyInsights.slice(0, 3),
      risksToWatch: parsed.risksToWatch.slice(0, 2),
      topMovers: {
        gainers: inputs.topGainers.slice(0, 3).map((g) => ({
          symbol: g.symbol,
          name: g.name,
          change: g.changePercent || 0,
        })),
        losers: inputs.topLosers.slice(0, 3).map((l) => ({
          symbol: l.symbol,
          name: l.name,
          change: l.changePercent || 0,
        })),
      },
      discoveryHighlight: parsed.discoveryHighlight,
      regimeLabel: inputs.regimeLabel,
      regimeSentence: parsed.regimeSentence,
      source: "generated",
      debug: buildDebug(inputs),
    };
  }
}
