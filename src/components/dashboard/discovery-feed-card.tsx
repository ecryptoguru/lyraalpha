"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { cn, formatPrice, getCurrencyConfig } from "@/lib/utils";
import { useXPAward } from "@/lib/hooks/use-xp-award";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  AlertTriangle,
  Layers,
  ArrowRight,
  Lock,
  Lightbulb,
  BookOpen,
  ChevronDown,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getOrCreateBeginnerExperimentVariant,
  trackUpgradeCtaEvent,
} from "@/lib/ux/experiment";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { createShareObject } from "@/lib/intelligence-share";
import { cleanAssetText, getFriendlyAssetName } from "@/lib/format-utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiscoveryFeedItem {
  id: string;
  symbol: string;
  displaySymbol?: string;
  name: string;
  type: string;
  drs: number;
  archetype: string;
  headline: string;
  context: string;
  inflections: { scoreType: string; momentum: number; trend: string; percentileRank: number }[] | null;
  isEliteOnly: boolean;
  locked?: boolean;
  computedAt: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  scores: Record<string, number>;
}

// ─── Archetype Config ───────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<string, { label: string; tooltip: string; icon: typeof Activity; color: string; bg: string; border: string }> = {
  score_inflection: {
    label: "Score Changing Fast",
    tooltip: "A key signal just flipped direction — worth investigating",
    icon: Activity,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
  peer_divergence: {
    label: "Moving Differently from Peers",
    tooltip: "This asset is behaving unlike others in its sector",
    icon: BarChart3,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
  regime_sensitive: {
    label: "Sensitive to Market Conditions",
    tooltip: "This asset reacts strongly to the current market environment",
    icon: Layers,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
  },
  sentiment_shift: {
    label: "Buying/Selling Pressure Shift",
    tooltip: "Unusual buying or selling activity detected recently",
    icon: Zap,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
  structural_anomaly: {
    label: "Unusual Market Structure",
    tooltip: "Something structurally unusual is happening with this asset",
    icon: AlertTriangle,
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    border: "border-rose-400/20",
  },
  cross_asset_pattern: {
    label: "Cross-Market Pattern",
    tooltip: "A pattern connecting this asset to broader market moves",
    icon: Layers,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
};

const TYPE_LABELS: Record<string, string> = {
  STOCK: "Stock",
  ETF: "ETF",
  CRYPTO: "Crypto",
  COMMODITY: "Commodity",
  MUTUAL_FUND: "MF",
};

const TYPE_COLORS: Record<string, string> = {
  STOCK: "text-primary bg-primary/10 border-primary/20",
  ETF: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  CRYPTO: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  COMMODITY: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  MUTUAL_FUND: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

const SCORE_LABELS: Record<string, string> = {
  TREND: "Trend",
  MOMENTUM: "Mom",
  VOLATILITY: "Vol",
  SENTIMENT: "Sent",
  LIQUIDITY: "Liq",
  TRUST: "Trust",
};

function getScoreColor(value: number): string {
  if (value >= 70) return "text-emerald-400";
  if (value >= 40) return "text-amber-400";
  return "text-rose-400";
}

function getDRSColor(drs: number): string {
  if (drs >= 70) return "text-emerald-400";
  if (drs >= 40) return "text-amber-400";
  if (drs >= 20) return "text-orange-400";
  return "text-muted-foreground";
}

// ─── Component ──────────────────────────────────────────────────────────────

// ─── Archetype → Learning Module Mapping ────────────────────────────────────

const ARCHETYPE_MODULE_MAP: Record<string, { slug: string; label: string }> = {
  score_inflection: { slug: "score-inflections", label: "Score Inflections" },
  peer_divergence: { slug: "peer-divergence", label: "Peer Divergence" },
  regime_sensitive: { slug: "what-is-market-regime", label: "Market Regimes" },
  sentiment_shift: { slug: "what-is-sentiment", label: "Sentiment" },
  structural_anomaly: { slug: "etf-lookthrough-basics", label: "Structural Analysis" },
  cross_asset_pattern: { slug: "cross-asset-correlation", label: "Cross-Asset Correlation" },
};

const ARCHETYPE_CONTEXT: Record<string, { whySurfaced: string; whatChanged: string; whatItDoesNotMean: string }> = {
  score_inflection: {
    whySurfaced: "One or more engine scores shifted significantly in recent days, crossing a threshold that indicates a meaningful change in the asset's analytical profile.",
    whatChanged: "A key score (trend, momentum, volatility or trust) moved beyond its normal range, suggesting the asset's behavior is evolving.",
    whatItDoesNotMean: "A score shift is not a buy or sell signal. It means the analytical landscape changed — the direction and implications require further analysis.",
  },
  peer_divergence: {
    whySurfaced: "This asset is behaving differently from others in its sector or asset class, which can indicate emerging opportunity or hidden risk.",
    whatChanged: "While peers moved in one direction, this asset diverged — its scores or price action broke from the group pattern.",
    whatItDoesNotMean: "Divergence from peers is not inherently good or bad. It could signal early leadership or a developing problem. Context matters.",
  },
  regime_sensitive: {
    whySurfaced: "The current market regime makes this asset particularly relevant — its characteristics align (or conflict) strongly with prevailing conditions.",
    whatChanged: "The market regime shifted, and this asset's regime compatibility score changed meaningfully as a result.",
    whatItDoesNotMean: "Regime sensitivity is about how an asset behaves in different environments, not a prediction of future regime changes.",
  },
  sentiment_shift: {
    whySurfaced: "Unusual evidence or news activity was detected around this asset, shifting its sentiment profile.",
    whatChanged: "The volume or tone of market commentary, news or analyst activity changed significantly.",
    whatItDoesNotMean: "Sentiment shifts reflect what people are saying, not what will happen. High sentiment can precede both rallies and reversals.",
  },
  structural_anomaly: {
    whySurfaced: "Something changed in the asset's underlying structure — ETF concentration, MF style drift or crypto on-chain metrics shifted.",
    whatChanged: "A structural metric (holdings concentration, factor exposure, on-chain activity) moved beyond its normal range.",
    whatItDoesNotMean: "Structural changes are descriptive observations about composition, not judgments about quality or future performance.",
  },
  cross_asset_pattern: {
    whySurfaced: "A pattern was detected across multiple asset classes that involves this asset, suggesting broader macro dynamics at play.",
    whatChanged: "Cross-asset correlations shifted, revealing a connection between this asset and movements in other markets.",
    whatItDoesNotMean: "Cross-asset patterns are historical observations. Correlations can break down, especially during regime transitions.",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function DiscoveryFeedCard({ item }: { item: DiscoveryFeedItem }) {
  const archConfig = ARCHETYPE_CONFIG[item.archetype] || ARCHETYPE_CONFIG.score_inflection;
  const ArchIcon = archConfig.icon;
  const typeColor = TYPE_COLORS[item.type] || "";
  const isPositive = (item.changePercent ?? 0) >= 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
  const [learnWhyOpen, setLearnWhyOpen] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [experimentVariant] = useState<"control" | "treatment">(() => {
    if (typeof window === "undefined") return "control";
    return getOrCreateBeginnerExperimentVariant();
  });
  const hasTrackedLockedImpression = useRef(false);
  const [successfulActionsCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.localStorage.getItem("ux:successful-actions:v1");
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.from(new Set(parsed)).length;
    } catch {
      return 0;
    }
  });
  const { awardXP } = useXPAward();

  const ctaSource = "discovery_locked_card";

  // Pulse animation for recent signals (within 12 hours)
  const [isRecent] = React.useState(() => {
    if (!item.computedAt) return false;
    try {
      const diffStr = Date.now() - new Date(item.computedAt).getTime();
      return diffStr < 12 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  const handleLearnWhy = useCallback(() => {
    const opening = !learnWhyOpen;
    setLearnWhyOpen(opening);
    if (opening && !xpAwarded) {
      setXpAwarded(true);
      awardXP({
        action: "discovery_explore",
        context: `Explored: ${item.symbol} — ${archConfig.label}`,
      });
    }
  }, [learnWhyOpen, xpAwarded, awardXP, item.symbol, archConfig.label]);

  useEffect(() => {
    if (!item.locked || hasTrackedLockedImpression.current) return;

    trackUpgradeCtaEvent({
      source: ctaSource,
      eventType: "impression",
      actionCount: successfulActionsCount,
      variant: experimentVariant,
    });
    hasTrackedLockedImpression.current = true;
  }, [item.locked, ctaSource, successfulActionsCount, experimentVariant]);

  // Locked Elite-only items: show blurred card with upgrade CTA
  if (item.locked) {
    const isStrongCtaUnlocked = successfulActionsCount >= 2;

    return (
      <div
        data-testid="discovery-locked-card"
        className="group relative rounded-2xl border border-primary/20 bg-card/20 backdrop-blur-2xl overflow-hidden"
      >
        <div className={cn("absolute top-0 left-0 w-full h-0.5 opacity-30", archConfig.color.replace("text-", "bg-"))} />
        <div className="p-4 md:p-5 space-y-3 blur-[3px] select-none pointer-events-none opacity-70">
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-2xl border text-[8px] font-bold uppercase tracking-widest", archConfig.bg, archConfig.border, archConfig.color)}>
              <ArchIcon className="h-2.5 w-2.5" />
              {archConfig.label}
            </div>
            <div className={cn("px-1.5 py-0.5 rounded-xl border text-[7px] font-bold uppercase tracking-widest", typeColor)}>
              {TYPE_LABELS[item.type] || item.type}
            </div>
          </div>
          <div className="h-4 w-3/4 bg-muted/30 rounded" />
          <div className="h-3 w-1/2 bg-muted/20 rounded" />
          <div className="flex gap-1.5">
            {[1,2,3].map(i => <div key={i} className="h-5 w-14 bg-muted/20 rounded-xl" />)}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          {isStrongCtaUnlocked ? (
            <Link
              href="/dashboard/upgrade"
              data-testid="discovery-locked-upgrade-cta"
              onClick={() => {
                trackUpgradeCtaEvent({
                  source: ctaSource,
                  eventType: "click",
                  actionCount: successfulActionsCount,
                  variant: experimentVariant,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 group/cta"
            >
              <Lock className="h-3 w-3" />
              <span>Unlock Cross-Asset Patterns</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover/cta:translate-x-0.5" />
            </Link>
          ) : (
            <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Soft Hint</p>
              <p className="mt-1 text-[11px] font-semibold text-primary/85">Complete 2 successful actions first ({successfulActionsCount}/2)</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const assetRefs = [{ symbol: item.symbol, name: item.name }];
  const displayHeadline = cleanAssetText(item.headline, assetRefs);
  const displayContext = cleanAssetText(item.context, assetRefs);
  const discoveryShare = createShareObject({
    kind: "discovery",
    eyebrow: "Multibagger radar",
    title: `${getFriendlyAssetName(item.symbol, item.name)} surfaced on the radar`,
    takeaway: displayHeadline,
    context: `Why it matters: ${displayContext}`,
    scoreLabel: "Radar",
    scoreValue: `${item.drs}`,
    href: `/dashboard/assets/${item.symbol}`,
    ctaLabel: "Share",
  });

  return (
    <div
      data-testid="discovery-feed-card"
      className="group relative rounded-2xl border border-white/5 bg-background/50 dark:bg-card/60 backdrop-blur-2xl shadow-xl overflow-hidden hover:border-primary/40 transition-all duration-500 hover:shadow-[0_0_30px_rgba(251,191,36,0.1)]"
    >
      {/* Top accent line */}
      <div className={cn("absolute top-0 left-0 w-full h-1 opacity-60 bg-linear-to-r from-transparent via-primary/50 to-transparent", archConfig.color.replace("text-", "from-"))} />

      <div className="p-4 md:p-5 space-y-3">
        {/* Row 1: Badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Archetype badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-2xl border text-[8px] font-bold uppercase tracking-widest cursor-help", archConfig.bg, archConfig.border, archConfig.color)}>
                  <ArchIcon className="h-2.5 w-2.5" />
                  {archConfig.label}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                {archConfig.tooltip}
              </TooltipContent>
            </Tooltip>
            {/* Asset type badge */}
            <div className={cn("px-1.5 py-0.5 rounded-xl border text-[7px] font-bold uppercase tracking-widest", typeColor)}>
              {TYPE_LABELS[item.type] || item.type}
            </div>
            {/* Recent Pulse Animation */}
            {isRecent && (
              <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                </div>
                <span className="text-[7px] font-bold text-primary uppercase tracking-widest">Fresh</span>
              </div>
            )}
            {/* Elite lock */}
            {item.isEliteOnly && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-xl border border-primary/30 bg-primary/10 text-[7px] font-bold text-primary uppercase tracking-widest">
                <Lock className="h-2 w-2" />
                Elite
              </div>
            )}
          </div>
          {/* DRS score */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("text-sm font-bold font-mono cursor-help inline-flex items-center gap-1", getDRSColor(item.drs))}>
                {item.drs}
                <Info className="h-2.5 w-2.5 opacity-70" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              Discovery Relevance Score (0-100). Higher DRS means this item may deserve a closer look. It is a priority cue, not a trade instruction.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Row 2: Headline */}
        <div>
          <h3 className="text-sm font-bold tracking-tight leading-snug group-hover:text-primary transition-colors line-clamp-2 pr-12 relative flex justify-between items-start gap-2">
            <span>{displayHeadline}</span>
            <div className="shrink-0 pt-0.5">
               <MiniSparkline isPositive={isPositive} seed={item.id || item.symbol} />
            </div>
          </h3>
        </div>

        {/* Row 3: Context */}
        <p className="text-[11px] text-muted-foreground/90 dark:text-muted-foreground/70 leading-relaxed line-clamp-2">
          {displayContext}
        </p>

        <p className="text-[10px] text-muted-foreground/90 dark:text-muted-foreground/75 border-l-2 border-primary/25 pl-2">
          Beginner meaning: this card highlights a notable change so you can decide whether to investigate the asset deeper.
        </p>

        {/* Row 4: Score pills */}
        {Object.keys(item.scores).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(item.scores)
              .filter(([key]) => SCORE_LABELS[key])
              .slice(0, 6)
              .map(([key, value]) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-xl border border-border/30 bg-muted/20 cursor-help"
                    >
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">
                        {SCORE_LABELS[key]}
                      </span>
                      <span className={cn("text-[9px] font-bold font-mono", getScoreColor(value))}>
                        {value}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    {SCORE_LABELS[key]} score for this asset. Use this as a context signal, not a standalone trade decision.
                  </TooltipContent>
                </Tooltip>
              ))}
          </div>
        )}

        {/* Row 5: Price + Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/20">
          <div className="flex items-center gap-3">
            {item.price != null && (
              <span className="text-xs font-bold font-mono tracking-tight">
                {formatPrice(item.price, getCurrencyConfig(item.currency || "USD"))}
              </span>
            )}
            {item.changePercent != null && (
              <div className={cn("flex items-center gap-0.5 text-[10px] font-bold", isPositive ? "text-emerald-400" : "text-rose-400")}>
                <ChangeIcon className="h-2.5 w-2.5" />
                {isPositive ? "+" : ""}{item.changePercent.toFixed(2)}%
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLearnWhy}
              className={cn(
                "flex min-h-[38px] items-center gap-1 text-[10px] font-bold transition-colors uppercase tracking-widest",
                learnWhyOpen ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
            >
              <Lightbulb className="h-3 w-3" />
              Learn Why
              <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", learnWhyOpen && "rotate-180")} />
            </button>
            <Link
              href={`/dashboard/assets/${item.symbol}`}
              className="flex min-h-[38px] items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest group/link"
            >
              View Asset
              <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" />
            </Link>
            <ShareInsightButton share={discoveryShare} label="Share" className="min-h-[38px] px-0 py-0 text-[10px] font-bold text-muted-foreground hover:text-primary border-0 bg-transparent shadow-none uppercase tracking-widest" />
          </div>
        </div>

        {/* Learn Why Expandable Section */}
        {learnWhyOpen && (
          <LearnWhySection archetype={item.archetype} />
        )}
      </div>
    </div>
  );
}

// ─── Learn Why Section ──────────────────────────────────────────────────────

function LearnWhySection({ archetype }: { archetype: string }) {
  const ctx = ARCHETYPE_CONTEXT[archetype] || ARCHETYPE_CONTEXT.score_inflection;
  const moduleLink = ARCHETYPE_MODULE_MAP[archetype];

  return (
    <div className="mt-1 pt-3 border-t border-border/20 space-y-3 animate-slide-up-fade">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Why This Surfaced</span>
            <p className="text-[11px] text-muted-foreground dark:text-muted-foreground/80 leading-relaxed mt-0.5">{ctx.whySurfaced}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Activity className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">What Changed</span>
            <p className="text-[11px] text-muted-foreground dark:text-muted-foreground/80 leading-relaxed mt-0.5">{ctx.whatChanged}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-3 w-3 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">What This Does NOT Mean</span>
            <p className="text-[11px] text-muted-foreground dark:text-muted-foreground/80 leading-relaxed mt-0.5">{ctx.whatItDoesNotMean}</p>
          </div>
        </div>
      </div>
      {moduleLink && (
        <Link
          href={`/dashboard/learning/${moduleLink.slug}`}
          className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline uppercase tracking-widest pt-1"
        >
          <BookOpen className="h-3 w-3" />
          Learn: {moduleLink.label}
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      )}
    </div>
  );
}

// ─── MiniSparkline Component ────────────────────────────────────────────────

function MiniSparkline({ isPositive, seed }: { isPositive: boolean; seed: string }) {
  const gradientId = React.useId();
  const pts = React.useMemo(() => {
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = (state * 31 + seed.charCodeAt(i)) >>> 0;
    }

    const next = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967295;
    };

    let current = 20;
    const points = [current];
    for (let i = 0; i < 15; i++) {
      current += (next() - (isPositive ? 0.3 : 0.7)) * 5;
      points.push(current);
    }
    return points;
  }, [isPositive, seed]);

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;

  const coordinates = pts.map((p, i) => {
    const x = Number(((i / 15) * 40).toFixed(2));
    const y = Number((20 - ((p - min) / range) * 20).toFixed(2));
    return { x, y };
  });
  const colorStr = isPositive ? "rgb(52 211 153)" : "rgb(251 113 133)";

  if (coordinates.length < 2) return null;

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L 40,20 L 0,20 Z`;

  return (
    <svg width="40" height="20" viewBox="0 0 40 20" className="opacity-80">
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
        opacity="0.2"
      />
      <path
        d={linePath}
        fill="none"
        stroke={colorStr}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorStr} stopOpacity="1" />
          <stop offset="100%" stopColor={colorStr} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
