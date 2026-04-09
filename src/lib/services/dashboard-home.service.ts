import { prisma } from "@/lib/prisma";
import { withStaleWhileRevalidate } from "@/lib/redis";
import { dashboardHomeShellCacheKey } from "@/lib/cache-keys";
import { DailyBriefingService, type DailyBriefing } from "@/lib/services/daily-briefing.service";
import { PersonalBriefingService, type PersonalBriefingResponse } from "@/lib/services/personal-briefing.service";
import { isElitePlan } from "@/lib/middleware/plan-gate";
import type { PlanTier } from "@/lib/ai/config";
import { buildPortfolioAlertSummary, getPortfolioHealthBand } from "@/lib/portfolio-alerts";
import { createShareObject, type IntelligenceShareObject } from "@/lib/intelligence-share";
import { cleanAssetText, getFriendlyAssetName, getFriendlySymbol } from "@/lib/format-utils";
import { normalizeShareText } from "@/lib/engines/portfolio-utils";

const DASHBOARD_HOME_SHELL_TTL_SECONDS = 90;
const DASHBOARD_HOME_SHELL_STALE_SECONDS = 5 * 60;

export interface DashboardPortfolioPreview {
  id: string;
  name: string;
  holdingCount: number;
  healthScore: number | null;
  healthBand: "Strong" | "Balanced" | "Fragile" | "High Risk" | null;
  portfolioScore: number | null;
  portfolioScoreBand: string | null;
  alertHeadline: string | null;
  alertBody: string | null;
  missingInsight: string | null;
  stressHeadline: string | null;
  stressBody: string | null;
  shareText: string | null;
  share: IntelligenceShareObject | null;
  updatedAt: string;
  emptyReason?: "no_portfolio" | "no_health_snapshot";
  guidanceTitle?: string | null;
  guidanceBody?: string | null;
}

export interface DashboardDiscoveryPreviewItem {
  id: string;
  symbol: string;
  name: string;
  type: string;
  archetype: string;
  headline: string;
  whySurfaced: string;
  driversLabel: string;
  radarScore: number | null;
  newToday: boolean;
  shareText: string;
  share: IntelligenceShareObject;
  changePercent: number | null;
  computedAt: string;
  locked: boolean;
}

export interface DashboardNarrativePreview {
  title: string;
  summary: string;
  signal: string | null;
  strengthLabel: string;
  shareText: string;
  share: IntelligenceShareObject;
  divergences: Array<{ symbol: string; label: string; direction: string; score: number }>;
}

export interface DashboardInsightFeedItem {
  id: string;
  type: "portfolio" | "opportunity" | "narrative" | "risk";
  badge: string;
  title: string;
  summary: string;
  href: string;
  tone: "positive" | "warning" | "neutral";
  shareText: string;
  share: IntelligenceShareObject;
  priority: number;
}

export interface DashboardWeeklyReportPreview {
  headline: string;
  summary: string;
  topOpportunity: string | null;
  biggestRisk: string | null;
  topNarrative: string | null;
  href: string;
  share: IntelligenceShareObject;
}

export interface DashboardHomeData {
  generatedAt: string;
  region: string;
  plan: PlanTier;
  dailyBriefing: DailyBriefing | null;
  personalBriefing: PersonalBriefingResponse | null;
  portfolioPreview: DashboardPortfolioPreview | null;
  discoveryPreview: DashboardDiscoveryPreviewItem[];
  narrativePreview: DashboardNarrativePreview | null;
  weeklyReport: DashboardWeeklyReportPreview | null;
  insightFeed: DashboardInsightFeedItem[];
}

export type DashboardHomeShellData = Omit<DashboardHomeData, "personalBriefing" | "weeklyReport">;

function getDiscoveryWhySurfaced(archetype: string): string {
  switch (archetype) {
    case "score_inflection":
      return "A key score changed quickly enough to deserve a fresh look.";
    case "peer_divergence":
      return "This asset is moving differently from peers, which can signal emerging leadership or hidden risk.";
    case "regime_sensitive":
      return "The current market backdrop makes this asset more relevant than usual.";
    case "sentiment_shift":
      return "News flow or sentiment changed enough to alter the setup.";
    case "structural_anomaly":
      return "A structural metric changed in a way that may matter more than price alone.";
    case "cross_asset_pattern":
      return "A broader cross-market pattern is starting to involve this asset.";
    default:
      return "This asset surfaced because something important changed in its signal profile.";
  }
}

