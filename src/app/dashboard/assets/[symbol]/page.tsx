"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScoreBadge } from "@/components/analytics/score-badge";
import { ExplainSheet } from "@/components/analytics/explain-sheet";
import { IntelligenceLoader } from "@/components/ui/intelligence-loader";
import { LyraInsightSheet } from "@/components/lyra/lyra-insight-sheet";
import { InstitutionalTimeline } from "@/components/analytics/institutional-timeline";
import { ScoreDynamicsCard } from "@/components/ui/ScoreDynamicsCard";
import { PerformanceMatrix } from "@/components/analytics/performance-matrix";
import { EventImpactBadge } from "@/components/ui/EventImpactBadge";
import { RegimeBadge } from "@/components/ui/RegimeBadge";
import { SameSectorMovers } from "@/components/dashboard/same-sector-movers";
import dynamic from "next/dynamic";
import { AssetAnalyticsResponse, ScoreDynamics, EventImpact } from "@/types/analytics";
import { cn, computeRangePositionPercent, formatCompactNumber, formatPrice, getCurrencyConfig, resolveAnalyticsSyncError } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";
import { BackButton } from "@/components/ui/back-button";
import {
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  Waves,
  Zap,
  Info,
  Crown,
  GitCompare,
  Sparkles,
} from "lucide-react";
import { ScoreHistorySparkline } from "@/components/analytics/score-history-sparkline";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { OHLCV, ExplanationData } from "@/lib/engines/types";
import { motion } from "framer-motion";
import { usePlan } from "@/hooks/use-plan";
import { WatchlistStar } from "@/components/dashboard/watchlist-star";
import { EliteGate } from "@/components/dashboard/elite-gate";
import { HistoricalAnalogCard } from "@/components/analytics/historical-analog-card";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { SystemBridge } from "@/components/dashboard/system-bridge";
import {
  AssetAnalytics,
  buildAssetPageDerivedState,
  buildComprehensiveThesisPrompt,
  mergeAnalyticsWithData,
  hasVisibleValue,
} from "./asset-page-helpers";
import {
  AssetCryptoDiagnosticsSection,
  AssetCryptoProfileSection,
} from "./asset-page-render-sections";
import { AssetPageSectionHeader } from "./asset-page-section-header";

/** Format rating labels like STRONG_BUY → "Strong Buy", BULLISH → "Bullish" for display */
function formatRatingDisplay(rating: string | null | undefined): string {
  if (!rating) return "—";
  const map: Record<string, string> = {
    STRONG_BUY: "Strong Buy",
    BUY: "Buy",
    NEUTRAL: "Neutral",
    SELL: "Sell",
    STRONG_SELL: "Strong Sell",
    BULLISH: "Bullish",
    BEARISH: "Bearish",
  };
  return map[rating] || rating.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
} as const;
const staggerItem = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

const FIRST_VALUE_ACTION_KEY = "ux:first-value-action:v1";
const SUCCESS_ACTIONS_KEY = "ux:successful-actions:v1";

const MAP_RANGE: Record<string, string> = {
  "1D": "1d",
  "1W": "5d",
  "1M": "1mo",
  "3M": "3mo",
  "1Y": "1y",
};

const PriceChart = dynamic(
  () =>
    import("@/components/analytics/price-chart").then((mod) => mod.PriceChartMemo),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] sm:h-[400px] md:h-[500px] flex flex-col items-center justify-center gap-4 bg-muted/5 rounded-3xl border border-border/30 dark:border-white/5 overflow-hidden relative">
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary/5 to-transparent bg-size-[200%_100%] animate-shimmer" />
        <div className="p-4 rounded-full bg-primary/10 relative z-10 animate-pulse">
          <Activity className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] relative z-10">
          Syncing Market Data
        </p>
      </div>
    ),
  },
);

const FactorProfile = dynamic(
  () => import("@/components/analytics/factor-profile").then((mod) => mod.FactorProfile),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 overflow-hidden">
        <div className="h-full w-full bg-linear-to-r from-transparent via-muted/30 to-transparent bg-size-[200%_100%] animate-shimmer" />
      </div>
    ),
  },
);

const CorrelationMatrix = dynamic(
  () => import("@/components/analytics/correlation-matrix").then((mod) => mod.CorrelationMatrix),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 overflow-hidden">
        <div className="h-full w-full bg-linear-to-r from-transparent via-muted/30 to-transparent bg-size-[200%_100%] animate-shimmer" />
      </div>
    ),
  },
);

const SignalStrengthCard = dynamic(
  () => import("@/components/analytics/signal-strength-card").then((mod) => mod.SignalStrengthCard),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 overflow-hidden">
        <div className="h-full w-full bg-linear-to-r from-transparent via-muted/30 to-transparent bg-size-[200%_100%] animate-shimmer" />
      </div>
    ),
  },
);

