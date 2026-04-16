const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export type IntelligenceShareKind =
  | "asset"
  | "portfolio"
  | "discovery"
  | "narrative"
  | "shock"
  | "weekly_report"
  | "compare"
  | "reward"
  | "referral"
  | "generic";

export type IntelligenceShareMode = "insight" | "achievement" | "invite";

export interface IntelligenceShareVariant {
  href: string;
  shareText: string;
  clipboardText: string;
  xText: string;
  linkedInText: string;
  redditTitle: string;
  xUrl: string;
  linkedInUrl: string;
  redditUrl: string;
}

export interface IntelligenceShareObject extends IntelligenceShareVariant {
  kind: IntelligenceShareKind;
  mode: IntelligenceShareMode;
  title: string;
  eyebrow: string;
  takeaway: string;
  context: string;
  scoreLabel?: string;
  scoreValue?: string;
  imageUrl: string;
  ctaLabel?: string;
  invite?: IntelligenceShareVariant;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildXShareUrl(text: string, url: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text, url }).toString()}`;
}

function buildLinkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url }).toString()}`;
}

function buildRedditShareUrl(title: string, url: string): string {
  return `https://www.reddit.com/submit?${new URLSearchParams({ title, url }).toString()}`;
}

function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

const KIND_META: Record<IntelligenceShareKind, {
  xEmoji: string;
  xHashtags: string;
  linkedInHook: string;
  linkedInHashtags: string;
  redditPrefix: string;
}> = {
  shock: {
    xEmoji: "🔴",
    xHashtags: "#PortfolioRisk #StressTest #LyraAlpha",
    linkedInHook: "Most investors find out their portfolio was fragile after the crash. I ran a simulation before it happened.",
    linkedInHashtags: "#RiskManagement #PortfolioStrategy #MarketIntelligence #LyraAlpha",
    redditPrefix: "Stress-tested my portfolio",
  },
  narrative: {
    xEmoji: "📖",
    xHashtags: "#MarketNarrative #MacroView #LyraAlpha",
    linkedInHook: "The narrative driving this market just shifted. Here's what changed and why it matters right now.",
    linkedInHashtags: "#MarketAnalysis #MacroStrategy #Investing #LyraAlpha",
    redditPrefix: "Market narrative shift",
  },
  compare: {
    xEmoji: "⚖️",
    xHashtags: "#AssetComparison #CryptoAnalysis #LyraAlpha",
    linkedInHook: "Side-by-side analysis of two assets most people treat interchangeably — the gap is bigger than you think.",
    linkedInHashtags: "#InvestmentResearch #AssetAllocation #CryptoStrategy #LyraAlpha",
    redditPrefix: "Compared two assets",
  },
  reward: {
    xEmoji: "🏆",
    xHashtags: "#LyraAlpha #Milestone",
    linkedInHook: "Consistency compounds. Hit another milestone today on LyraAlpha.",
    linkedInHashtags: "#Milestone #FinancialEducation #LyraAlpha",
    redditPrefix: "Just hit a milestone",
  },
  referral: {
    xEmoji: "🚀",
    xHashtags: "#LyraAlpha #FinTech",
    linkedInHook: "I've been using this tool to cut through market noise. Worth sharing.",
    linkedInHashtags: "#FinTech #MarketIntelligence #LyraAlpha",
    redditPrefix: "Tool I've been using for market context",
  },
  portfolio: {
    xEmoji: "📊",
    xHashtags: "#PortfolioAnalysis #RiskManagement #LyraAlpha",
    linkedInHook: "Ran an AI-powered portfolio check. The signals were more useful than I expected.",
    linkedInHashtags: "#Portfolio #RiskManagement #InvestmentStrategy #LyraAlpha",
    redditPrefix: "Portfolio intelligence report",
  },
  asset: {
    xEmoji: "🔍",
    xHashtags: "#CryptoResearch #AssetAnalysis #LyraAlpha",
    linkedInHook: "Deep-diving an asset most people underestimate. The setup is more interesting than the price action shows.",
    linkedInHashtags: "#CryptoAnalysis #AssetResearch #TradingInsights #LyraAlpha",
    redditPrefix: "Asset setup check",
  },
  discovery: {
    xEmoji: "🌐",
    xHashtags: "#MarketDiscovery #Altcoins #LyraAlpha",
    linkedInHook: "Surfacing signals before they become obvious. This is what early-stage market intelligence looks like.",
    linkedInHashtags: "#MarketOpportunity #EarlySignals #InvestmentResearch #LyraAlpha",
    redditPrefix: "Discovery signal",
  },
  weekly_report: {
    xEmoji: "📅",
    xHashtags: "#WeeklyMarkets #MarketSummary #LyraAlpha",
    linkedInHook: "What moved this week, why it moved, and where to look next — condensed into one AI-powered weekly read.",
    linkedInHashtags: "#WeeklyMarkets #MacroAnalysis #InvestmentStrategy #LyraAlpha",
    redditPrefix: "Weekly market intelligence",
  },
  generic: {
    xEmoji: "💡",
    xHashtags: "#MarketIntelligence #LyraAlpha",
    linkedInHook: "Cutting through the noise with AI-powered market intelligence.",
    linkedInHashtags: "#MarketIntelligence #FinTech #LyraAlpha",
    redditPrefix: "LyraAlpha insight",
  },
};