function getDiscoveryDriversLabel(archetype: string): string {
  switch (archetype) {
    case "score_inflection":
      return "Drivers: score momentum";
    case "peer_divergence":
      return "Drivers: peer divergence";
    case "regime_sensitive":
      return "Drivers: market regime fit";
    case "sentiment_shift":
      return "Drivers: sentiment shift";
    case "structural_anomaly":
      return "Drivers: structure change";
    case "cross_asset_pattern":
      return "Drivers: cross-market pattern";
    default:
      return "Drivers: signal change";
  }
}

function isRecentOpportunity(computedAt: Date): boolean {
  return Date.now() - computedAt.getTime() <= 24 * 60 * 60 * 1000;
}

function buildShareText(parts: string[]): string {
  return normalizeShareText(parts.filter(Boolean).join(" "));
}

function normalizeHeadlineText(text: string, assets: Array<{ symbol: string; name?: string }> = []): string {
  return cleanAssetText(text.trim(), assets)
    .replace(/\bTrend\b/g, "trend")
    .replace(/\bMomentum\b/g, "momentum")
    .replace(/\bCrypto peers\b/g, "crypto peers");
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.\s]+$/, "");
}

function normalizeBriefingForDashboard(
  briefing: DailyBriefing | null,
  discoveryPreview: DashboardDiscoveryPreviewItem[],
): DailyBriefing | null {
  if (!briefing) return null;

  const discoveryLead = discoveryPreview[0] ?? null;
  const parsedHighlight = briefing.discoveryHighlight?.match(/^([^:]+):\s*(.+)$/);
  const rawLabel = parsedHighlight ? parsedHighlight[1].trim() : null;
  const assetRefs: Array<{ symbol: string; name?: string }> = rawLabel ? [{ symbol: rawLabel, name: rawLabel }] : [];
  const normalizedDetail = parsedHighlight ? normalizeHeadlineText(parsedHighlight[2], assetRefs) : null;
  const normalizedLabel = discoveryLead?.name
    ?? (rawLabel ? getFriendlyAssetName(rawLabel, rawLabel) : null);
  const discoverySentence = normalizedLabel && normalizedDetail
    ? `${normalizedLabel} is the clearest fresh signal on the radar right now. ${ensureSentence(normalizedDetail)}`
    : null;

  const statsSentence = briefing.marketOverview.match(/^.*?tracked names\./)?.[0] ?? null;
  const trailingSentence = briefing.marketOverview.match(/(The latest institutional event flow is being shaped by .*\.|Event flow is light, so signal quality depends more on market breadth and follow-through than fresh headlines\.|[^.]+ is the clearest weak spot at [^.]*\.)$/)?.[0] ?? null;
  const marketOverview = discoverySentence && statsSentence
    ? [statsSentence, discoverySentence, trailingSentence].filter(Boolean).join(" ")
    : briefing.marketOverview;

  return {
    ...briefing,
    marketOverview,
    discoveryHighlight: normalizedLabel && normalizedDetail ? `${normalizedLabel}: ${normalizedDetail}` : briefing.discoveryHighlight,
    factorRotationSignal: normalizedLabel
      ? `Fresh signal activity is clustering around ${normalizedLabel}, which is the clearest rotation clue available right now.`
      : briefing.factorRotationSignal,
  };
}

function normalizeNarrativePreviewTitle(regimeLabel: string): string {
  return `${regimeLabel} is setting the market tone`;
}

function normalizeNarrativePreviewSummary(dailyBriefing: DailyBriefing): string {
  const regimeSentence = dailyBriefing.regimeSentence?.trim();
  if (regimeSentence) return regimeSentence;

  return `${dailyBriefing.regimeLabel} is the clearest market story right now and this is the backdrop shaping cross-asset behavior.`;
}

function normalizeNarrativePreviewSignal(dailyBriefing: DailyBriefing): string | null {
  if (dailyBriefing.factorRotationSignal?.trim()) return dailyBriefing.factorRotationSignal.trim();
  if (dailyBriefing.discoveryHighlight?.trim()) return dailyBriefing.discoveryHighlight.trim();
  return null;
}

function getNarrativeStrengthLabel(dailyBriefing: DailyBriefing): string {
  if (dailyBriefing.factorRotationSignal?.trim()) return "Accelerating";
  if ((dailyBriefing.narrativeDivergences ?? []).length >= 3) return "Strengthening";
  if (dailyBriefing.source === "live_fallback") return "Building";
  return "In focus";
}

