"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScoreBadge } from "@/components/analytics/score-badge";
import { ExplainSheet } from "@/components/analytics/explain-sheet";
import { IntelligenceLoader } from "@/components/ui/intelligence-loader";
import { LyraInsightSheet } from "@/components/lyra/lyra-insight-sheet";
import { InstitutionalTimeline } from "@/components/analytics/institutional-timeline";
import { ScoreDynamicsCard } from "@/components/ui/ScoreDynamicsCard";
import { ValuationMatrix } from "@/components/analytics/valuation-matrix";
import { InstitutionalOwnership } from "@/components/analytics/institutional-ownership";
import { PerformanceMatrix } from "@/components/analytics/performance-matrix";
import { EventImpactBadge } from "@/components/ui/EventImpactBadge";
import { RegimeBadge } from "@/components/ui/RegimeBadge";
// RiskMetricsCard content merged into Performance Metrics section for MFs
import { NSEIntelligence } from "@/components/analytics/nse-intelligence";
import { CompanyProfile } from "@/components/analytics/company-profile";
import { FinancialHighlights } from "@/components/analytics/financial-highlights";
import { ETFHoldings } from "@/components/analytics/etf-holdings";
import { ETFLookthroughSnapshot } from "@/components/analytics/etf-lookthrough-snapshot";
import { ETFRiskCard } from "@/components/analytics/etf-risk-card";
import { ETFBehavioralProfile } from "@/components/analytics/etf-behavioral-profile";
import { MFLookthroughSnapshot } from "@/components/analytics/mf-lookthrough-snapshot";
import { MFRiskCard } from "@/components/analytics/mf-risk-card";
import { MFBehavioralProfileCard } from "@/components/analytics/mf-behavioral-profile";
import { CommodityRegimeProfile } from "@/components/analytics/commodity-regime-profile";
import { CommoditySeasonalCard } from "@/components/analytics/commodity-seasonal-card";
import { CommodityCorrelationCard } from "@/components/analytics/commodity-correlation-card";
import { CommodityStructuralContext } from "@/components/analytics/commodity-structural-context";
import { MCXPriceCard } from "@/components/analytics/mcx-price-card";
import { ScenarioAnalysisCard } from "@/components/stocks/scenario-analysis-card";
import { SameSectorMovers } from "@/components/dashboard/same-sector-movers";
import dynamic from "next/dynamic";
import { AssetAnalyticsResponse, ScoreDynamics, EventImpact } from "@/types/analytics";
import { MFAnalyticsResult } from "@/lib/engines/mutual-fund-analytics";
import { cn, computeRangePositionPercent, formatCompactNumber, formatPrice, getCurrencyConfig, resolveAnalyticsSyncError } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";
import { BackButton } from "@/components/ui/back-button";
import {
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Activity,
  BarChart3,
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
} from "./asset-page-helpers";
import {
  AssetCryptoDiagnosticsSection,
  AssetCryptoProfileSection,
} from "./asset-page-render-sections";
import { AssetPageSectionHeader } from "./asset-page-section-header";

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

const AnalystTargetGauge = dynamic(
  () => import("@/components/analytics/analyst-target-gauge").then((mod) => mod.AnalystTargetGauge),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 overflow-hidden">
        <div className="h-full w-full bg-linear-to-r from-transparent via-muted/30 to-transparent bg-size-[200%_100%] animate-shimmer" />
      </div>
    ),
  },
);