function buildXText(input: {
  kind: IntelligenceShareKind;
  eyebrow: string;
  title: string;
  takeaway: string;
  scoreLabel?: string;
  scoreValue?: string;
}): string {
  const meta = KIND_META[input.kind] ?? KIND_META.generic;
  const scorePart = input.scoreLabel && input.scoreValue
    ? ` ${input.scoreLabel}: ${input.scoreValue}.`
    : "";
  const raw = `${meta.xEmoji} ${input.takeaway}${scorePart}\n\n${meta.xHashtags}`;
  return clampText(normalizeText(raw.replace(/\n/g, " ")), 240);
}

function buildLinkedInText(input: {
  kind: IntelligenceShareKind;
  title: string;
  takeaway: string;
  context: string;
  scoreLabel?: string;
  scoreValue?: string;
}): string {
  const meta = KIND_META[input.kind] ?? KIND_META.generic;
  const scorePart = input.scoreLabel && input.scoreValue
    ? `\n\n${input.scoreLabel}: ${input.scoreValue}`
    : "";
  return normalizeText(
    [
      meta.linkedInHook,
      "",
      `${input.title}`,
      "",
      input.takeaway,
      input.context ? `\n${input.context}` : "",
      scorePart,
      "",
      meta.linkedInHashtags,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n"),
  );
}

function buildRedditTitle(input: {
  kind: IntelligenceShareKind;
  title: string;
  takeaway: string;
}): string {
  const meta = KIND_META[input.kind] ?? KIND_META.generic;
  const candidate = `[${meta.redditPrefix}] ${input.title}`;
  return clampText(normalizeText(candidate), 300);
}

function buildShareVariant(input: {
  kind: IntelligenceShareKind;
  title: string;
  eyebrow: string;
  takeaway: string;
  context: string;
  href: string;
  scoreLabel?: string;
  scoreValue?: string;
  clipboardText?: string;
  imageUrl?: string;
}): IntelligenceShareVariant {
  const xText = buildXText(input);
  const linkedInText = buildLinkedInText(input);
  const redditTitle = buildRedditTitle(input);

  const shareText = normalizeText([xText, input.href].join(" "));
  const clipboardText = input.clipboardText
    ? normalizeText(input.clipboardText)
    : normalizeText(
        [
          input.title,
          input.takeaway,
          input.context,
          input.scoreLabel && input.scoreValue ? `${input.scoreLabel}: ${input.scoreValue}` : "",
          input.href,
          input.imageUrl ? `Share card: ${input.imageUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );

  return {
    href: input.href,
    shareText,
    clipboardText,
    xText,
    linkedInText,
    redditTitle,
    xUrl: buildXShareUrl(xText, input.href),
    linkedInUrl: buildLinkedInShareUrl(input.href),
    redditUrl: buildRedditShareUrl(redditTitle, input.href),
  };
}

export function buildShareCardUrl(share: {
  title: string;
  takeaway: string;
  context: string;
  eyebrow?: string;
  scoreLabel?: string;
  scoreValue?: string;
}): string {
  const params = new URLSearchParams({
    title: share.title,
    takeaway: share.takeaway,
    context: share.context,
    ...(share.eyebrow ? { eyebrow: share.eyebrow } : {}),
    ...(share.scoreLabel ? { scoreLabel: share.scoreLabel } : {}),
    ...(share.scoreValue ? { scoreValue: share.scoreValue } : {}),
  });

  return toAbsoluteUrl(`/api/share/card?${params.toString()}`);
}

export function createShareObject(input: {
  kind: IntelligenceShareKind;
  title: string;
  eyebrow: string;
  takeaway: string;
  context: string;
  href: string;
  mode?: IntelligenceShareMode;
  scoreLabel?: string;
  scoreValue?: string;
  ctaLabel?: string;
  inviteHref?: string;
  inviteEyebrow?: string;
  inviteTakeaway?: string;
  inviteContext?: string;
  inviteClipboardText?: string;
}): IntelligenceShareObject {
  const href = toAbsoluteUrl(input.href);
  const imageUrl = buildShareCardUrl({
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    eyebrow: input.eyebrow,
    scoreLabel: input.scoreLabel,
    scoreValue: input.scoreValue,
  });
  const primaryVariant = buildShareVariant({
    kind: input.kind,
    title: input.title,
    eyebrow: input.eyebrow,
    takeaway: input.takeaway,
    context: input.context,
    href,
    scoreLabel: input.scoreLabel,
    scoreValue: input.scoreValue,
    imageUrl,
  });
  const invite = input.inviteHref
    ? buildShareVariant({
        kind: input.kind,
        title: input.title,
        eyebrow: input.inviteEyebrow ?? input.eyebrow,
        takeaway: input.inviteTakeaway ?? input.takeaway,
        context: input.inviteContext ?? input.context,
        href: toAbsoluteUrl(input.inviteHref),
        scoreLabel: input.scoreLabel,
        scoreValue: input.scoreValue,
        clipboardText: input.inviteClipboardText,
        imageUrl,
      })
    : undefined;

  return {
    kind: input.kind,
    mode: input.mode ?? "insight",
    title: input.title,
    eyebrow: input.eyebrow,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: input.scoreLabel,
    scoreValue: input.scoreValue,
    imageUrl,
    ctaLabel: input.ctaLabel,
    invite,
    ...primaryVariant,
  };
}

/**
 * Simple wrapper for callers that only have a free-text snippet and
 * want a ready-to-share object with sensible defaults.
 */
export function createTextShareObject(input: {
  title?: string;
  text: string;
  url?: string;
  clipboardText?: string;
  label?: string;
}): IntelligenceShareObject {
  const title = input.title ?? "LyraAlpha update";
  const takeaway = input.text;

  return createShareObject({
    kind: "generic",
    mode: "insight",
    eyebrow: "LyraAlpha AI",
    title,
    takeaway,
    context: input.clipboardText ?? input.text,
    href: input.url ?? "/dashboard",
    ctaLabel: input.label,
  });
}

export function buildAssetShareObject(input: {
  assetName: string;
  href: string;
  takeaway: string;
  context: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "asset",
    mode: "insight",
    eyebrow: "Asset intelligence",
    title: `${input.assetName} setup check`,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Read",
    scoreValue: input.scoreValue,
    href: input.href,
    ctaLabel: "Share read",
  });
}

export function buildNarrativeShareObject(input: {
  title: string;
  href: string;
  takeaway: string;
  context: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "narrative",
    mode: "insight",
    eyebrow: "Market narrative",
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Story",
    scoreValue: input.scoreValue,
    href: input.href,
    ctaLabel: "Share narrative",
  });
}

export function buildShockShareObject(input: {
  title: string;
  href: string;
  takeaway: string;
  context: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "shock",
    mode: "insight",
    eyebrow: "Shock simulator",
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Scenario",
    scoreValue: input.scoreValue,
    href: input.href,
    ctaLabel: "Share result",
  });
}

export function buildPortfolioShareObject(input: {
  title: string;
  href: string;
  takeaway: string;
  context: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "portfolio",
    mode: "insight",
    eyebrow: "Portfolio intelligence",
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Portfolio",
    scoreValue: input.scoreValue,
    href: input.href,
    ctaLabel: "Share report",
  });
}

export function buildCompareShareObject(input: {
  title: string;
  href: string;
  takeaway: string;
  context: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "compare",
    mode: "insight",
    eyebrow: "Compare assets",
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Compared",
    scoreValue: input.scoreValue,
    href: input.href,
    ctaLabel: "Share result",
  });
}

export function buildRewardShareObject(input: {
  title: string;
  href: string;
  takeaway: string;
  context: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "reward",
    mode: "achievement",
    eyebrow: "Rewards milestone",
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Level",
    scoreValue: input.scoreValue,
    href: input.href,
    ctaLabel: "Share milestone",
  });
}

export function buildReferralShareObject(input: {
  title: string;
  href: string;
  referralHref: string;
  takeaway: string;
  context: string;
  inviteTakeaway: string;
  inviteContext: string;
  scoreValue?: string;
}) {
  return createShareObject({
    kind: "referral",
    mode: "invite",
    eyebrow: "LyraAlpha referral",
    title: input.title,
    takeaway: input.takeaway,
    context: input.context,
    scoreLabel: "Reward",
    scoreValue: input.scoreValue,
    href: input.href,
    inviteHref: input.referralHref,
    inviteEyebrow: "LyraAlpha invite",
    inviteTakeaway: input.inviteTakeaway,
    inviteContext: input.inviteContext,
    inviteClipboardText: [
      input.title,
      input.inviteTakeaway,
      input.inviteContext,
      toAbsoluteUrl(input.referralHref),
    ].join("\n"),
    ctaLabel: "Invite friends",
  });
}