async function getPortfolioPreview(userId: string, region: string): Promise<DashboardPortfolioPreview | null> {
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, region },
    include: {
      _count: { select: { holdings: true } },
      healthSnapshots: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          healthScore: true,
          concentrationScore: true,
          correlationScore: true,
          fragilityScore: true,
          riskMetrics: true,
          date: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!portfolio) {
    return {
      id: "empty",
      name: "Portfolio setup",
      holdingCount: 0,
      healthScore: null,
      healthBand: null,
      portfolioScore: null,
      portfolioScoreBand: null,
      alertHeadline: null,
      alertBody: null,
      missingInsight: "Create a portfolio and add a few holdings to unlock a daily risk read, concentration checks and faster stress prompts.",
      stressHeadline: null,
      stressBody: null,
      shareText: null,
      share: null,
      updatedAt: new Date().toISOString(),
      emptyReason: "no_portfolio",
      guidanceTitle: "Start with your real holdings",
      guidanceBody: "Add 3–5 positions first so the dashboard can show health, fragility and exposure instead of a generic placeholder.",
    };
  }

  const latestSnapshot = portfolio.healthSnapshots[0] ?? null;
  const alerts = buildPortfolioAlertSummary(latestSnapshot);

  return {
    id: portfolio.id,
    name: portfolio.name,
    holdingCount: portfolio._count.holdings,
    healthScore: latestSnapshot?.healthScore ?? null,
    healthBand: getPortfolioHealthBand(latestSnapshot?.healthScore ?? null),
    portfolioScore: alerts?.portfolioScore ?? null,
    portfolioScoreBand: alerts?.portfolioScoreBand ?? null,
    alertHeadline: alerts?.headline ?? null,
    alertBody: alerts?.body ?? null,
    missingInsight: alerts?.missingInsight ?? null,
    stressHeadline: alerts?.stressHeadline ?? null,
    stressBody: alerts?.stressBody ?? null,
    shareText: alerts?.shareText ?? null,
    share: alerts?.headline && alerts?.body
      ? createShareObject({
          kind: "portfolio",
          eyebrow: "Portfolio intelligence",
          title: alerts.headline,
          takeaway: alerts.body,
          context: alerts.missingInsight ?? alerts.stressBody ?? `Portfolio health score: ${latestSnapshot?.healthScore != null ? Math.round(latestSnapshot.healthScore) : "Awaiting read"}.`,
          scoreLabel: "Portfolio",
          scoreValue: alerts.portfolioScore != null ? `${alerts.portfolioScore.toFixed(1)} / 10` : portfolio.name,
          href: "/dashboard/portfolio",
          ctaLabel: "Share",
        })
      : null,
    updatedAt: latestSnapshot?.date?.toISOString?.() ?? portfolio.updatedAt.toISOString(),
    emptyReason: latestSnapshot ? undefined : "no_health_snapshot",
    guidanceTitle: latestSnapshot ? null : "Generate your first portfolio health read",
    guidanceBody: latestSnapshot ? null : "Your holdings are saved, but the dashboard still needs a fresh health snapshot before it can rank concentration and fragility.",
  };
}

function scoreDiscoveryCandidate(item: {
  archetype: string;
  drs: number;
  computedAt: Date;
  changePercent: number | null;
  isEliteOnly: boolean;
}): number {
  const freshnessBonus = isRecentOpportunity(item.computedAt) ? 12 : 0;
  const movementBonus = Math.min(Math.abs(item.changePercent ?? 0), 12);
  const archetypeBonus = item.archetype === "regime_sensitive"
    ? 8
    : item.archetype === "peer_divergence"
    ? 6
    : item.archetype === "score_inflection"
    ? 5
    : 3;
  const accessibilityPenalty = item.isEliteOnly ? 4 : 0;
  return item.drs + freshnessBonus + movementBonus + archetypeBonus - accessibilityPenalty;
}