export default function AssetPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { plan } = usePlan();
  const resolvedParams = React.use(params);
  const { symbol: encodedSymbol } = resolvedParams;
  const symbol = decodeURIComponent(encodedSymbol);
  const [activeRange, setActiveRange] = useState("1y");
  const [isLyraSheetOpen, setIsLyraSheetOpen] = useState(false);
  const [lyraSheetQuery, setLyraSheetQuery] = useState<{ query: string; displayQuery: string } | null>(null);
  const [data, setData] = useState<OHLCV[]>([]);
  const [analytics, setAnalytics] = useState<AssetAnalytics | null>(null);
  const [marketContext, setMarketContext] =
    useState<MarketContextSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<Record<string, { date: string; value: number }[]>>({});
  const isElite = plan === "ELITE" || plan === "ENTERPRISE";
  // Track initial load — avoids putting `analytics`/`isLoading` in effect deps
  const hasLoadedRef = React.useRef(false);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(FIRST_VALUE_ACTION_KEY);
      if (!existing) {
        window.localStorage.setItem(FIRST_VALUE_ACTION_KEY, "analysis_view");
      }

      const rawActions = window.localStorage.getItem(SUCCESS_ACTIONS_KEY);
      const parsed = rawActions ? (JSON.parse(rawActions) as string[]) : [];
      const next = Array.from(new Set([...parsed, "analysis_view"]));
      window.localStorage.setItem(SUCCESS_ACTIONS_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage write errors
    }
  }, [symbol]);

  // Institutional synchronization cycle
  // IMPORTANT: `analytics` and `isLoading` are intentionally excluded from deps.
  // Including them caused an infinite loop: fetch → setAnalytics → re-run effect → fetch again.
  // We use a ref (`hasLoadedRef`) to differentiate initial load from range changes.
  useEffect(() => {
    const controller = new AbortController();
    hasLoadedRef.current = false;
    setIsLoading(true);
    setError(null);
    setAnalytics(null);
    setMarketContext(null);
    setData([]);

    async function synchronizeIntelligence() {
      const apiRange = MAP_RANGE[activeRange.toUpperCase()] || "1y";
      
      // 1. Fetch History independently (High Priority for UI)
      const fetchHistory = async () => {
        try {
          setIsChartLoading(true);
          const res = await fetch(`/api/stocks/history?symbol=${encodeURIComponent(symbol)}&range=${apiRange}`, {
            signal: controller.signal,
          });
          if (!res.ok) {
            setData([]);
            return;
          }
          const history = await res.json();
          setData(history);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return;
          setData([]);
        } finally {
          setIsChartLoading(false);
        }
      };

      // 2. Fetch Analytics independently (Institutional Intelligence)
      const fetchAnalytics = async () => {
        try {
          const res = await fetch(`/api/stocks/${encodeURIComponent(symbol.trim())}/analytics`, {
            signal: controller.signal,
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || "Analytics engine offline.");
          }
          const analyticsData = await res.json();
          
          setMarketContext(analyticsData.marketContext);
          setAnalytics({
            ...analyticsData,
            price: analyticsData.price || 0,
            change: (analyticsData.price || 0) * ((analyticsData.changePercent || 0) / 100),
            currency: analyticsData.currency || "USD",
            signalStrength: analyticsData.signalStrength || null,
          });
          setError(null);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return;
          setError((prev) => resolveAnalyticsSyncError(prev, hasLoadedRef.current, err));
        }
      };

      if (!hasLoadedRef.current) {
        // Initial load — fetch both in parallel, then reveal UI
        await Promise.allSettled([fetchHistory(), fetchAnalytics()]);
        hasLoadedRef.current = true;
        setIsLoading(false);
      } else {
        // Range change only — analytics already loaded, just refresh chart
        await fetchHistory();
      }
    }

    synchronizeIntelligence();
    return () => controller.abort();
  }, [symbol, activeRange]);

  // Fetch score history for Elite users — only once per symbol after initial analytics load
  // `analytics` is excluded from deps intentionally (it would re-run on every analytics update)
  useEffect(() => {
    if (!isElite) return;
    const controller = new AbortController();
    let cancelled = false;
    // Small delay to let analytics settle before firing
    const timer = setTimeout(() => {
      fetch(`/api/stocks/${encodeURIComponent(symbol.trim())}/score-history?days=90`, { signal: controller.signal })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!cancelled && d?.history) setScoreHistory(d.history);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          console.warn("Score history fetch failed:", e);
        });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [symbol, isElite]);

  const analyticsComputed: AssetAnalytics = useMemo(
    () => mergeAnalyticsWithData(analytics, data),
    [analytics, data],
  );

  const currencyConfig = useMemo(() => {
    return getCurrencyConfig(analyticsComputed.currency);
  }, [analyticsComputed.currency]);

  const currencySymbol = currencyConfig.symbol;
  const currencyRegion = currencyConfig.region;

  const friendlySymbol = useMemo(
    () => getFriendlySymbol(symbol, analytics?.type, analytics?.name),
    [symbol, analytics?.type, analytics?.name],
  );

  const {
    signals,
    compatibility,
    grouping,
    factorData,
    correlationData,
    events,
    performance,
  } = analyticsComputed;
  const derivedState = useMemo(
    () => buildAssetPageDerivedState({
      analytics,
      analyticsComputed,
      data,
      marketContext,
      symbol,
    }),
    [analytics, analyticsComputed, data, marketContext, symbol],
  );

  const {
    summaryTone,
    regimeLabel,
    riskLabel,
    plainEnglishLine,
    beginnerHeadline,
    beginnerRiskLine,
    beginnerActionLine,
    keyDrivers,
    keyRisks,
    summaryCards,
    assetShare,
    hasMeaningfulSignalStrength,
    hasMeaningfulPerformanceSection,
    latestPrice,
    changePercent,
    isUp,
    headerDayRange,
    cgMeta,
  } = derivedState;

  const dayRangePosition = useMemo(
    () => headerDayRange ? computeRangePositionPercent(latestPrice, headerDayRange.low, headerDayRange.high) : 0,
    [headerDayRange, latestPrice],
  );

  const cryptoMatrix = useMemo(() => {
    const meta = analyticsComputed.metadata as Record<string, unknown> | null;
    const messari = meta?.messari as Record<string, unknown> | undefined;
    const mktCap = analyticsComputed.technicalMetrics?.marketCap;
    const vol24h = meta?.volume24Hr as number | undefined;
    const circSupply = meta?.circulatingSupply as number | undefined;
    const maxSupply = meta?.maxSupply as number | undefined;
    const volToMcap = vol24h != null && mktCap && Number(mktCap) !== 0
      ? `${((vol24h / Number(mktCap)) * 100).toFixed(2)}%`
      : "—";
    const supplyMined = circSupply != null && maxSupply != null && Number(maxSupply) > 0
      ? `${((Number(circSupply) / Number(maxSupply)) * 100).toFixed(1)}%`
      : null;
    return { meta, messari, mktCap, vol24h, circSupply, maxSupply, volToMcap, supplyMined };
  }, [analyticsComputed.metadata, analyticsComputed.technicalMetrics?.marketCap]);

  const [explainData, setExplainData] = useState<ExplanationData | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);


  const handleExplain = (
    title: string,
    score: number,
    definition: string,
    context: string,
  ) => {
    setExplainData({
      title,
      score,
      definition,
      drivers: [context],
      context,
      limitations:
        "Score based on deterministic cross-asset signals within the current market regime.",
    });
    setIsExplainOpen(true);
  };

  const buildComprehensiveThesisPromptCallback = useCallback(
    () => buildComprehensiveThesisPrompt(analyticsComputed, symbol),
    [analyticsComputed, symbol],
  );

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-6 bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl rounded-3xl mx-6">
        <AlertTriangle className="h-12 w-12 text-destructive opacity-30" />
        <div className="text-center space-y-2">
          <p className="text-xl font-bold tracking-tight">
            Intelligence Sync Failure
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {error}
          </p>
        </div>
        <Link href="/dashboard/assets">
          <Button
            variant="outline"
            className="mt-4 border-border hover:surface-elevated"
          >
            Return to Terminal
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading && !analytics) {
    return (
      <IntelligenceLoader
        message="Loading Asset"
        subtext="Crunching the numbers..."
      />
    );
  }

  return (
    <TooltipProvider>
    <div className="relative space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-6 overflow-x-hidden min-w-0 w-full max-w-[100vw] will-change-composite p-3 sm:p-4 md:p-6">
      {/* Background Decorative Labels */}
      <div className="absolute -top-10 -right-20 text-[12vw] font-bold text-primary/5 select-none pointer-events-none tracking-tighter z-0 hidden lg:block uppercase">
        {friendlySymbol} INTEL
      </div>

      <div className="relative z-10 rounded-4xl border border-white/10 bg-card/70 backdrop-blur-2xl shadow-xl p-5 sm:p-6 md:p-7 mt-2">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-3 md:min-w-0 md:flex-1">
            <BackButton className="bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-all rounded-2xl h-9 w-9 shrink-0 mt-1" />

            <div className="flex flex-col gap-3 min-w-0 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary w-fit">
                <Sparkles className="h-3 w-3" />
                Asset intelligence
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-foreground leading-none uppercase truncate">
                  {friendlySymbol}
                </h1>
                <div className="hover:bg-primary/10 hover:text-primary p-1 rounded-full transition-colors cursor-pointer shrink-0">
                  <WatchlistStar symbol={symbol} size="md" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="px-2 py-0.5 rounded-md bg-muted/40 border border-border/30 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  {analytics?.type || "ASSET"}
                </div>
                {!!(analyticsComputed.sector) && (
                  <div className="px-2 py-0.5 rounded-md bg-primary/5 border border-primary/15 text-[9px] font-bold text-primary/80 uppercase tracking-widest">
                    {analyticsComputed.sector}
                  </div>
                )}
                {grouping?.group && (
                  <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest">
                    {grouping.group}
                  </div>
                )}
              </div>

              <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
                Start with the clearest read on the setup, then pressure-test the drivers, risks and market backdrop before you spend time in the deeper analytics below.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:items-end xl:shrink-0">
            <motion.div
              key="price"
              initial={{ opacity: 0.5, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-[2.8rem] sm:text-[3.4rem] font-bold tracking-tighter leading-none text-foreground"
            >
              {formatPrice(latestPrice, { symbol: currencySymbol, region: currencyRegion })}
            </motion.div>

            <div className="flex items-center gap-3 flex-wrap xl:justify-end">
              <div
                className={cn(
                  "flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full border",
                  isUp
                    ? "text-success bg-success/10 border-success/20"
                    : "text-danger bg-danger/10 border-danger/20",
                )}
              >
                {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {isUp ? "+" : ""}{changePercent.toFixed(2)}%
                <span className="opacity-50 text-[9px] uppercase tracking-wide ml-0.5">Today</span>
              </div>

              {headerDayRange && (
                <div className="flex items-center gap-2 shrink-0 bg-background/40 px-2.5 py-1 rounded-full border border-border/30">
                  <span className="text-[9px] font-bold text-muted-foreground/75 uppercase tracking-wider hidden sm:inline">Day</span>
                  <span className="text-[10px] font-mono font-bold text-foreground/80">{formatPrice(headerDayRange.low, { symbol: currencySymbol, region: currencyRegion, decimals: 0 })}</span>
                  <div className="h-1.5 w-16 sm:w-20 bg-muted/60 rounded-full relative overflow-hidden">
                    <div
                      className="absolute h-full bg-linear-to-r from-primary/50 to-primary rounded-full transition-all duration-1000"
                      style={{ left: "0%", width: `${dayRangePosition}%` }}
                    />
                    <div
                      className="absolute w-2 h-2 bg-white rounded-full top-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(var(--primary),0.5)] border border-primary/20 transition-all duration-1000"
                      style={{ left: `calc(${dayRangePosition}% - 4px)` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-foreground/80">{formatPrice(headerDayRange.high, { symbol: currencySymbol, region: currencyRegion, decimals: 0 })}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap xl:justify-end">
              {[
                { label: "Regime", value: regimeLabel },
                { label: "Vol", value: marketContext?.volatility.label ?? "WAITING" },
                { label: "Risk", value: riskLabel.replace(/_/g, " ") },
                { label: "Breadth", value: marketContext?.breadth.label ?? "WAITING" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/20 bg-muted/20 whitespace-nowrap">
                  <span className="text-[9px] font-bold text-muted-foreground/70 dark:text-muted-foreground/50 uppercase tracking-wider">{label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-tight text-foreground/80">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="rounded-3xl border border-primary/20 bg-primary/5 shadow-lg p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Quick read</p>
                <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  What matters most about this setup right now
                </h2>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {summaryTone}
              </div>
            </div>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-foreground/90">
              {beginnerHeadline}
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-3xl border border-white/10 bg-background/50 p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Plain English</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {plainEnglishLine}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background/50 p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Main risk</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {beginnerRiskLine}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background/50 p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">What to do next</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {beginnerActionLine}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="gap-2">
                <Link href={`/dashboard/lyra?q=${encodeURIComponent(`Explain ${friendlySymbol} in plain English`)}`}>
                  Ask Lyra
                  <Sparkles className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/dashboard#market-intelligence">
                  Read narratives
                  <TrendingUp className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/dashboard/stress-test">
                  Stress test this theme
                  <Zap className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <ShareInsightButton share={assetShare} label="Share read" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-background/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{item.value}</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <SystemBridge
          badge="Next actions"
          title="Choose the right follow-through for this setup"
          description="Use the quick read to decide whether this name needs deeper reasoning, broader market context or a side-by-side check before you commit more time below."
          items={[
            {
              eyebrow: "Reasoning path",
              title: `Ask Lyra about ${friendlySymbol}`,
              description: "Open Lyra when you want the setup translated into plain English, scenario logic or a cleaner action frame.",
              href: `/dashboard/lyra?q=${encodeURIComponent(`Explain ${friendlySymbol} in plain English`)}`,
              accent: "gold",
            },
            {
              eyebrow: "Narrative path",
              title: "Read market narratives",
              description: "Check whether this setup is part of a stronger market story, rotation or regime shift before acting.",
              href: "/dashboard#market-intelligence",
              accent: "primary",
            },
            {
              eyebrow: "Compare path",
              title: "Compare alternatives",
              description: "Move into Compare when you want to test this asset against another candidate under the same market conditions.",
              href: `/dashboard/compare?symbols=${symbol}`,
              accent: "emerald",
            },
          ]}
        />
      </div>

      <div className="relative z-10 mt-4">
        <SameSectorMovers symbol={symbol} />
      </div>

      <div className="relative z-10 mt-4">
        <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-xl p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Drivers and risks</p>
              <h2 className="text-lg font-bold tracking-tight text-foreground">What is helping this setup and what could break it</h2>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="rounded-3xl border border-success/15 bg-success/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-success">Top drivers</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {keyDrivers.length > 0 ? keyDrivers.map((driver) => (
                  <span key={driver} className="inline-flex rounded-full border border-success/20 bg-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-success">
                    {driver}
                  </span>
                )) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Strong drivers will appear here once the signal-strength model has enough evidence.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-danger/15 bg-danger/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-danger">Top risks</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {keyRisks.length > 0 ? keyRisks.map((risk) => (
                  <span key={risk} className="inline-flex rounded-full border border-danger/20 bg-danger/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-danger">
                    {risk}
                  </span>
                )) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Risk flags will appear here once the model isolates the main failure points for this setup.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      <AssetPageSectionHeader
        className="mt-4 mb-6"
        label="Core Analytics"
        variant="primary"
        watermark="INTELLIGENCE"
      />

      <div className="rounded-3xl border border-white/10 bg-card/50 backdrop-blur-2xl px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <span className="font-bold uppercase tracking-[0.16em] text-primary mr-2">How to use this page:</span>
        Start with the quick read, then check the driver and risk blocks, then scan the core score tiles. Move into charts, factor views and deeper detail only when you need more conviction.
      </div>

      {/* Intelligence Grid: Dimension Scores */}
      {/* Elite badge row */}
      {isElite && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/8 w-fit">
            <Crown className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Elite Mode — 90d Score Trends Active</span>
          </div>
          <Link
            href={`/dashboard/compare?symbols=${symbol}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/30 dark:border-white/5 bg-card/60 hover:border-primary/30 hover:text-primary transition-colors text-muted-foreground"
          >
            <GitCompare className="h-3 w-3" />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Compare</span>
          </Link>
        </div>
      )}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <motion.div variants={staggerItem}>
          <ScoreTile
            label="Backdrop fit"
            score={compatibility?.score || 0}
            color="text-primary"
            icon={<ShieldCheck className="h-4 w-4" />}
            onClick={() =>
              handleExplain(
                "Compatibility",
                compatibility?.score || 0,
                "Alignment with current market regime.",
                compatibility?.explanation[0] || "",
              )
            }
            tooltip="Algorithmic alignment between the current market regime and the asset's historical performance profile."
            confidence={compatibility?.confidence}
          />
          </motion.div>
          <motion.div variants={staggerItem}>
          <ScoreTile
            label="Trend Structure"
            score={signals?.trend || 0}
            sparklineData={scoreHistory.trend}
            onClick={() =>
              handleExplain(
                "Trend",
                signals?.trend || 0,
                "Long-term structural direction.",
                "Analyzing 200D and 50D moving averages.",
              )
            }
            tooltip="Statistical evaluation of directional stability using moving average crossovers and price consolidation patterns."
            confidence="high"
          />
          </motion.div>
          <motion.div variants={staggerItem}>
          <ScoreTile
            label="Momentum Analysis"
            score={signals?.momentum || 0}
            sparklineData={scoreHistory.momentum}
            onClick={() =>
              handleExplain(
                "Momentum",
                signals?.momentum || 0,
                "Rate of change in price action.",
                "Relative Strength Index (RSI) analysis.",
              )
            }
            tooltip="Measures the velocity of price changes vs the broader market to identify potential institutional breakouts."
            confidence="medium"
            change="down"
          />
          </motion.div>
          <motion.div variants={staggerItem}>
          <ScoreTile
            label="Trust score"
            score={signals?.trust || 0}
            sparklineData={scoreHistory.trust}
            onClick={() =>
              handleExplain(
                "Governance",
                signals?.trust || 0,
                "Corporate governance and data reliability.",
                "Institutional integrity and reporting transparency.",
              )
            }
            tooltip="Assessment of corporate transparency and management consistency to quantify underlying operational trust."
            confidence="medium"
          />
          </motion.div>
          <motion.div variants={staggerItem}>
          <ScoreTile
            label="Liquidity"
            score={signals?.liquidity || 0}
            sparklineData={scoreHistory.liquidity}
            onClick={() =>
              handleExplain(
                "Liquidity",
                signals?.liquidity || 0,
                "Ease of execution.",
                "Volume-at-price and daily turnover analysis.",
              )
            }
            tooltip="Audit of order book thickness and daily turnover to ensure the asset can absorb institutional-sized orders."
            confidence="high"
          />
          </motion.div>
          <motion.div variants={staggerItem}>
          <ScoreTile
            label="Volatility"
            score={signals?.volatility || 0}
            sparklineData={scoreHistory.volatility}
            onClick={() =>
              handleExplain(
                "Volatility",
                signals?.volatility || 0,
                "Realized price fluctuation.",
                "Standard deviation and ATR metrics.",
              )
            }
            tooltip="Evaluates realized volatility vs sector benchmarks, quantifying the risk of sudden price deviations."
            confidence="high"
            change="up"
          />
          </motion.div>
        </motion.div>

      <AssetPageSectionHeader
        label="Price context"
        variant="sky"
        watermark="TECHNICALS"
      />

      {/* Main Analysis Area */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Price Analytics */}
          <div className="bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold tracking-tighter">
                  Price context
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                  Multi-timeframe performance
                </p>
              </div>
              <div className="flex gap-1 flex-wrap">
                {[
                  { label: "1D", key: "1D" },
                  { label: "1W", key: "1W" },
                  { label: "1M", key: "1M" },
                  { label: "3M", key: "3M" },
                  { label: "1Y", key: "1Y" },
                ].map((t) => {
                  const roi = analyticsComputed.performance?.returns[t.key as keyof typeof analyticsComputed.performance.returns];
                  return (
                    <Button
                      key={t.key}
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveRange(t.key)}
                      disabled={isChartLoading}
                      className={cn(
                        "h-auto py-2 px-3 flex flex-col items-center gap-1 rounded-2xl transition-all",
                        activeRange.toUpperCase() === t.key
                          ? "bg-primary/20 text-primary border border-primary/20"
                          : "opacity-40 hover:opacity-100 hover:bg-muted",
                      )}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {isChartLoading && activeRange.toUpperCase() === t.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          t.label
                        )}
                      </span>
                      {roi !== undefined && roi !== null && (
                        <span className={cn(
                          "text-[9px] font-bold tracking-tighter",
                          roi >= 0 ? "text-primary" : "text-destructive"
                        )}>
                          {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="h-[420px] min-h-[420px] relative" style={{ contain: "strict" }}>
              {isChartLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/5 backdrop-blur-[1px] rounded-3xl">
                  <Loader2 className="h-8 w-8 text-primary animate-spin opacity-40" />
                </div>
              )}
              <PriceChart
                data={analyticsComputed.data as (OHLCV & { events?: AssetAnalyticsResponse["events"] })[]}
                colors={{ textColor: "rgba(120,120,120,0.5)" }}
                chartType="CANDLESTICK"
              />

              {/* Regime Overlay Indicator */}
              <div className="absolute top-4 left-6 px-3 py-1.5 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/30 dark:border-white/5 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Regime: {regimeLabel.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <AssetCryptoProfileSection
            analyticsComputed={analyticsComputed}
            cgMeta={cgMeta}
          />

          {/* Sync Hub: Technical Metrics */}
          <div className="bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl p-5 rounded-2xl">
            {/* Specialized Asset Data Matrices */}
            <div className="flex items-center gap-3 mb-6">
              <div className={cn(
                "p-2 rounded-2xl border",
                "bg-success/10 border-success/20 text-success"
              )}>
                <Zap className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-bold tracking-tighter uppercase">
                  Crypto Data Matrix
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                  Digital Asset Structural Metrics
                </p>
              </div>
            </div>

            {/* Matrix Selection Logic — crypto-only */}
            {(() => {
              const { meta, messari, mktCap, vol24h, circSupply, maxSupply, volToMcap, supplyMined } = cryptoMatrix;
              return (
                <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <TechnicalMetric label="Market Cap" value={mktCap != null ? formatCompactNumber(mktCap, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Total market value of all circulating coins. Key indicator of project size and adoption." />
                  <TechnicalMetric label="MCap Rank" value={cgMeta?.marketCapRank ? `#${cgMeta.marketCapRank}` : "—"} tooltip="CoinGecko market cap ranking among all cryptocurrencies." />
                  <TechnicalMetric label="24h Volume" value={vol24h != null ? formatCompactNumber(vol24h, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Total trading volume over the last 24 hours across all exchanges." />
                  <TechnicalMetric label="Vol / Mkt Cap" value={volToMcap} tooltip="Volume-to-Market Cap ratio. Higher values indicate more active trading relative to size. >5% is high activity." />
                  <TechnicalMetric label="FDV" value={cgMeta?.fullyDilutedValuation ? formatCompactNumber(cgMeta.fullyDilutedValuation, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Fully Diluted Valuation — market cap if max supply were fully circulating. Indicates potential dilution." />
                  <TechnicalMetric label="Day Range" value={meta?.dayHigh != null && meta?.dayLow != null ? `${formatPrice(meta.dayLow as number, { symbol: currencySymbol, region: currencyRegion, decimals: 2 })} – ${formatPrice(meta.dayHigh as number, { symbol: currencySymbol, region: currencyRegion, decimals: 2 })}` : "—"} tooltip="Today's price range (24h low to high)." />
                  <TechnicalMetric label="Circ. Supply" value={circSupply != null ? formatCompactNumber(circSupply, { isCurrency: false, region: currencyRegion }) : "—"} tooltip="Coins currently circulating in the market and available for trading." />
                  <TechnicalMetric label="Max Supply" value={maxSupply != null ? formatCompactNumber(maxSupply, { isCurrency: false, region: currencyRegion }) : "∞"} tooltip="Maximum coins that will ever exist. ∞ means unlimited supply (inflationary token)." />
                  {supplyMined && (
                    <TechnicalMetric label="Supply Mined" value={supplyMined} tooltip="Percentage of max supply already in circulation. Higher % means less future dilution." />
                  )}
                  <TechnicalMetric label="From 52W High" value={analyticsComputed.technicalMetrics?.distanceFrom52WHigh != null ? `${Number(analyticsComputed.technicalMetrics.distanceFrom52WHigh).toFixed(1)}%` : "—"} tooltip="Distance from 52-week high. Negative means below the high." />
                  <TechnicalMetric label="1Y Return" value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"} tooltip="Total return over the last 1 year." />
                  <TechnicalMetric label="Technical" value={formatRatingDisplay(analyticsComputed.technicalMetrics?.technicalRating)} tooltip="Composite rating from developer activity, community health, and code quality. Derived from CoinGecko on-chain data." />
                  <TechnicalMetric label="Analyst" value={formatRatingDisplay(analyticsComputed.technicalMetrics?.analystRating)} tooltip="Community sentiment rating from CoinGecko vote data. Bullish = majority vote up, Bearish = majority vote down." />
                  {messari?.revenue != null && (
                    <TechnicalMetric label="Protocol Revenue" value={formatCompactNumber(messari.revenue as number, { symbol: currencySymbol, region: currencyRegion })} tooltip="Annualized protocol revenue from Messari research data." />
                  )}
                  {messari?.psRatio != null && (
                    <TechnicalMetric label="P/S Ratio" value={`${(messari.psRatio as number).toFixed(2)}x`} tooltip="Price-to-Sales ratio from Messari. Lower may indicate undervaluation." />
                  )}
                  {messari?.yield != null && (
                    <TechnicalMetric label="Staking Yield" value={`${((messari.yield as number) * 100).toFixed(2)}%`} tooltip="Annual staking yield from Messari. Income earned by participating in network security." />
                  )}
                  {messari?.inflationRate != null && (
                    <TechnicalMetric label="Inflation Rate" value={`${((messari.inflationRate as number) * 100).toFixed(2)}%`} tooltip="Annual token inflation rate from Messari. Higher inflation dilutes existing holders." />
                  )}
                  {meta?.tvl != null && (
                    <TechnicalMetric label="TVL" value={formatCompactNumber(meta.tvl as number, { symbol: currencySymbol, region: currencyRegion })} tooltip="Total Value Locked — capital deposited in DeFi protocols. Key metric for DeFi projects." />
                  )}
                  {meta?.institutionalProxy != null && (
                    <TechnicalMetric label="Inst. Interest" value={`${((meta.institutionalProxy as number) * 100).toFixed(1)}%`} tooltip="Proxy for institutional interest based on watchlist, Reddit, and Telegram engagement." />
                  )}
                </div>

                {(cgMeta?.ath || cgMeta?.atl) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {cgMeta?.ath != null && (
                      <div className="p-4 rounded-2xl bg-success/5 border border-success/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-success uppercase tracking-widest">All-Time High</span>
                          {cgMeta.athDate && (
                            <span className="text-[9px] text-muted-foreground">{new Date(cgMeta.athDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-success">{formatPrice(cgMeta.ath, { symbol: currencySymbol, region: currencyRegion })}</span>
                          {cgMeta.athChangePercentage != null && (
                            <span className={cn("text-sm font-bold", cgMeta.athChangePercentage < 0 ? "text-danger" : "text-success")}>
                              {cgMeta.athChangePercentage > 0 ? "+" : ""}{cgMeta.athChangePercentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {cgMeta?.atl != null && (
                      <div className="p-4 rounded-2xl bg-danger/5 border border-danger/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-danger uppercase tracking-widest">All-Time Low</span>
                          {cgMeta.atlDate && (
                            <span className="text-[9px] text-muted-foreground">{new Date(cgMeta.atlDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-danger">{formatPrice(cgMeta.atl, { symbol: currencySymbol, region: currencyRegion })}</span>
                          {cgMeta.atlChangePercentage != null && (
                            <span className={cn("text-sm font-bold", cgMeta.atlChangePercentage > 0 ? "text-success" : "text-danger")}>
                              {cgMeta.atlChangePercentage > 0 ? "+" : ""}{cgMeta.atlChangePercentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {cgMeta && (cgMeta.priceChangePercentage7d || cgMeta.priceChangePercentage30d) && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Price Performance</p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {[
                        { label: "7D", val: cgMeta.priceChangePercentage7d },
                        { label: "14D", val: cgMeta.priceChangePercentage14d },
                        { label: "30D", val: cgMeta.priceChangePercentage30d },
                        { label: "60D", val: cgMeta.priceChangePercentage60d },
                        { label: "200D", val: cgMeta.priceChangePercentage200d },
                        { label: "1Y", val: cgMeta.priceChangePercentage1y },
                      ].map(({ label, val }) => (
                        <div key={label} className="p-2.5 rounded-2xl bg-background/30 border border-border/30 dark:border-white/5 text-center">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                          <p className={cn("text-sm font-bold", val != null && val > 0 ? "text-success" : val != null && val < 0 ? "text-danger" : "text-muted-foreground")}>
                            {val != null ? `${val > 0 ? "+" : ""}${val.toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </>
              );
            })()}
          </div>

          <AssetPageSectionHeader
            label="Deeper analysis"
            variant="cyan"
            watermark="FUNDAMENTALS"
            watermarkOpacityClassName="opacity-[0.02]"
          />

          {/* Signal Strength — immediately after Data Matrix */}
          {hasMeaningfulSignalStrength && analyticsComputed.signalStrength && (
            <SignalStrengthCard
              signalStrength={analyticsComputed.signalStrength}
              symbol={symbol}
              assetName={analyticsComputed.name}
              onAskLyra={() => {
                setLyraSheetQuery({
                  query: buildComprehensiveThesisPromptCallback(),
                  displayQuery: `Generate a comprehensive institutional-grade investment thesis for ${analyticsComputed.name || symbol}`,
                });
                setIsLyraSheetOpen(true);
              }}
              className="rounded-2xl"
            />
          )}

          <AssetCryptoDiagnosticsSection
            analyticsComputed={analyticsComputed}
            cgMeta={cgMeta}
            currencyRegion={currencyRegion}
          />

          {/* Institutional Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {(factorData && signals) || correlationData ? (
              <EliteGate
                plan={plan}
                feature="Institutional Grid"
                className="md:col-span-2"
                teaser={
                  <div className="flex flex-col gap-5 md:flex-row md:flex-nowrap md:items-stretch md:overflow-x-auto md:pb-1">
                    {factorData && signals ? (
                      <div className="h-[450px] min-w-[320px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 p-5 md:flex-1 md:basis-[320px] md:shrink-0">
                        <h4 className="text-sm font-bold tracking-tight uppercase text-foreground">Factor DNA</h4>
                        <p className="text-xs text-muted-foreground mt-1">Advanced factor decomposition</p>
                        <div className="mt-5 space-y-4">
                          <div className="h-3 w-full rounded bg-muted/40" />
                          <div className="h-3 w-5/6 rounded bg-muted/35" />
                          <div className="h-3 w-4/6 rounded bg-muted/30" />
                          <div className="h-3 w-3/6 rounded bg-muted/25" />
                          <div className="h-3 w-5/6 rounded bg-muted/20" />
                          <div className="h-8 w-full rounded-2xl bg-muted/15" />
                          <div className="h-3 w-4/6 rounded bg-muted/20" />
                          <div className="h-3 w-full rounded bg-muted/15" />
                          <div className="h-8 w-full rounded-2xl bg-muted/10" />
                          <div className="h-3 w-5/6 rounded bg-muted/15" />
                        </div>
                      </div>
                    ) : null}

                    {correlationData ? (
                      <div className="h-[450px] min-w-[320px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 p-5 md:flex-1 md:basis-[320px] md:shrink-0">
                        <h4 className="text-sm font-bold tracking-tight uppercase text-foreground">Sync Hub</h4>
                        <p className="text-xs text-muted-foreground mt-1">Cross-asset correlation matrix</p>
                        <div className="mt-5 space-y-4">
                          <div className="h-3 w-full rounded bg-muted/40" />
                          <div className="h-3 w-5/6 rounded bg-muted/35" />
                          <div className="h-3 w-4/6 rounded bg-muted/30" />
                          <div className="h-3 w-3/6 rounded bg-muted/25" />
                          <div className="h-3 w-5/6 rounded bg-muted/20" />
                          <div className="h-8 w-full rounded-2xl bg-muted/15" />
                          <div className="h-3 w-4/6 rounded bg-muted/20" />
                          <div className="h-3 w-full rounded bg-muted/15" />
                          <div className="h-8 w-full rounded-2xl bg-muted/10" />
                          <div className="h-3 w-5/6 rounded bg-muted/15" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                }
              >
                <div className="flex flex-col gap-5 md:flex-row md:flex-nowrap md:items-stretch md:overflow-x-auto md:pb-1">
                  {factorData && signals ? (
                    <FactorProfile
                      data={{
                        ...factorData,
                        momentum: signals.momentum,
                        volatility: signals.volatility,
                      }}
                      className="h-[450px] min-w-[320px] md:flex-1 md:basis-[320px] md:shrink-0"
                    />
                  ) : null}

                  {correlationData ? (
                    <CorrelationMatrix data={correlationData} className="h-[450px] min-w-[320px] md:flex-1 md:basis-[320px] md:shrink-0" />
                  ) : null}
                </div>
              </EliteGate>
            ) : null}
          </div>

          {/* Performance Matrix Section */}
          {hasMeaningfulPerformanceSection && performance && (
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success" />
                Performance Metrics
              </h3>
              <PerformanceMatrix 
                performance={performance} 
                volatility={analyticsComputed.signals?.volatility}
                currencySymbol={currencySymbol}
                region={currencyRegion}
              />
            </div>
          )}

          {/* Score Dynamics Grid (Relocated) */}
          {analytics?.scoreDynamics && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Institutional Dynamics Matrix
                </h3>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[9px] font-bold text-primary uppercase tracking-[0.2em]">
                    Quantitative Analysis
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Object.entries(analytics.scoreDynamics)
                  .slice(0, 3)
                  .map(([scoreType, dynamics]) => (
                    <ScoreDynamicsCard
                      key={scoreType}
                      scoreType={scoreType.toUpperCase()}
                      dynamics={dynamics as ScoreDynamics}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Event Impact & Correlation Regime (Relocated) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
            {analytics?.eventAdjustedScores &&
              Object.values(analytics.eventAdjustedScores).some(
                (impact) => (impact as EventImpact).recentEvents > 0,
              ) && (
                <div className="backdrop-blur-2xl shadow-xl p-4 rounded-3xl border border-border/30 dark:border-white/5 bg-card/60 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 blur-3xl -z-10 transition-colors group-hover:bg-warning/10" />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-2xl bg-warning/10 border border-warning/20 text-warning">
                      <Zap className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                      Event Impact
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    {Object.entries(analytics.eventAdjustedScores)
                      .filter(
                        ([, impact]) =>
                          (impact as EventImpact).recentEvents > 0,
                      )
                      .slice(0, 3)
                      .map(([scoreType, impact]) => {
                        const eventImpact = impact as EventImpact;
                        return (
                          <div
                            key={scoreType}
                            className="bg-background/40 rounded-2xl p-2 border border-border/30 hover:border-warning/30 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {scoreType}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-baseline gap-1">
                                <span className="text-base font-bold text-foreground">
                                  {eventImpact.impactMagnitude > 0 ? "+" : ""}
                                  {(eventImpact.impactMagnitude || 0).toFixed(1)}%
                                </span>
                                <span className="text-[9px] text-muted-foreground font-medium">
                                  adjust
                                </span>
                              </div>
                              <EventImpactBadge
                                severity={eventImpact.maxSeverity || "MEDIUM"}
                                impactMagnitude={eventImpact.impactMagnitude}
                                eventCount={eventImpact.recentEvents}
                                className="scale-75 origin-right"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            {analytics?.correlationRegime && (
              <div className="bg-card/60 border border-border/30 dark:border-white/5 shadow-xl p-4 rounded-3xl backdrop-blur-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 blur-3xl -z-10 transition-colors group-hover:bg-warning/10" />
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-2xl bg-warning/10 border border-warning/20 text-warning">
                    <Waves className="h-4 w-4" />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground cursor-help">
                        Correlation
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      Per-asset correlation regime. Measures how this asset moves relative to all other assets in the universe. High correlation = asset tracks the broader market. Low = idiosyncratic behavior (moves independently).
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="space-y-2">
                  {/* Status Row */}
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <RegimeBadge
                            regime={analytics.correlationRegime?.regime || "STABLE"}
                            size="sm"
                            showLabel={true}
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {analytics.correlationRegime?.regime === "SYSTEMIC_STRESS"
                          ? "Systemic Stress: Extremely high correlation with elevated volatility. Diversification benefits severely reduced."
                          : analytics.correlationRegime?.regime === "MACRO_DRIVEN"
                          ? "Macro Driven: High cross-asset correlation. Broad market forces dominate this asset's price action."
                          : analytics.correlationRegime?.regime === "IDIOSYNCRATIC"
                          ? "Idiosyncratic: Low correlation with peers. This asset moves on its own fundamentals, not macro trends."
                          : analytics.correlationRegime?.regime === "TRANSITIONING"
                          ? "Transitioning: Correlation structure is shifting. The asset may be decoupling from or converging with the broader market."
                          : "Normal: Moderate correlation. Asset responds to both market-wide and crypto-specific factors."}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-xl border cursor-help",
                          analytics.correlationRegime.trend === "STABLE" ? "bg-success/10 text-success border-success/20" :
                          analytics.correlationRegime.trend === "RISING" ? "bg-warning/10 text-warning border-warning/20" :
                          "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {analytics.correlationRegime?.trend || "STABLE"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {analytics.correlationRegime?.trend === "RISING"
                          ? "Rising: Cross-asset correlations are increasing. This asset is becoming more tied to broad market moves."
                          : analytics.correlationRegime?.trend === "FALLING"
                          ? "Falling: Cross-asset correlations are decreasing. This asset is becoming more independent from the market."
                          : "Stable: Correlation structure is steady. No significant shift in how this asset co-moves with peers."}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Meters Stack (Compact) */}
                  <div className="space-y-2">
                    {/* Correlation Meter */}
                    <div className="bg-background/40 p-2.5 rounded-2xl border border-border/30 space-y-1">
                      <div className="space-y-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider opacity-70 block cursor-help">
                              Avg Correlation
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            Average pairwise correlation of this asset with all other assets. Range: 0 to 1. Higher = moves more in sync with the market. Lower = more independent price action.
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-xl font-bold text-foreground block tracking-tight">
                          {(analytics.correlationRegime?.avgCorrelation || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-warning rounded-full transition-all duration-1000"
                          style={{ width: `${Math.abs((analytics.correlationRegime?.avgCorrelation || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Dispersion Meter */}
                    <div className="bg-background/40 p-2.5 rounded-2xl border border-border/30 space-y-1">
                      <div className="space-y-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider opacity-70 block cursor-help">
                              Dispersion
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            Standard deviation of pairwise correlations. High dispersion = asset is highly correlated with some peers but not others (mixed behavior). Low = consistent correlation pattern.
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-xl font-bold text-foreground block tracking-tight">
                          {(analytics.correlationRegime?.dispersion || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-info rounded-full transition-all duration-1000"
                          style={{ width: `${(analytics.correlationRegime?.dispersion || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Historical Analog Engine — Elite Only */}
          {isElite && (
            <motion.div variants={staggerItem}>
              <HistoricalAnalogCard region={analyticsComputed.metadata?.region as string || "US"} />
            </motion.div>
          )}

          {/* Institutional Timeline — moved from sidebar */}
          <InstitutionalTimeline events={events} />
        </div>
      </motion.div>

      <ExplainSheet
        isOpen={isExplainOpen}
        onClose={() => setIsExplainOpen(false)}
        data={explainData}
      />

      {/* Lyra Insight Sheet */}
      <LyraInsightSheet
        open={isLyraSheetOpen}
        onClose={() => setIsLyraSheetOpen(false)}
        symbol={symbol}
        assetName={analyticsComputed.name}
        contextData={{
          scores: {
            trend: signals?.trend,
            momentum: signals?.momentum,
            volatility: signals?.volatility,
            sentiment: signals?.sentiment,
            liquidity: signals?.liquidity,
            trust: signals?.trust,
          },
          symbol,
          assetType: analytics?.type || "CRYPTO",
          assetName: analyticsComputed.name,
        }}
        initialQuery={lyraSheetQuery?.query}
        initialDisplayQuery={lyraSheetQuery?.displayQuery}
        sourcesLimit={3}
      />


    </div>
    </TooltipProvider>
  );
}

function TechnicalMetric({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string | number | null | undefined;
  tooltip?: string;
}) {
  if (!hasVisibleValue(value)) return null;

  return (
    <div className="group/metric p-3.5 rounded-2xl bg-background/30 border border-border/30 dark:border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover/metric:opacity-70 transition-opacity">
          {label}
        </p>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground opacity-20 group-hover/metric:opacity-60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="p-3 max-w-[min(280px,calc(100vw-2rem))] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {tooltip}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="text-lg font-bold tracking-tight text-foreground group-hover/metric:text-primary transition-colors">
        {value}
      </p>
    </div>
  );
}

const SCORE_BG_MAP: Record<string, string> = {
  "text-primary": "bg-primary",
  "text-foreground": "bg-foreground",
  "text-success": "bg-success",
  "text-warning": "bg-warning",
  "text-danger": "bg-danger",
  "text-info": "bg-info",
};

function ScoreTile({
  label,
  score,
  color = "text-foreground",
  bgColor,
  icon,
  onClick,
  tooltip,
  confidence,
  change,
  sparklineData,
}: {
  label: string;
  score: number;
  color?: string;
  bgColor?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tooltip: string;
  confidence?: "low" | "medium" | "high";
  change?: "up" | "down" | "stable";
  sparklineData?: { date: string; value: number }[];
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          className="bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl p-4 rounded-2xl flex flex-col justify-between gap-3 cursor-pointer group hover:bg-card/80 hover:border-primary/20 hover:shadow-primary/10 transition-all relative overflow-hidden min-h-[120px] h-auto"
        >
          {/* Subtle gradient glow on hover */}
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-60">
                {label}
              </p>
              {confidence && (
                <div className="flex items-center gap-1">
                  <div
                    className={cn(
                      "h-1 w-1 rounded-full",
                      confidence === "high"
                        ? "bg-success"
                        : confidence === "medium"
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                  />
                  <span className="text-[8px] font-bold uppercase tracking-tight opacity-40">
                    CONFIDENCE: {confidence}
                  </span>
                </div>
              )}
            </div>
            {icon ? (
              <div className={cn("p-1.5 rounded-2xl bg-primary/10", color)}>
                {icon}
              </div>
            ) : (
              <ScoreBadge score={score} size="sm" />
            )}
          </div>
          <div className="space-y-2 relative z-10">
            <div className="flex items-end justify-between">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn("text-3xl font-bold tracking-tighter", color)}
                >
                  {Math.round(score)}
                </span>
                {change && (
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      change === "up"
                        ? "text-success"
                        : change === "down"
                          ? "text-danger"
                          : "text-muted-foreground",
                    )}
                  >
                    {change === "up" ? "↑" : change === "down" ? "↓" : "↔"}
                  </span>
                )}
              </div>
              {sparklineData && sparklineData.length > 2 ? (
                <ScoreHistorySparkline
                  data={sparklineData}
                  currentScore={score}
                  width={64}
                  height={24}
                />
              ) : (
                <span className="text-[10px] font-bold opacity-20 uppercase tracking-widest mb-1">
                  Score
                </span>
              )}
            </div>
            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden border border-border/30 dark:border-white/5">
              <div
                className={cn(
                  "h-full transition-all duration-1000 opacity-80 group-hover:opacity-100",
                  bgColor || SCORE_BG_MAP[color] || "bg-foreground",
                )}
                style={{ width: `${score}%`, boxShadow: '0 0 10px currentColor' }}
              />
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="p-3 max-w-[200px] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        <div className="space-y-1">
          <p className="text-xs leading-relaxed text-white">
            {tooltip}
          </p>
          {sparklineData && sparklineData.length > 2 && (
            <p className="text-[8px] text-primary/70 font-bold uppercase tracking-widest">
              90-day score trend shown
            </p>
          )}
          {confidence && (
            <div className="pt-2 border-t border-primary/10 mt-2">
              <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest leading-none">
                Source Integrity:{" "}
                <span className="text-primary">{confidence}</span>
              </p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