function CommodityIntelSection({ ci }: { ci: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {ci.regimeProfile ? (
        <CommodityRegimeProfile
          regimeProfile={ci.regimeProfile as unknown as import("@/lib/engines/commodity-intelligence").RegimeProfile}
        />
      ) : null}
      {ci.seasonality ? (
        <CommoditySeasonalCard
          seasonality={ci.seasonality as unknown as import("@/lib/engines/commodity-intelligence").SeasonalPattern}
        />
      ) : null}
      {ci.correlations ? (
        <CommodityCorrelationCard
          correlations={ci.correlations as unknown as import("@/lib/engines/commodity-intelligence").CorrelationProfile}
        />
      ) : null}
      {ci.structuralContext ? (
        <CommodityStructuralContext
          context={ci.structuralContext as unknown as {
            cluster: string; supplyContext: string; demandDrivers: string;
            geopoliticalSensitivity: string; storageCost: string;
            inflationHedge: boolean; safeHavenCandidate: boolean; seasonalNotes: string;
          }}
        />
      ) : null}
    </div>
  );
}

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
          const res = await fetch(`/api/stocks/history?symbol=${symbol}&range=${apiRange}`, {
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
          const res = await fetch(`/api/stocks/${symbol.trim()}/analytics`, {
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
    let cancelled = false;
    // Small delay to let analytics settle before firing
    const timer = setTimeout(() => {
      fetch(`/api/stocks/${symbol.trim()}/score-history?days=90`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!cancelled && d?.history) setScoreHistory(d.history);
        })
        .catch(() => {});
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
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
    hasMeaningfulEtfLookthrough,
    hasMeaningfulMfLookthrough,
    hasMeaningfulSignalStrength,
    hasMeaningfulPerformanceSection,
    latestPrice,
    changePercent,
    isUp,
    headerDayRange,
    cgMeta,
  } = derivedState;

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
    <div className="relative space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-6 overflow-x-hidden min-w-0 w-full max-w-[100vw] will-change-composite p-3 sm:p-4 md:p-6">
      {/* Background Decorative Labels */}
      <div className="absolute -top-10 -right-20 text-[12vw] font-bold text-primary/5 select-none pointer-events-none tracking-tighter z-0 hidden lg:block uppercase">
        {getFriendlySymbol(symbol)} INTEL
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
                  {getFriendlySymbol(symbol, analytics?.type, analytics?.name)}
                </h1>
                <div className="hover:bg-primary/10 hover:text-primary p-1 rounded-full transition-colors cursor-pointer shrink-0">
                  <WatchlistStar symbol={symbol} size="md" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="px-2 py-0.5 rounded-md bg-muted/40 border border-border/30 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  {analytics?.type || "ASSET"}
                </div>
                {!!(analytics?.type === "STOCK" && analyticsComputed.sector) && (
                  <div className="px-2 py-0.5 rounded-md bg-primary/5 border border-primary/15 text-[9px] font-bold text-primary/80 uppercase tracking-widest">
                    {analyticsComputed.sector}
                  </div>
                )}
                {!!(analytics?.type === "MUTUAL_FUND" && analyticsComputed.fundHouse) && (
                  <div className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/15 text-[9px] font-bold text-sky-700 dark:text-sky-400/80 uppercase tracking-widest max-w-[160px] truncate">
                    {analyticsComputed.fundHouse}
                  </div>
                )}
                {!!(analytics?.type === "ETF" && analyticsComputed.technicalMetrics?.category) && (
                  <div className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/15 text-[9px] font-bold text-sky-700 dark:text-sky-400/80 uppercase tracking-widest max-w-[160px] truncate">
                    {analyticsComputed.technicalMetrics.category as string}
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
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    : "text-rose-500 bg-rose-500/10 border-rose-500/20",
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
                      style={{ left: "0%", width: `${computeRangePositionPercent(latestPrice, headerDayRange.low, headerDayRange.high)}%` }}
                    />
                    <div
                      className="absolute w-2 h-2 bg-white rounded-full top-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(var(--primary),0.5)] border border-primary/20 transition-all duration-1000"
                      style={{ left: `calc(${computeRangePositionPercent(latestPrice, headerDayRange.low, headerDayRange.high)}% - 4px)` }}
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
                <Link href={`/dashboard/lyra?q=${encodeURIComponent(`Explain ${getFriendlySymbol(symbol, analytics?.type, analytics?.name)} in plain English`)}`}>
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
              {(analyticsComputed.type === "STOCK" || analyticsComputed.type === "ETF") ? (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/dashboard/stress-test">
                    Stress test this theme
                    <Zap className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
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
              title: `Ask Lyra about ${getFriendlySymbol(symbol, analytics?.type, analytics?.name)}`,
              description: "Open Lyra when you want the setup translated into plain English, scenario logic or a cleaner action frame.",
              href: `/dashboard/lyra?q=${encodeURIComponent(`Explain ${getFriendlySymbol(symbol, analytics?.type, analytics?.name)} in plain English`)}`,
              accent: "amber",
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
            <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">Top drivers</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {keyDrivers.length > 0 ? keyDrivers.map((driver) => (
                  <span key={driver} className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                    {driver}
                  </span>
                )) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Strong drivers will appear here once the signal-strength model has enough evidence.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-rose-500/15 bg-rose-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-400">Top risks</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {keyRisks.length > 0 ? keyRisks.map((risk) => (
                  <span key={risk} className="inline-flex rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-400">
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
      <TooltipProvider>
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
      </TooltipProvider>

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
                chartType={analyticsComputed.type === "MUTUAL_FUND" ? "AREA" : "CANDLESTICK"}
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

          {/* Company Profile — Stocks & ETFs with description */}
          {(analyticsComputed.type === "STOCK" || analyticsComputed.type === "ETF") && (
            analyticsComputed.description || analyticsComputed.industry
          ) && (
            <CompanyProfile
              description={analyticsComputed.description}
              industry={analyticsComputed.industry}
              sector={analyticsComputed.sector ?? (analyticsComputed.metadata?.sector as string | undefined)}
              website={analyticsComputed.metadata?.website as string | undefined}
              employees={analyticsComputed.metadata?.fullTimeEmployees as number | undefined}
              country={analyticsComputed.metadata?.country as string | undefined}
              assetName={analyticsComputed.name}
            />
          )}

          {/* Financial Highlights — Stocks only */}
          {analyticsComputed.type === "STOCK" && analyticsComputed.financials && (
            <FinancialHighlights
              financials={analyticsComputed.financials as Record<string, unknown>}
              currencySymbol={currencySymbol}
              region={currencyRegion}
            />
          )}

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
                analyticsComputed.type === "COMMODITY"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  : analyticsComputed.type === "CRYPTO"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : (analyticsComputed.type === "ETF" || analyticsComputed.type === "MUTUAL_FUND")
                      ? "bg-sky-500/10 border-sky-500/20 text-sky-500"
                      : "bg-primary/10 border-primary/20 text-primary"
              )}>
                {analyticsComputed.type === "COMMODITY" ? (
                  <Activity className="h-5 w-5" />
                ) : analyticsComputed.type === "CRYPTO" ? (
                  <Zap className="h-5 w-5" />
                ) : (analyticsComputed.type === "ETF" || analyticsComputed.type === "MUTUAL_FUND") ? (
                  <BarChart3 className="h-5 w-5" />
                ) : (
                  <BarChart3 className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-bold tracking-tighter uppercase">
                  {analyticsComputed.type === "COMMODITY"
                    ? "Commodity Data Matrix"
                    : analyticsComputed.type === "CRYPTO"
                      ? "Crypto Data Matrix"
                      : analyticsComputed.type === "ETF"
                        ? "ETF Data Matrix"
                        : analyticsComputed.type === "MUTUAL_FUND"
                          ? "Mutual Fund Data Matrix"
                          : "Core market metrics"}
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                  {analyticsComputed.type === "COMMODITY"
                    ? "Futures & Contracts Intelligence"
                    : analyticsComputed.type === "CRYPTO"
                      ? "Digital Asset Structural Metrics"
                      : analyticsComputed.type === "ETF"
                        ? "Fund Structure & Performance Metrics"
                        : analyticsComputed.type === "MUTUAL_FUND"
                          ? "Fund NAV & Category Intelligence"
                          : "Valuation, ownership and market structure"}
                </p>
              </div>
            </div>

            {/* Matrix Selection Logic — by asset type */}
            {analyticsComputed.type === "MUTUAL_FUND" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <TechnicalMetric
                  label="NAV"
                  value={analyticsComputed.technicalMetrics?.nav ? formatPrice(Number(analyticsComputed.technicalMetrics.nav), { symbol: currencySymbol, region: currencyRegion }) : "—"}
                  tooltip="Net Asset Value per unit — the price at which you buy/sell one unit of the fund."
                />
                <TechnicalMetric
                  label="Category"
                  value={(analyticsComputed.technicalMetrics?.category as string) || "—"}
                  tooltip="The fund's investment category classification (e.g., Large Cap, Flexi Cap, ELSS)."
                />
                <TechnicalMetric
                  label="Fund House"
                  value={(analyticsComputed.metadata?.fundHouse as string) || "—"}
                  tooltip="The Asset Management Company (AMC) that manages this mutual fund scheme."
                />
                <TechnicalMetric
                  label="Scheme Type"
                  value={(analyticsComputed.metadata?.schemeType as string) || "—"}
                  tooltip="Whether the fund is Open Ended (can buy/sell anytime) or Close Ended (fixed maturity)."
                />
                <TechnicalMetric
                  label="1Y Return"
                  value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"}
                  tooltip="Total return over the last 1 year, calculated from NAV history."
                />
                <TechnicalMetric
                  label="6M Return"
                  value={performance?.returns?.["6M"] != null ? `${performance.returns["6M"] > 0 ? "+" : ""}${performance.returns["6M"].toFixed(2)}%` : "—"}
                  tooltip="Total return over the last 6 months."
                />
                <TechnicalMetric
                  label="3M Return"
                  value={performance?.returns?.["3M"] != null ? `${performance.returns["3M"] > 0 ? "+" : ""}${performance.returns["3M"].toFixed(2)}%` : "—"}
                  tooltip="Total return over the last 3 months, calculated from NAV history."
                />
                <TechnicalMetric
                  label="YTD Return"
                  value={performance?.returns?.["YTD"] != null ? `${performance.returns["YTD"] > 0 ? "+" : ""}${performance.returns["YTD"].toFixed(2)}%` : "—"}
                  tooltip="Year-to-date return from January 1st of the current year."
                />
              </div>
            ) : analyticsComputed.type === "ETF" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <TechnicalMetric
                  label="Expense Ratio"
                  value={analyticsComputed.technicalMetrics?.expenseRatio ? `${(Number(analyticsComputed.technicalMetrics.expenseRatio) * 100).toFixed(2)}%` : "—"}
                  tooltip="Annual fee charged by the fund as a percentage of assets under management. Lower is better."
                />
                <TechnicalMetric
                  label="AUM"
                  value={analyticsComputed.technicalMetrics?.marketCap !== null && analyticsComputed.technicalMetrics?.marketCap !== undefined ? formatCompactNumber(analyticsComputed.technicalMetrics.marketCap, { symbol: currencySymbol, region: currencyRegion }) : "—"}
                  tooltip="Total assets under management. Larger AUM indicates better liquidity and lower tracking error."
                />
                <TechnicalMetric
                  label="Category"
                  value={(analyticsComputed.technicalMetrics?.category as string) || "—"}
                  tooltip="The ETF's investment category classification (e.g., Large Blend, Technology, Fixed Income)."
                />
                <TechnicalMetric
                  label="NAV"
                  value={analyticsComputed.technicalMetrics?.nav ? formatPrice(Number(analyticsComputed.technicalMetrics.nav), { symbol: currencySymbol, region: currencyRegion }) : "—"}
                  tooltip="Net Asset Value per share. Compare to market price to assess premium/discount."
                />
                <TechnicalMetric
                  label="Prem/Disc"
                  value={analyticsComputed.technicalMetrics?.nav && analyticsComputed.price
                    ? `${((analyticsComputed.price - Number(analyticsComputed.technicalMetrics.nav)) / Number(analyticsComputed.technicalMetrics.nav) * 100) >= 0 ? "+" : ""}${((analyticsComputed.price - Number(analyticsComputed.technicalMetrics.nav)) / Number(analyticsComputed.technicalMetrics.nav) * 100).toFixed(3)}%`
                    : "—"}
                  tooltip="Premium or discount to NAV. Positive means trading above fair value, negative below."
                />
                <TechnicalMetric
                  label="Yield"
                  value={analyticsComputed.technicalMetrics?.yield ? `${(Number(analyticsComputed.technicalMetrics.yield) * 100).toFixed(2)}%` : analyticsComputed.metadata?.dividendYield ? `${(Number(analyticsComputed.metadata.dividendYield) * 100).toFixed(2)}%` : "—"}
                  tooltip="Annual distribution yield — dividends and interest paid as a percentage of price."
                />
                <TechnicalMetric
                  label="P/E Ratio"
                  value={analyticsComputed.technicalMetrics?.peRatio ? Number(analyticsComputed.technicalMetrics.peRatio).toFixed(2) : "—"}
                  tooltip="Weighted average P/E of the ETF's underlying holdings. Indicates valuation level."
                />
                <TechnicalMetric
                  label="Beta"
                  value={analyticsComputed.metadata?.beta != null && Number(analyticsComputed.metadata.beta) !== 0 ? Number(analyticsComputed.metadata.beta).toFixed(2) : "—"}
                  tooltip="Sensitivity to market movements. Beta > 1 means more volatile than the market, < 1 means less."
                />
                <TechnicalMetric
                  label="52W Range"
                  value={analyticsComputed.technicalMetrics?.fiftyTwoWeekHigh !== undefined && analyticsComputed.technicalMetrics?.fiftyTwoWeekHigh !== null
                    ? `${formatPrice(analyticsComputed.technicalMetrics.fiftyTwoWeekLow || 0, { symbol: currencySymbol, region: currencyRegion, decimals: 1 })} - ${formatPrice(analyticsComputed.technicalMetrics.fiftyTwoWeekHigh || 0, { symbol: currencySymbol, region: currencyRegion, decimals: 1 })}`
                    : "—"}
                  tooltip="The lowest and highest price over the last 52 weeks."
                />
                <TechnicalMetric
                  label="From 52W High"
                  value={analyticsComputed.technicalMetrics?.distanceFrom52WHigh != null ? `${Number(analyticsComputed.technicalMetrics.distanceFrom52WHigh).toFixed(1)}%` : "—"}
                  tooltip="How far the current price is from the 52-week high. Negative means below the high."
                />
                <TechnicalMetric
                  label="1Y Return"
                  value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"}
                  tooltip="Total return over the last 1 year including distributions."
                />
                <TechnicalMetric
                  label="Avg Volume"
                  value={analyticsComputed.technicalMetrics?.avgVolume ? formatCompactNumber(analyticsComputed.technicalMetrics.avgVolume.toString(), { isCurrency: false, region: currencyRegion }) : "—"}
                  tooltip="Average daily trading volume. Higher volume means better liquidity and tighter spreads."
                />
              </div>
            ) : analyticsComputed.type === "CRYPTO" ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <TechnicalMetric label="Market Cap" value={analyticsComputed.technicalMetrics?.marketCap !== null && analyticsComputed.technicalMetrics?.marketCap !== undefined ? formatCompactNumber(analyticsComputed.technicalMetrics.marketCap, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Total market value of all circulating coins. Key indicator of project size and adoption." />
                  <TechnicalMetric label="MCap Rank" value={cgMeta?.marketCapRank ? `#${cgMeta.marketCapRank}` : "—"} tooltip="CoinGecko market cap ranking among all cryptocurrencies." />
                  <TechnicalMetric label="24h Volume" value={analyticsComputed.metadata?.volume24Hr !== null && analyticsComputed.metadata?.volume24Hr !== undefined ? formatCompactNumber(analyticsComputed.metadata.volume24Hr.toString(), { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Total trading volume over the last 24 hours across all exchanges." />
                  <TechnicalMetric label="Vol / Mkt Cap" value={analyticsComputed.metadata?.volume24Hr !== null && analyticsComputed.metadata?.volume24Hr !== undefined && analyticsComputed.technicalMetrics?.marketCap && Number(analyticsComputed.technicalMetrics.marketCap) !== 0 ? `${(((analyticsComputed.metadata?.volume24Hr as number) / Number(analyticsComputed.technicalMetrics.marketCap)) * 100).toFixed(2)}%` : "—"} tooltip="Volume-to-Market Cap ratio. Higher values indicate more active trading relative to size. >5% is high activity." />
                  <TechnicalMetric label="FDV" value={cgMeta?.fullyDilutedValuation ? formatCompactNumber(cgMeta.fullyDilutedValuation, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Fully Diluted Valuation — market cap if max supply were fully circulating. Indicates potential dilution." />
                  <TechnicalMetric label="Day Range" value={analyticsComputed.metadata?.dayHigh && analyticsComputed.metadata?.dayLow ? `${formatPrice(analyticsComputed.metadata.dayLow as number, { symbol: currencySymbol, region: currencyRegion, decimals: 2 })} – ${formatPrice(analyticsComputed.metadata.dayHigh as number, { symbol: currencySymbol, region: currencyRegion, decimals: 2 })}` : "—"} tooltip="Today's price range (24h low to high)." />
                  <TechnicalMetric label="Circ. Supply" value={analyticsComputed.metadata?.circulatingSupply !== null && analyticsComputed.metadata?.circulatingSupply !== undefined ? formatCompactNumber(analyticsComputed.metadata.circulatingSupply as number, { isCurrency: false, region: currencyRegion }) : "—"} tooltip="Coins currently circulating in the market and available for trading." />
                  <TechnicalMetric label="Max Supply" value={analyticsComputed.metadata?.maxSupply !== null && analyticsComputed.metadata?.maxSupply !== undefined ? formatCompactNumber(analyticsComputed.metadata.maxSupply as number, { isCurrency: false, region: currencyRegion }) : "∞"} tooltip="Maximum coins that will ever exist. ∞ means unlimited supply (inflationary token)." />
                  {!!(analyticsComputed.metadata?.circulatingSupply && analyticsComputed.metadata?.maxSupply && Number(analyticsComputed.metadata.maxSupply) > 0) && (
                    <TechnicalMetric label="Supply Mined" value={`${((Number(analyticsComputed.metadata.circulatingSupply) / Number(analyticsComputed.metadata.maxSupply)) * 100).toFixed(1)}%`} tooltip="Percentage of max supply already in circulation. Higher % means less future dilution." />
                  )}
                  <TechnicalMetric label="From 52W High" value={analyticsComputed.technicalMetrics?.distanceFrom52WHigh != null ? `${Number(analyticsComputed.technicalMetrics.distanceFrom52WHigh).toFixed(1)}%` : "—"} tooltip="Distance from 52-week high. Negative means below the high." />
                  <TechnicalMetric label="1Y Return" value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"} tooltip="Total return over the last 1 year." />
                </div>

                {(cgMeta?.ath || cgMeta?.atl) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {cgMeta?.ath != null && (
                      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">All-Time High</span>
                          {cgMeta.athDate && (
                            <span className="text-[9px] text-muted-foreground">{new Date(cgMeta.athDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-emerald-500">{formatPrice(cgMeta.ath, { symbol: currencySymbol, region: currencyRegion })}</span>
                          {cgMeta.athChangePercentage != null && (
                            <span className={cn("text-sm font-bold", cgMeta.athChangePercentage < 0 ? "text-red-500" : "text-emerald-500")}>
                              {cgMeta.athChangePercentage > 0 ? "+" : ""}{cgMeta.athChangePercentage.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {cgMeta?.atl != null && (
                      <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">All-Time Low</span>
                          {cgMeta.atlDate && (
                            <span className="text-[9px] text-muted-foreground">{new Date(cgMeta.atlDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-red-500">{formatPrice(cgMeta.atl, { symbol: currencySymbol, region: currencyRegion })}</span>
                          {cgMeta.atlChangePercentage != null && (
                            <span className={cn("text-sm font-bold", cgMeta.atlChangePercentage > 0 ? "text-emerald-500" : "text-red-500")}>
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
                          <p className={cn("text-sm font-bold", val != null && val > 0 ? "text-emerald-500" : val != null && val < 0 ? "text-red-500" : "text-muted-foreground")}>
                            {val != null ? `${val > 0 ? "+" : ""}${val.toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </>
            ) : analyticsComputed.type === "COMMODITY" ? (
              <>
                {/* IN commodities (GOLD-MCX / SILVER-MCX): show MCX-native INR metrics */}
                {(analyticsComputed.symbol === "GOLD-MCX" || analyticsComputed.symbol === "SILVER-MCX") ? (() => {
                  const meta = analyticsComputed.metadata as Record<string, unknown> | null;
                  const isGoldMcx = analyticsComputed.symbol === "GOLD-MCX";
                  const nativePrice = isGoldMcx ? Number(meta?.mcxPricePer10g) : Number(meta?.mcxPricePerKg);
                  const chgPct = Number(meta?.dayChangePercent);
                  const priorSettlInr = nativePrice > 0 && chgPct !== 0 ? nativePrice / (1 + chgPct / 100) : 0;
                  // INR day range derived from USD spot × MCX/ask rate
                  const mcxOz = Number(meta?.mcxPricePerOz);
                  const askUsd = Number(meta?.spotAsk);
                  const mcxRate = mcxOz > 0 && askUsd > 0 ? mcxOz / askUsd : 0;
                  const OZ_TO_G = 31.1035;
                  const dayHighInr = Number(meta?.dayHigh) > 0 && mcxRate > 0
                    ? isGoldMcx ? (Number(meta?.dayHigh) * mcxRate / OZ_TO_G) * 10 : (Number(meta?.dayHigh) * mcxRate / OZ_TO_G) * 1000
                    : 0;
                  const dayLowInr = Number(meta?.dayLow) > 0 && mcxRate > 0
                    ? isGoldMcx ? (Number(meta?.dayLow) * mcxRate / OZ_TO_G) * 10 : (Number(meta?.dayLow) * mcxRate / OZ_TO_G) * 1000
                    : 0;
                  const lotValue = isGoldMcx
                    ? nativePrice > 0 ? `₹${(nativePrice * 10).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"
                    : nativePrice > 0 ? `₹${(nativePrice * 30).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";
                  const fmtInr = (v: number) => v > 0 ? `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                      <TechnicalMetric label={isGoldMcx ? "Spot (per 10g)" : "Spot (per kg)"} value={fmtInr(nativePrice)} tooltip={isGoldMcx ? "MCX Gold spot price in INR per 10 grams — the standard MCX quotation unit." : "MCX Silver spot price in INR per kg — the standard MCX quotation unit."} />
                      <TechnicalMetric label="Prior Settlement" value={fmtInr(priorSettlInr)} tooltip="Estimated prior session closing price in INR, derived from current price and day change %." />
                      <TechnicalMetric label="Day Range (INR)" value={dayHighInr > 0 && dayLowInr > 0 ? `${fmtInr(dayLowInr)} – ${fmtInr(dayHighInr)}` : "—"} tooltip={isGoldMcx ? "Intraday low–high range in INR per 10g, derived from USD spot range × MCX implied rate." : "Intraday low–high range in INR per kg, derived from USD spot range × MCX implied rate."} />
                      <TechnicalMetric label={isGoldMcx ? "1 Lot (100g)" : "1 Lot (30kg)"} value={lotValue} tooltip={isGoldMcx ? "Value of one MCX Gold futures lot (100g) at current spot price." : "Value of one MCX Silver futures lot (30kg) at current spot price."} />
                      <TechnicalMetric label="Exchange" value="MCX India" tooltip="Multi Commodity Exchange of India — the primary exchange for commodity futures in India." />
                      <TechnicalMetric label={isGoldMcx ? "Quotation" : "Quotation"} value={isGoldMcx ? "₹ per 10g" : "₹ per kg"} tooltip="Standard MCX contract quotation unit." />
                      <TechnicalMetric label="Linked COMEX" value={isGoldMcx ? "GC=F" : "SI=F"} tooltip="The corresponding USD-denominated COMEX futures contract that MCX tracks." />
                      <TechnicalMetric label="1Y Return" value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"} tooltip="Total return over the last 1 year." />
                    </div>
                  );
                })() : (
                  /* US commodities (GC=F, SI=F, etc.): original Yahoo-based metrics */
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    <TechnicalMetric label="Open Interest" value={analyticsComputed.metadata?.openInterest ? formatCompactNumber(analyticsComputed.metadata.openInterest.toString(), { isCurrency: false, region: currencyRegion }) : "—"} tooltip="Total outstanding derivative contracts not yet settled. High OI indicates strong market participation." />
                    <TechnicalMetric label="Volume" value={analyticsComputed.technicalMetrics?.volume ? formatCompactNumber(analyticsComputed.technicalMetrics.volume.toString(), { isCurrency: false, region: currencyRegion }) : "—"} tooltip="Total contracts traded during the current session." />
                    <TechnicalMetric label="Avg Volume" value={analyticsComputed.technicalMetrics?.avgVolume ? formatCompactNumber(analyticsComputed.technicalMetrics.avgVolume.toString(), { isCurrency: false, region: currencyRegion }) : "—"} tooltip="Average daily trading volume. Compare with today's volume to gauge activity level." />
                    <TechnicalMetric label="Vol vs Avg" value={analyticsComputed.technicalMetrics?.volume && analyticsComputed.technicalMetrics?.avgVolume && Number(analyticsComputed.technicalMetrics.avgVolume) > 0 ? `${((Number(analyticsComputed.technicalMetrics.volume) / Number(analyticsComputed.technicalMetrics.avgVolume)) * 100).toFixed(0)}%` : "—"} tooltip="Today's volume as a percentage of average. >100% means above-average activity." />
                    <TechnicalMetric label="Day Range" value={(analyticsComputed.metadata?.dayHigh && analyticsComputed.metadata?.dayLow) ? `${formatPrice(analyticsComputed.metadata.dayLow as number, { symbol: currencySymbol, region: currencyRegion, decimals: 1 })} - ${formatPrice(analyticsComputed.metadata.dayHigh as number, { symbol: currencySymbol, region: currencyRegion, decimals: 1 })}` : "—"} tooltip="The low and high price for the current trading session." />
                    <TechnicalMetric label="52W Range" value={analyticsComputed.technicalMetrics?.fiftyTwoWeekHigh !== undefined && analyticsComputed.technicalMetrics?.fiftyTwoWeekHigh !== null ? `${formatPrice(analyticsComputed.technicalMetrics.fiftyTwoWeekLow || 0, { symbol: currencySymbol, region: currencyRegion, decimals: 1 })} - ${formatPrice(analyticsComputed.technicalMetrics.fiftyTwoWeekHigh || 0, { symbol: currencySymbol, region: currencyRegion, decimals: 1 })}` : "—"} tooltip="The lowest and highest price over the last 52 weeks." />
                    <TechnicalMetric label="Prior Settlement" value={formatPrice(analyticsComputed.price - analyticsComputed.change, { symbol: currencySymbol, region: currencyRegion })} tooltip="The closing price from the previous trading session." />
                    <TechnicalMetric label="Exchange" value={(analyticsComputed.metadata?.exchangeName as string) || "—"} tooltip="The futures exchange where this contract is traded (e.g., COMEX, NYMEX)." />
                    <TechnicalMetric label="Expiration" value={analyticsComputed.metadata?.expireDate ? new Date(analyticsComputed.metadata.expireDate as string).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"} tooltip="The date on which the futures contract expires." />
                    <TechnicalMetric label="From 52W High" value={analyticsComputed.technicalMetrics?.distanceFrom52WHigh != null ? `${Number(analyticsComputed.technicalMetrics.distanceFrom52WHigh).toFixed(1)}%` : "—"} tooltip="Distance from 52-week high. Negative means below the high." />
                    <TechnicalMetric label="1Y Return" value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"} tooltip="Total return over the last 1 year." />
                  </div>
                )}

                {analyticsComputed.commodityIntelligence != null && (
                  <CommodityIntelSection ci={analyticsComputed.commodityIntelligence} />
                )}

                {/* MCX India Intelligence card (shown for all commodities that have MCX metadata) */}
                {analyticsComputed.metadata && (
                  <MCXPriceCard
                    metadata={analyticsComputed.metadata as Record<string, unknown>}
                    assetName={analyticsComputed.name}
                    spotPriceUsd={analyticsComputed.price}
                    symbol={analyticsComputed.symbol ?? symbol}
                    fiftyTwoWeekHigh={analyticsComputed.technicalMetrics?.fiftyTwoWeekHigh ?? null}
                    fiftyTwoWeekLow={analyticsComputed.technicalMetrics?.fiftyTwoWeekLow ?? null}
                    className="mt-4"
                  />
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <TechnicalMetric label="Market Cap" value={analyticsComputed.technicalMetrics?.marketCap && analyticsComputed.technicalMetrics.marketCap !== "0" ? formatCompactNumber(analyticsComputed.technicalMetrics.marketCap, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Total market value of outstanding shares, indicating overall size and institutional footprint." />
                <TechnicalMetric label="P/E (TTM)" value={analyticsComputed.technicalMetrics?.peRatio !== null && analyticsComputed.technicalMetrics?.peRatio !== undefined ? analyticsComputed.technicalMetrics.peRatio.toFixed(2) : "—"} tooltip={analyticsComputed.technicalMetrics?.industryPe ? `Industry P/E: ${Number(analyticsComputed.technicalMetrics.industryPe).toFixed(2)}x. ${Number(analyticsComputed.technicalMetrics.peRatio) < Number(analyticsComputed.technicalMetrics.industryPe) ? "Trading below industry average." : "Trading above industry average."}` : "Price-to-Earnings Ratio (Trailing Twelve Months)."} />
                <TechnicalMetric label="Forward P/E" value={analyticsComputed.metadata?.forwardPe != null && Number(analyticsComputed.metadata.forwardPe) > 0 ? Number(analyticsComputed.metadata.forwardPe).toFixed(2) : "—"} tooltip="Forward P/E based on estimated future earnings. Lower than TTM P/E suggests expected earnings growth." />
                {!!(analyticsComputed.technicalMetrics?.oneYearChange != null) && (
                  <TechnicalMetric label="1Y Change" value={`${Number(analyticsComputed.technicalMetrics.oneYearChange) > 0 ? "+" : ""}${Number(analyticsComputed.technicalMetrics.oneYearChange).toFixed(1)}%`} tooltip="Price change over the last 52 weeks." />
                )}
                <TechnicalMetric label="EPS (TTM)" value={analyticsComputed.technicalMetrics?.eps && typeof analyticsComputed.technicalMetrics.eps === "number" ? formatPrice(analyticsComputed.technicalMetrics.eps, { symbol: currencySymbol, region: currencyRegion }) : "—"} tooltip="Earnings Per Share (Trailing Twelve Months). Key profitability indicator." />
                <TechnicalMetric label="ROE" value={analyticsComputed.technicalMetrics?.roe !== null && analyticsComputed.technicalMetrics?.roe !== undefined ? `${(analyticsComputed.technicalMetrics.roe * 100).toFixed(2)}%` : "—"} tooltip="Return on Equity. >15% is generally considered strong capital efficiency." />
                <TechnicalMetric label="Op. Margin" value={analyticsComputed.metadata?.operatingMargins != null ? `${(Number(analyticsComputed.metadata.operatingMargins) * 100).toFixed(2)}%` : "—"} tooltip="Operating profit as a percentage of revenue. Higher margins indicate pricing power and operational efficiency." />
                <TechnicalMetric label="Price/Book" value={analyticsComputed.technicalMetrics?.priceToBook ? analyticsComputed.technicalMetrics.priceToBook.toFixed(2) : "—"} tooltip="Price-to-Book ratio. <1 may indicate undervaluation; >3 suggests growth premium." />
                <TechnicalMetric label="52W Range" value={analyticsComputed.technicalMetrics?.fiftyTwoWeekLow && analyticsComputed.technicalMetrics?.fiftyTwoWeekHigh ? `${formatPrice(analyticsComputed.technicalMetrics.fiftyTwoWeekLow, { symbol: currencySymbol, region: currencyRegion, decimals: 0 })} - ${formatPrice(analyticsComputed.technicalMetrics.fiftyTwoWeekHigh, { symbol: currencySymbol, region: currencyRegion, decimals: 0 })}` : "—"} tooltip="52-week price range. Used to assess volatility and current price context." />
                <TechnicalMetric label="From 52W High" value={analyticsComputed.technicalMetrics?.distanceFrom52WHigh != null ? `${Number(analyticsComputed.technicalMetrics.distanceFrom52WHigh).toFixed(1)}%` : "—"} tooltip="Distance from 52-week high. Negative means below the high." />
                <TechnicalMetric label="Beta" value={analyticsComputed.metadata?.beta != null && Number(analyticsComputed.metadata.beta) !== 0 ? Number(analyticsComputed.metadata.beta).toFixed(2) : "—"} tooltip="Sensitivity to market movements. Beta > 1 = more volatile than market, < 1 = less volatile." />
                <TechnicalMetric label="Div. Yield" value={analyticsComputed.technicalMetrics?.dividendYield != null && Number(analyticsComputed.technicalMetrics.dividendYield) > 0 ? `${(Number(analyticsComputed.technicalMetrics.dividendYield) * 100).toFixed(2)}%` : "—"} tooltip="Annual dividend as a percentage of share price." />
                {!!(analyticsComputed.technicalMetrics?.shortRatio != null && Number(analyticsComputed.technicalMetrics.shortRatio) > 0) && (
                  <TechnicalMetric label="Short Ratio" value={`${Number(analyticsComputed.technicalMetrics.shortRatio).toFixed(2)}`} tooltip="Days to cover short positions based on average volume. Higher values indicate more bearish sentiment." />
                )}
                {!!(analyticsComputed.metadata?.heldPercentInstitutions != null && Number(analyticsComputed.metadata.heldPercentInstitutions) > 0) && (
                  <TechnicalMetric label="Inst. Ownership" value={`${(Number(analyticsComputed.metadata.heldPercentInstitutions) * 100).toFixed(1)}%`} tooltip="Percentage of shares held by institutional investors. High institutional ownership suggests professional confidence." />
                )}
                {!!(analyticsComputed.metadata?.revenueGrowth != null) && (
                  <TechnicalMetric label="Rev. Growth" value={`${(Number(analyticsComputed.metadata.revenueGrowth) * 100).toFixed(1)}%`} tooltip="Year-over-year revenue growth rate." />
                )}
                {!!(analyticsComputed.technicalMetrics?.industryPe != null && Number(analyticsComputed.technicalMetrics.industryPe) > 0) && (
                  <TechnicalMetric label="Sector P/E" value={Number(analyticsComputed.technicalMetrics.industryPe).toFixed(2)} tooltip="Average P/E ratio of the sector peers. Compare with stock P/E to assess relative valuation." />
                )}
                {!!(analyticsComputed.metadata?.deliveryPercent != null && Number(analyticsComputed.metadata.deliveryPercent) > 0) && (
                  <TechnicalMetric label="Delivery %" value={`${Number(analyticsComputed.metadata.deliveryPercent).toFixed(1)}%`} tooltip="Percentage of traded volume that resulted in actual delivery. Higher delivery % indicates genuine buying interest." />
                )}
                {!!(analyticsComputed.metadata?.annualVolatility != null && Number(analyticsComputed.metadata.annualVolatility) > 0) && (
                  <TechnicalMetric label="Ann. Volatility" value={`${Number(analyticsComputed.metadata.annualVolatility).toFixed(1)}%`} tooltip="Annualized price volatility. Higher values indicate greater price swings and risk." />
                )}
                <TechnicalMetric label="1Y Return" value={performance?.returns?.["1Y"] != null ? `${performance.returns["1Y"] > 0 ? "+" : ""}${performance.returns["1Y"].toFixed(2)}%` : "—"} tooltip="Total return over the last 1 year." />
              </div>
            )}
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

          {/* Scenario Analysis — Stocks & Equity ETFs only (assets with factor profiles) */}
          {(analyticsComputed.type === "STOCK" || 
            (analyticsComputed.type === "ETF" && factorData)) && (
            <div className="pt-4">
              <ScenarioAnalysisCard symbol={symbol} plan={plan} className="rounded-2xl" />
            </div>
          )}

          <AssetCryptoDiagnosticsSection
            analyticsComputed={analyticsComputed}
            cgMeta={cgMeta}
            currencyRegion={currencyRegion}
          />
          {/* ETF Lookthrough Intelligence — ETF Only */}
          {analyticsComputed.type === "ETF" && hasMeaningfulEtfLookthrough && (
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Lookthrough Intelligence
              </h3>
              {(() => {
                const lt = analyticsComputed.etfLookthrough as Record<string, unknown>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <ETFLookthroughSnapshot
                      lookthrough={lt as unknown as import("@/lib/engines/etf-lookthrough").ETFLookthroughResult}
                    />
                    {lt.risk ? (
                      <div className="space-y-5">
                        <ETFRiskCard
                          risk={lt.risk as unknown as import("@/lib/engines/etf-risk").ETFRiskResult}
                        />
                        <ETFBehavioralProfile
                          profile={lt.behavioral as import("@/lib/engines/etf-lookthrough").BehavioralProfile}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MF Lookthrough Intelligence — Mutual Fund Only */}
          {analyticsComputed.type === "MUTUAL_FUND" && hasMeaningfulMfLookthrough && (
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Fund Lookthrough Intelligence
              </h3>
              {(() => {
                const lt = analyticsComputed.mfLookthrough as Record<string, unknown>;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <MFLookthroughSnapshot
                      lookthrough={lt as unknown as import("@/lib/engines/mf-lookthrough").MFLookthroughResult}
                    />
                    {lt.risk ? (
                      <div className="space-y-5">
                        <MFRiskCard
                          risk={lt.risk as unknown as import("@/lib/engines/mf-risk").MFRiskResult}
                        />
                        <MFBehavioralProfileCard
                          profile={lt.behavioral as import("@/lib/engines/mf-lookthrough").MFBehavioralProfile}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ETF Holdings & Fund Performance — ETF Only */}
          {analyticsComputed.type === "ETF" && (
            analyticsComputed.topHoldings || analyticsComputed.fundPerformanceHistory
          ) && (
            <ETFHoldings
              topHoldings={analyticsComputed.topHoldings as Record<string, unknown> | undefined}
              fundPerformance={analyticsComputed.fundPerformanceHistory as Record<string, unknown> | undefined}
              currencySymbol={currencySymbol}
              region={currencyRegion}
            />
          )}

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

          {/* NSE Intelligence Panel — Indian Stocks Only */}
          {analyticsComputed?.metadata?.dataSource === "NSE_INDIA" && (
            <div className="pt-4">
              <NSEIntelligence
                metadata={analyticsComputed.metadata as Record<string, unknown>}
                currencySymbol={currencySymbol}
                region={currencyRegion}
              />
            </div>
          )}

          {/* Performance Matrix Section */}
          {hasMeaningfulPerformanceSection && performance && (
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Performance Metrics
              </h3>
              <PerformanceMatrix 
                performance={performance} 
                volatility={analyticsComputed.signals?.volatility}
                currencySymbol={currencySymbol}
                region={currencyRegion}
              />

              {/* MF Risk & CAGR — merged into Performance Metrics */}
              {analyticsComputed.type === "MUTUAL_FUND" && analyticsComputed.factorData?.mfAnalytics && (() => {
                const mfa = analyticsComputed.factorData.mfAnalytics as MFAnalyticsResult;
                const getReturnColor = (val: number | null) =>
                  val === null ? "text-muted-foreground" : val > 0 ? "text-green-500" : val < 0 ? "text-red-500" : "text-muted-foreground";
                return (
                  <div className="bg-card/60 backdrop-blur-2xl border shadow-xl p-6 rounded-3xl border-border/30 dark:border-white/5 space-y-6">
                    {/* CAGR Returns */}
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-3 tracking-widest flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        Annualized Returns (CAGR)
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {([["1Y", "1 Year"], ["3Y", "3 Years"], ["5Y", "5 Years"]] as const).map(([key, label]) => (
                          <div key={key} className="flex flex-col gap-1 p-3 rounded-2xl bg-card/40 border border-border/30 dark:border-white/5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
                            <span className={`text-lg font-bold font-mono ${getReturnColor(mfa.returns[key])}`}>
                              {mfa.returns[key] !== null ? `${mfa.returns[key]}%` : "N/A"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-border/40 w-full" />

                    {/* Technical Risk Analysis */}
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-3 tracking-widest flex items-center gap-2">
                        <Activity className="h-3 w-3 text-orange-500" />
                        Risk Analysis
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1 p-3 rounded-2xl bg-card/40 border border-border/30 dark:border-white/5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Standard Deviation</span>
                          <span className="text-lg font-bold font-mono text-orange-500">{mfa.risk.volatility}%</span>
                        </div>
                        <div className="flex flex-col gap-1 p-3 rounded-2xl bg-card/40 border border-border/30 dark:border-white/5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Beta</span>
                          <span className="text-lg font-bold font-mono text-amber-500">{mfa.risk.beta}</span>
                        </div>
                        <div className="flex flex-col gap-1 p-3 rounded-2xl bg-card/40 border border-border/30 dark:border-white/5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sharpe Ratio</span>
                          <span className="text-lg font-bold font-mono text-amber-500">{mfa.risk.sharpe}</span>
                        </div>
                        <div className="flex flex-col gap-1 p-3 rounded-2xl bg-card/40 border border-border/30 dark:border-white/5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">R-Squared</span>
                          <span className="text-lg font-bold font-mono text-amber-500">{mfa.risk.rSquared}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -z-10 transition-colors group-hover:bg-amber-500/10" />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
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
                            className="bg-background/40 rounded-2xl p-2 border border-border/30 hover:border-amber-500/30 transition-colors"
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
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -z-10 transition-colors group-hover:bg-amber-500/10" />
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
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
                          : "Normal: Moderate correlation. Asset responds to both market-wide and stock-specific factors."}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-xl border cursor-help",
                          analytics.correlationRegime.trend === "STABLE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                          analytics.correlationRegime.trend === "RISING" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                          "bg-amber-500/10 text-amber-500 border-amber-500/20"
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
                          className="h-full bg-amber-500 rounded-full transition-all duration-1000"
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
                          className="h-full bg-cyan-500 rounded-full transition-all duration-1000"
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
              <HistoricalAnalogCard region={analyticsComputed.metadata?.region as string || (symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "IN" : "US")} />
            </motion.div>
          )}

          {/* Enhanced Institutional Intelligence Section — Elite Only */}
          {!!analyticsComputed && (analyticsComputed.type === "STOCK" || analyticsComputed.type === "ETF") && (
            <EliteGate
              plan={plan}
              feature="Institutional Intelligence"
              teaser={
                <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Institutional Intelligence
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="h-[380px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 p-5 space-y-4">
                      <div className="h-3 w-2/3 rounded bg-muted/40" />
                      <div className="h-3 w-full rounded bg-muted/30" />
                      <div className="h-3 w-5/6 rounded bg-muted/25" />
                      <div className="h-3 w-3/4 rounded bg-muted/20" />
                      <div className="h-8 w-full rounded-2xl bg-muted/15" />
                      <div className="h-3 w-4/6 rounded bg-muted/20" />
                      <div className="h-3 w-full rounded bg-muted/15" />
                      <div className="h-8 w-full rounded-2xl bg-muted/10" />
                      <div className="h-3 w-5/6 rounded bg-muted/15" />
                    </div>
                    <div className="h-[380px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 p-5 space-y-4">
                      <div className="h-3 w-1/2 rounded bg-muted/40" />
                      <div className="h-3 w-full rounded bg-muted/30" />
                      <div className="h-3 w-4/6 rounded bg-muted/25" />
                      <div className="h-8 w-full rounded-2xl bg-muted/15" />
                      <div className="h-3 w-3/4 rounded bg-muted/20" />
                      <div className="h-3 w-full rounded bg-muted/15" />
                      <div className="h-8 w-full rounded-2xl bg-muted/10" />
                      <div className="h-3 w-5/6 rounded bg-muted/15" />
                    </div>
                    <div className="h-[380px] rounded-3xl border border-border/30 dark:border-white/5 bg-muted/5 p-5 space-y-4">
                      <div className="h-3 w-3/5 rounded bg-muted/40" />
                      <div className="h-3 w-full rounded bg-muted/30" />
                      <div className="h-3 w-2/3 rounded bg-muted/25" />
                      <div className="h-8 w-full rounded-2xl bg-muted/15" />
                      <div className="h-3 w-4/6 rounded bg-muted/20" />
                      <div className="h-3 w-full rounded bg-muted/15" />
                      <div className="h-8 w-full rounded-2xl bg-muted/10" />
                      <div className="h-3 w-3/4 rounded bg-muted/15" />
                    </div>
                  </div>
                </div>
              }
            >
              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Institutional Intelligence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Valuation Matrix */}
                  <ValuationMatrix
                    peRatio={analyticsComputed.technicalMetrics?.peRatio}
                    pegRatio={analyticsComputed.technicalMetrics?.pegRatio}
                    priceToBook={analyticsComputed.technicalMetrics?.priceToBook}
                    eps={analyticsComputed.technicalMetrics?.eps}
                    roe={analyticsComputed.technicalMetrics?.roe}
                    profitMargins={analyticsComputed.metadata?.profitMargins as number | undefined}
                    debtToEquity={analyticsComputed.metadata?.debtToEquity as number | undefined}
                    currentRatio={analyticsComputed.metadata?.currentRatio as number | undefined}
                    revenueGrowth={analyticsComputed.metadata?.revenueGrowth as number | undefined}
                    freeCashflow={analyticsComputed.metadata?.freeCashflow as number | undefined}
                    dividendYield={analyticsComputed.technicalMetrics?.dividendYield}
                    assetType={analyticsComputed.type}
                    industryPe={analyticsComputed.technicalMetrics?.industryPe}
                    currencySymbol={currencySymbol}
                    region={currencyRegion}
                    className="col-span-1"
                  />
                  
                  {/* Analyst Target Gauge */}
                  <AnalystTargetGauge
                    currentPrice={analyticsComputed.price}
                    targetMeanPrice={analyticsComputed.metadata?.targetMeanPrice as number | undefined}
                    targetHighPrice={analyticsComputed.metadata?.targetHighPrice as number | undefined}
                    targetLowPrice={analyticsComputed.metadata?.targetLowPrice as number | undefined}
                    numberOfAnalysts={analyticsComputed.metadata?.numberOfAnalystOpinions as number | undefined}
                    currencySymbol={currencySymbol}
                    region={currencyRegion}
                    className="col-span-1"
                  />
                  
                  {/* Institutional Ownership */}
                  <InstitutionalOwnership
                    heldPercentInstitutions={analyticsComputed.metadata?.heldPercentInstitutions as number | undefined}
                    heldPercentInsiders={analyticsComputed.metadata?.heldPercentInsiders as number | undefined}
                    shortRatio={analyticsComputed.technicalMetrics?.shortRatio}
                    beta={analyticsComputed.metadata?.beta as number | undefined}
                    assetType={analyticsComputed.type}
                    className="col-span-1"
                  />
                </div>
              </div>
            </EliteGate>
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
          assetType: analytics?.type || "STOCK",
          assetName: analyticsComputed.name,
        }}
        initialQuery={lyraSheetQuery?.query}
        initialDisplayQuery={lyraSheetQuery?.displayQuery}
        sourcesLimit={3}
      />


    </div>
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
  const hasValue = (() => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === "—") return false;
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numeric)) return numeric !== 0;
    return true;
  })();

  if (!hasValue) return null;

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

function ScoreTile({
  label,
  score,
  color = "text-foreground",
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
          className="bg-card/60 backdrop-blur-2xl border border-border/30 dark:border-white/5 shadow-xl p-4 rounded-2xl flex flex-col justify-between gap-3 cursor-pointer group hover:bg-card/80 hover:border-primary/20 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all relative overflow-hidden min-h-[120px] h-auto"
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
                        ? "bg-emerald-400"
                        : confidence === "medium"
                          ? "bg-amber-400"
                          : "bg-rose-400",
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
                        ? "text-emerald-400"
                        : change === "down"
                          ? "text-rose-400"
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
                  color.replace("text-", "bg-"),
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