function selectDiversifiedDiscoveryItems<T extends {
  id: string;
  archetype: string;
  assetType: string;
  computedAt: Date;
  drs: number;
  changePercent: number | null;
  isEliteOnly: boolean;
}>(items: T[], count: number): T[] {
  const sorted = [...items].sort((a, b) => scoreDiscoveryCandidate(b) - scoreDiscoveryCandidate(a));
  const selected: T[] = [];
  const seenArchetypes = new Set<string>();
  const seenTypes = new Set<string>();

  for (const item of sorted) {
    const shouldDiversify = !seenArchetypes.has(item.archetype) || !seenTypes.has(item.assetType);
    if (shouldDiversify || selected.length + (sorted.length - sorted.indexOf(item)) <= count) {
      selected.push(item);
      seenArchetypes.add(item.archetype);
      seenTypes.add(item.assetType);
    }
    if (selected.length === count) break;
  }

  if (selected.length < count) {
    for (const item of sorted) {
      if (!selected.some((entry) => entry.id === item.id)) {
        selected.push(item);
      }
      if (selected.length === count) break;
    }
  }

  return selected;
}

async function getDiscoveryPreview(region: string, plan: PlanTier): Promise<DashboardDiscoveryPreviewItem[]> {
  const where = {
    isSuppressed: false,
    asset: { region },
  };

  const items = await prisma.discoveryFeedItem.findMany({
    where,
    orderBy: [{ drs: "desc" }, { computedAt: "desc" }],
    take: 12,
    select: {
      id: true,
      symbol: true,
      assetName: true,
      assetType: true,
      archetype: true,
      headline: true,
      drs: true,
      changePercent: true,
      computedAt: true,
      isEliteOnly: true,
    },
  });

  return selectDiversifiedDiscoveryItems(items, 3).map((item) => {
    const locked = item.isEliteOnly && !isElitePlan(plan);
    const whySurfaced = getDiscoveryWhySurfaced(item.archetype);
    const driversLabel = getDiscoveryDriversLabel(item.archetype);
    const newToday = isRecentOpportunity(item.computedAt);
    const symbol = locked ? "???" : item.symbol;
    const name = locked ? "Elite Discovery" : getFriendlySymbol(item.symbol, item.assetType, item.assetName);
    const headline = locked ? "Unlock Elite to view this higher-conviction signal." : normalizeHeadlineText(item.headline);
    const shareLabel = newToday ? "New today" : "On radar";

    const shareText = buildShareText([
      `${shareLabel}: ${name} on Multibagger Radar.`,
      headline,
      whySurfaced,
    ]);

    return {
      id: item.id,
      symbol,
      name,
      type: item.assetType,
      archetype: item.archetype,
      headline,
      whySurfaced,
      driversLabel,
      radarScore: locked ? null : item.drs,
      newToday,
      shareText,
      share: createShareObject({
        kind: "discovery",
        eyebrow: "Multibagger radar",
        title: `${name} is on the radar`,
        takeaway: headline,
        context: `${whySurfaced} ${driversLabel}.`,
        scoreLabel: locked ? "Access" : "Radar",
        scoreValue: locked ? "Elite" : item.drs.toString(),
        href: "/dashboard/discovery",
        ctaLabel: "Share",
      }),
      changePercent: locked ? null : item.changePercent,
      computedAt: item.computedAt.toISOString(),
      locked,
    };
  });
}

function buildNarrativePreview(dailyBriefing: DailyBriefing | null): DashboardNarrativePreview | null {
  if (!dailyBriefing) return null;

  const divergences = dailyBriefing.narrativeDivergences ?? [];

  const title = normalizeNarrativePreviewTitle(dailyBriefing.regimeLabel);
  const summary = normalizeNarrativePreviewSummary(dailyBriefing);
  const signal = normalizeNarrativePreviewSignal(dailyBriefing);
  const shareText = buildShareText([
    `Narrative tracker: ${title}.`,
    summary,
    signal ?? "",
  ]);

  return {
    title,
    summary,
    signal,
    strengthLabel: getNarrativeStrengthLabel(dailyBriefing),
    shareText,
    share: createShareObject({
      kind: "narrative",
      eyebrow: "Narrative tracker",
      title,
      takeaway: summary,
      context: signal ?? "Track whether this market story is gaining confirmation or starting to fade.",
      scoreLabel: "Strength",
      scoreValue: getNarrativeStrengthLabel(dailyBriefing),
      href: "/dashboard#market-intelligence",
      ctaLabel: "Share",
    }),
    divergences: divergences.slice(0, 3).map((item) => ({
      ...item,
      label: getFriendlyAssetName(item.symbol),
    })),
  };
}

function getOpportunityTone(item: DashboardDiscoveryPreviewItem): DashboardInsightFeedItem["tone"] {
  if (item.radarScore != null && item.radarScore >= 75) return "positive";
  if ((item.changePercent ?? 0) <= -6) return "warning";
  return "neutral";
}

function buildInsightFeed(args: {
  portfolioPreview: DashboardPortfolioPreview | null;
  discoveryPreview: DashboardDiscoveryPreviewItem[];
  dailyBriefing: DailyBriefing | null;
}): DashboardInsightFeedItem[] {
  const items: DashboardInsightFeedItem[] = [];

  if (args.portfolioPreview?.alertHeadline && args.portfolioPreview.alertBody) {
    items.push({
      id: "portfolio-alert",
      type: "portfolio",
      badge: "Portfolio insight",
      title: args.portfolioPreview.alertHeadline,
      summary: args.portfolioPreview.missingInsight
        ? `${args.portfolioPreview.alertBody} ${args.portfolioPreview.missingInsight}`
        : args.portfolioPreview.alertBody,
      href: "/dashboard/portfolio",
      tone: args.portfolioPreview.healthBand === "High Risk" || args.portfolioPreview.healthBand === "Fragile" ? "warning" : "neutral",
      shareText: args.portfolioPreview.shareText ?? buildShareText([args.portfolioPreview.alertHeadline, args.portfolioPreview.alertBody]),
      share: args.portfolioPreview.share ?? createShareObject({
        kind: "portfolio",
        eyebrow: "Portfolio insight",
        title: args.portfolioPreview.alertHeadline,
        takeaway: args.portfolioPreview.alertBody,
        context: args.portfolioPreview.missingInsight ?? args.portfolioPreview.stressBody ?? "Portfolio risk deserves a fresh read.",
        href: "/dashboard/portfolio",
        ctaLabel: "Share",
      }),
      priority: args.portfolioPreview.healthBand === "High Risk"
        ? 94
        : args.portfolioPreview.healthBand === "Fragile"
        ? 86
        : 65,
    });
  }

  for (const item of args.discoveryPreview.slice(0, 2)) {
    items.push({
      id: `opportunity-${item.id}`,
      type: "opportunity",
      badge: item.newToday ? "New today" : "Opportunity",
      title: `${item.name} is on the radar`,
      summary: `${ensureSentence(item.headline)} ${item.whySurfaced} ${item.driversLabel}.`,
      href: "/dashboard/discovery",
      tone: getOpportunityTone(item),
      shareText: item.shareText,
      share: item.share,
      priority: (item.radarScore ?? 55) + (item.newToday ? 10 : 0),
    });
  }

  const riskToWatch = args.dailyBriefing?.risksToWatch?.[0]?.trim();
  if (riskToWatch) {
    items.push({
      id: "market-risk",
      type: "risk",
      badge: "Risk alert",
      title: "A market risk deserves attention",
      summary: riskToWatch,
      href: "/dashboard/stress-test",
      tone: "warning",
      shareText: buildShareText([`Market risk alert: ${riskToWatch}`]),
      share: createShareObject({
        kind: "shock",
        eyebrow: "Market risk alert",
        title: "A market risk deserves attention",
        takeaway: riskToWatch,
        context: "Run Shock Simulator to see how this risk could hit your holdings under stress.",
        href: "/dashboard/stress-test",
        ctaLabel: "Share",
      }),
      priority: 92,
    });
  }

  return items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);
}

export function buildWeeklyReportPreview(args: {
  dailyBriefing: DailyBriefing | null;
  portfolioPreview: DashboardPortfolioPreview | null;
  discoveryPreview: DashboardDiscoveryPreviewItem[];
  narrativePreview: DashboardNarrativePreview | null;
}): DashboardWeeklyReportPreview | null {
  const topOpportunity = args.discoveryPreview[0]
    ? `${args.discoveryPreview[0].name} — ${stripTrailingPunctuation(args.discoveryPreview[0].headline)}`
    : null;
  const biggestRisk = args.portfolioPreview?.alertHeadline ?? args.dailyBriefing?.risksToWatch?.[0] ?? null;
  const topNarrative = args.narrativePreview?.title ?? null;

  if (!topOpportunity && !biggestRisk && !topNarrative && !args.dailyBriefing?.marketOverview) {
    return null;
  }

  const headline = topNarrative
    ?? args.dailyBriefing?.marketOverview?.split(".")[0]?.trim()
    ?? "Your weekly intelligence report is ready";
  const summary = [
    biggestRisk ? `Biggest risk: ${stripTrailingPunctuation(biggestRisk)}.` : "No major portfolio risk surfaced this week.",
    topOpportunity ? `Top opportunity: ${stripTrailingPunctuation(topOpportunity)}.` : "No standout opportunity surfaced this week.",
    topNarrative ? `Market story: ${stripTrailingPunctuation(topNarrative)}.` : "No dominant narrative change was detected this week.",
  ].join(" ");
  const href = "/dashboard?view=weekly-report";

  return {
    headline,
    summary,
    topOpportunity,
    biggestRisk,
    topNarrative,
    href,
    share: createShareObject({
      kind: "weekly_report",
      eyebrow: "Weekly intelligence report",
      title: headline,
      takeaway: biggestRisk ?? "A balanced week across risk and opportunity.",
      context: [topOpportunity, topNarrative].filter(Boolean).join(" ") || summary,
      scoreLabel: "Week",
      scoreValue: "Ready",
      href,
    }),
  };
}

export function buildWeeklyReportFallback(): DashboardWeeklyReportPreview {
  const href = "/dashboard?view=weekly-report";

  return {
    headline: "Your weekly intelligence report is ready",
    summary: "No major portfolio risk, opportunity or narrative change was detected this week.",
    topOpportunity: null,
    biggestRisk: null,
    topNarrative: null,
    href,
    share: createShareObject({
      kind: "weekly_report",
      eyebrow: "Weekly intelligence report",
      title: "Your weekly intelligence report is ready",
      takeaway: "No major portfolio risk, opportunity or narrative change was detected this week.",
      context: "No major portfolio risk, opportunity or narrative change was detected this week.",
      scoreLabel: "Week",
      scoreValue: "Ready",
      href,
    }),
  };
}

function normalizeDashboardHomeShell(data: DashboardHomeShellData): DashboardHomeShellData {
  const normalizedBriefing = normalizeBriefingForDashboard(data.dailyBriefing, data.discoveryPreview);
  const narrativePreview = buildNarrativePreview(normalizedBriefing);

  return {
    ...data,
    dailyBriefing: normalizedBriefing,
    narrativePreview,
    insightFeed: buildInsightFeed({
      portfolioPreview: data.portfolioPreview,
      discoveryPreview: data.discoveryPreview,
      dailyBriefing: normalizedBriefing,
    }),
  };
}

async function buildDashboardHomeShell(userId: string, region: string, plan: PlanTier): Promise<DashboardHomeShellData> {
  const [dailyBriefing, portfolioPreview, discoveryPreview] = await Promise.all([
    DailyBriefingService.getBriefing(region),
    getPortfolioPreview(userId, region),
    getDiscoveryPreview(region, plan),
  ]);
  const normalizedBriefing = normalizeBriefingForDashboard(dailyBriefing, discoveryPreview);
  const narrativePreview = buildNarrativePreview(normalizedBriefing);

  return {
    generatedAt: new Date().toISOString(),
    region,
    plan,
    dailyBriefing: normalizedBriefing,
    portfolioPreview,
    discoveryPreview,
    narrativePreview,
    insightFeed: buildInsightFeed({
      portfolioPreview,
      discoveryPreview,
      dailyBriefing: normalizedBriefing,
    }),
  };
}

export class DashboardHomeService {
  static async getShell(userId: string, region: string, plan: PlanTier): Promise<DashboardHomeShellData> {
    const result = await withStaleWhileRevalidate({
      key: dashboardHomeShellCacheKey(userId, region, plan),
      ttlSeconds: DASHBOARD_HOME_SHELL_TTL_SECONDS,
      staleSeconds: DASHBOARD_HOME_SHELL_STALE_SECONDS,
      fetcher: () => buildDashboardHomeShell(userId, region, plan),
    });

    if (!result) {
      return buildDashboardHomeShell(userId, region, plan);
    }

    return normalizeDashboardHomeShell(result);
  }

  static async getHome(userId: string, region: string, plan: PlanTier): Promise<DashboardHomeData> {
    const [shell, personalBriefing] = await Promise.all([
      this.getShell(userId, region, plan),
      isElitePlan(plan) ? PersonalBriefingService.getBriefing(userId) : Promise.resolve(null),
    ]);
    const weeklyReport = buildWeeklyReportPreview({
      dailyBriefing: shell.dailyBriefing,
      portfolioPreview: shell.portfolioPreview,
      discoveryPreview: shell.discoveryPreview,
      narrativePreview: shell.narrativePreview,
    });

    return {
      ...shell,
      personalBriefing,
      weeklyReport,
    };
  }
}
