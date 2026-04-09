"use client";

import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from "react";
import { useRegion } from "@/lib/context/RegionContext";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { MarketAssetCard } from "@/components/dashboard/market/MarketAssetCard";
import { AssetSearchInput } from "@/components/dashboard/asset-search-input";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Loader2,
  Search,
  Filter,
  Activity,
  ChevronDown,
  Lock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  BarChart3,
  Globe,
  Crown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MarketContextBar } from "@/components/dashboard/market/MarketContextBar";
import { MarketContextPanel } from "@/components/dashboard/market/MarketContextPanel";
import { cn } from "@/lib/utils";
import { AssetSignals, CompatibilityResult } from "@/lib/engines/compatibility";
import { GroupingResult, AssetGroup } from "@/lib/engines/grouping";
import {
  ErrorBoundary,
  SectionErrorFallback,
} from "@/components/error-boundary";
import { TopMoversSection, TopMoverItem } from "@/components/dashboard/market/TopMoversSection";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";

declare global {
  interface Window {
    __AssetFilterState?: string;
  }
}

interface AssetState {
  symbol: string;
  name: string;
  type: string;
  price: number;
  changePercent: number;
  marketCap: string | null;
  peRatio: number | null;
  oneYearChange: number | null;
  signals: AssetSignals;
  compatibility: CompatibilityResult;
  grouping: GroupingResult;
  lastUpdated: string;
  currency: string;
  metadata?: Record<string, unknown> | null;
  sector?: string | null;
  dividendYield?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  fundHouse?: string | null;
  schemeType?: string | null;
}

const GROUP_MESSAGES: Record<AssetGroup, string[]> = {
  "Market Leaders": [
    "Exhibiting strong trend alignment and high execution quality in the current regime.",
    "Strong structural alignment with current regime.",
  ],
  "Regime-Aligned": [
    "Assets that fit the environment but are not dominant leaders.",
    "Consistent with current market conditions but lacking leadership characteristics.",
  ],
  "Regime-Sensitive": [
    "Performance likely to change if market conditions shift.",
    "High sensitivity to regime shifts due to volatility profile.",
  ],
  "Momentum Decay": [
    "Assets with intact structure but weakening short-term dynamics.",
    "Long-term trend remains positive but short-term momentum is exhausting.",
  ],
  "Neutral / Defensive": [
    "Stable structure with low environmental sensitivity, typically serving as a defensive buffer.",
    "Minimal directional pressure.",
  ],
  "Fragile / High Risk": [
    "Assets misaligned with the environment and structurally exposed.",
    "Significant exposure to volatility or liquidity gaps.",
  ],
};

const GROUP_PLAIN_ENGLISH: Record<AssetGroup, string> = {
  "Market Leaders": "Working well with the current market direction",
  "Regime-Aligned": "Moving in line with current market conditions",
  "Regime-Sensitive": "May change behavior if the market shifts",
  "Momentum Decay": "Price move is slowing down — watch closely",
  "Neutral / Defensive": "Stable, low-drama assets — good for cautious investors",
  "Fragile / High Risk": "Out of step with the market — higher risk right now",
};

const GROUP_ORDER: AssetGroup[] = [
  "Market Leaders",
  "Regime-Aligned",
  "Regime-Sensitive",
  "Momentum Decay",
  "Neutral / Defensive",
  "Fragile / High Risk",
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PAGE_SIZE = 30;
const SUCCESS_ACTIONS_KEY = "ux:successful-actions:v1";

export default function AssetsPage() {
  const router = useRouter();
  const { region } = useRegion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Deferred search query removed as we now use AssetSearchInput which has its own dropdown
  
  // Use a module-level variable to persist state across client-side navigation
  // This resets on page reload (browser refresh) but stays during SPA navigation
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [filterRegion, setFilterRegion] = useState<string>(region);

  // Reset filter when region changes (state-based, no effect or ref needed)
  if (filterRegion !== region) {
    setFilterRegion(region);
    if (selectedType !== "ALL") setSelectedType("ALL");
  }

  // Sync state to global variable whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__AssetFilterState = selectedType;
    }
  }, [selectedType]);
  const [isRegimeSortActive, setIsRegimeSortActive] = useState(false);
  const [successfulActionsCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.localStorage.getItem(SUCCESS_ACTIONS_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const uniqueActions = Array.from(new Set(parsed));

      if (uniqueActions.length === 0) {
        const firstValue = window.localStorage.getItem("ux:first-value-action:v1");
        if (firstValue) {
          uniqueActions.push(firstValue);
          window.localStorage.setItem(SUCCESS_ACTIONS_KEY, JSON.stringify(uniqueActions));
        }
      }

      return uniqueActions.length;
    } catch {
      return 0;
    }
  });
  const observerRef = useRef<HTMLDivElement>(null);

  const getKey = (
    pageIndex: number,
    previousPageData: { pagination: { hasMore: boolean } } | null,
  ) => {
    // If we have previous data and no more pages, stop
    if (previousPageData && !previousPageData.pagination.hasMore) return null;
    
    // Construct URL with filters - crypto-only
    const baseUrl = `/api/stocks/coverage?page=${pageIndex + 1}&limit=${PAGE_SIZE}&region=${region}&type=CRYPTO`;
    
    return baseUrl;
  };

  const { data, setSize, isValidating, isLoading } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateFirstPage: false,
      persistSize: true,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  );

  const assets = useMemo(() => {
    return data ? data.flatMap((page) => page.assets || []) : [];
  }, [data]);

  const marketContext = useMemo(() => {
    return data?.[0]?.marketContext || null;
  }, [data]);

  const { data: moversData } = useSWR<{ topGainers: TopMoverItem[]; topLosers: TopMoverItem[] }>(
    `/api/stocks/movers?region=${region}&type=CRYPTO`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );
  const topGainers = moversData?.topGainers || [];
  const topLosers = moversData?.topLosers || [];

  // Safely check for errors or missing pagination
  const lastPage = data?.[data.length - 1];
  const hasMore = lastPage?.pagination?.hasMore || false;
  const error = data?.[0]?.error;

  useEffect(() => {
    if (!observerRef.current || !hasMore || isValidating) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSize((s) => s + 1);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isValidating, setSize]);

  const filteredGroups = useMemo(() => {
    // The data is NOW ALREADY FILTERED by the Server.
    // We just need to group it and potentially sort by regime if active.
    
    const groups: Record<AssetGroup, AssetState[]> = {
      "Market Leaders": [],
      "Regime-Aligned": [],
      "Regime-Sensitive": [],
      "Momentum Decay": [],
      "Neutral / Defensive": [],
      "Fragile / High Risk": [],
    };

    const seenByGroup: Record<AssetGroup, Set<string>> = {
      "Market Leaders": new Set(),
      "Regime-Aligned": new Set(),
      "Regime-Sensitive": new Set(),
      "Momentum Decay": new Set(),
      "Neutral / Defensive": new Set(),
      "Fragile / High Risk": new Set(),
    };

    // Distribute Server-Filtered assets into groups
    assets.forEach((a) => {
      const groupKey = a.grouping.group as AssetGroup;
      if (groups[groupKey]) {
        const set = seenByGroup[groupKey];
        if (set.has(a.symbol)) return;
        set.add(a.symbol);
        groups[groupKey].push(a);
      } else {
        // Fallback for unexpected groups
        // groups["Neutral / Defensive"].push(a);
      }
    });

    // Apply Regime Sort if active
    if (isRegimeSortActive) {
      Object.keys(groups).forEach((key) => {
        groups[key as AssetGroup].sort(
          (a, b) => b.compatibility.score - a.compatibility.score,
        );
      });
    }

    return groups;
  }, [assets, isRegimeSortActive]);

  if (!mounted) return null;

  // Detect plan-gating errors (403 "Upgrade to...") vs real errors
  const isPlanGated = error && typeof error === "string" && error.toLowerCase().includes("upgrade");

  if (error && !isPlanGated) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            Couldn&apos;t Load Data
          </p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
            {typeof error === "string" ? error : "Unable to synchronize with core"}
          </p>
          {data?.[0]?.details && (
             <p className="text-[10px] font-mono text-muted-foreground/75 dark:text-muted-foreground/50 max-w-lg text-center mt-2 p-2 bg-muted/20 rounded">
               {String(data[0].details)}
             </p>
          )}
        </div>

      </div>
    );
  }

  // Only show the full-screen "Calibrating" loader if we are initializing
  // and NOT searching. If we are searching, we want to keep the UI mounted
  // (especially the search input) and show an inline loader instead.
  if (isLoading && !data) {
    return (
      <div
        className="flex h-[80vh] flex-col items-center justify-center gap-6"
        suppressHydrationWarning
      >
        <div className="relative" suppressHydrationWarning>
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <Activity className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div
          className="flex flex-col items-center gap-2"
          suppressHydrationWarning
        >
          <p className="text-sm font-bold uppercase tracking-[0.3em] premium-gradient-text animate-pulse">
            Loading Market Data
          </p>
          <p className="text-[10px] font-bold text-muted-foreground/80 dark:text-muted-foreground uppercase tracking-widest opacity-90 dark:opacity-40">
            Crunching numbers...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <SectionErrorFallback
          error={new Error("Assets page failed to load")}
          resetError={() => window.location.reload()}
        />
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={region}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="overflow-x-hidden relative flex flex-col gap-4 md:gap-8 p-3 sm:p-4 md:p-6 pb-6 min-w-0"
        >
        <div className="relative z-10 animate-slide-up-fade">
          <PageHeader
            icon={<Search className="h-5 w-5" />}
            title="Crypto Intelligence"
            eyebrow="On-chain terminal"
            chips={
              <>
                <StatChip value={region} label="Market" variant="muted" />
                <StatChip value="Current" label="Status" variant="green" />
              </>
            }
          />
        </div>


        {/* Global Market Context Bar */}
        <motion.div className="z-10">
          {marketContext && (
            <MarketContextBar
              context={marketContext}
              className="shadow-2xl shadow-primary/5"
            />
          )}
        </motion.div>

        {/* Top Movers (Gainers + Losers) */}
        <motion.div className="z-10">
          <TopMoversSection gainers={topGainers} losers={topLosers} region={region} />
        </motion.div>

        <div className="z-20 relative">
          <AssetSearchInput
            global={true}
            onSelect={(symbol) => {
              if (symbol.trim()) {
                router.push(`/dashboard/assets/${symbol.trim().toUpperCase()}`);
              }
            }}
            placeholder="Search BTC, Bitcoin, ETH"
          />
        </div>

        {/* Filter & Command Bar */}
        <motion.div className="flex flex-col gap-2 sm:gap-3 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 sm:h-10 px-3 sm:px-4 border-white/5 rounded-2xl gap-2 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest flex-1 md:flex-none transition-all cursor-pointer hover:bg-muted/50",
                    selectedType !== "ALL"
                      ? "bg-primary/5 border-primary/20 text-primary opacity-100"
                      : "opacity-60 hover:opacity-100",
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Type: {selectedType === "ALL" ? "All" : selectedType}
                  <ChevronDown className="h-3 w-3 opacity-40" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-48 rounded-3xl border border-white/10 bg-card/70 p-1 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl"
              >
                {["ALL", "CRYPTO"].map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="flex items-center justify-between rounded-2xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {type}
                    {selectedType === type && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2 flex-1 md:flex-none">
              <Button
                variant="outline"
                onClick={() => setIsRegimeSortActive(!isRegimeSortActive)}
                className={cn(
                  "h-9 sm:h-10 px-3 sm:px-4 md:px-5 border-white/5 rounded-2xl gap-2 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest transition-all",
                  isRegimeSortActive
                    ? "bg-primary/10 border-primary/30 text-primary opacity-100 shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <Activity
                  className={cn(
                    "h-4 w-4 transition-transform duration-500 shrink-0",
                    isRegimeSortActive && "rotate-180",
                  )}
                />
                <span className="hidden sm:inline">Regime Sensitivity</span>
                <span className="sm:hidden">Regime</span>
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 sm:h-10 px-3 sm:px-4 md:px-5 bg-primary/5 hover:bg-primary/10 border-primary/20 transition-all rounded-2xl gap-2 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest flex-1"
                  >
                    <Activity className="h-4 w-4 text-primary" />
                    Market Context
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="h-[88dvh] sm:h-[84dvh] md:h-[82dvh] md:max-w-[72vw] lg:max-w-[68vw] xl:max-w-[62vw] md:mx-auto rounded-t-2xl sm:rounded-t-3xl border-t border-primary/30 p-0"
                >
                  <div className="sr-only">
                    <SheetHeader>
                      <SheetTitle>Market Context Deep Dive</SheetTitle>
                      <SheetDescription>
                        Comprehensive analysis of current market regime,
                        volatility, breadth and liquidity.
                      </SheetDescription>
                    </SheetHeader>
                  </div>
                  <div className="w-full mx-auto py-4 h-full overflow-y-auto will-change-scroll overscroll-contain scroll-smooth px-6">
                    {marketContext && (
                      <MarketContextPanel context={marketContext} />
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col gap-8 sm:gap-12 pb-6 z-10">
          {/* Plan-gated upgrade prompt (e.g. Crypto requires Elite) */}
          {isPlanGated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-3xl mx-auto py-4"
            >
              {successfulActionsCount < 2 && (
                <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Soft hint</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can continue with available assets first. Upgrade prompts become stronger after two successful actions (analysis + watchlist).
                  </p>
                </div>
              )}
              {/* Single unified card */}
              <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/80 backdrop-blur-xl shadow-[0_8px_60px_-12px_rgba(245,158,11,0.12)]">
                {/* Background glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/4 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-primary/3 rounded-full blur-[80px] pointer-events-none" />

                {/* Top section — hero */}
                <div className="relative px-4 sm:px-8 pt-6 sm:pt-10 pb-6 sm:pb-8 flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
                    className="relative mb-5"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                      <Crown className="h-6 w-6 text-primary" />
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary/90 border-2 border-background flex items-center justify-center shadow-lg shadow-primary/30">
                      <Lock className="h-2.5 w-2.5 text-black" />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="space-y-3"
                  >
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                      <span className="premium-gradient-text">
                        {selectedType === "CRYPTO" ? "Crypto Intelligence" : `${selectedType} Coverage`}
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                      {selectedType === "CRYPTO"
                        ? "On-chain data, DeFi metrics, and network signals across 50+ tokens."
                        : `Full ${selectedType.toLowerCase()} coverage with scoring, signals, and factor analysis.`}
                    </p>
                  </motion.div>
                </div>

                {/* Feature grid — inside the card */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  className="px-3 sm:px-6 pb-4 sm:pb-6"
                >
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { icon: <Globe className="h-3.5 w-3.5" />, label: "50+ Tokens" },
                      { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "On-Chain Data" },
                      { icon: <Shield className="h-3.5 w-3.5" />, label: "Risk Scoring" },
                      { icon: <Zap className="h-3.5 w-3.5" />, label: "Network Intel" },
                    ].map((feat) => (
                      <div
                        key={feat.label}
                        className="flex items-center gap-2.5 rounded-3xl border border-white/10 bg-background/30 px-3.5 py-2.5"
                      >
                        <div className="h-7 w-7 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                          {feat.icon}
                        </div>
                        <span className="text-[11px] font-bold text-foreground/80 tracking-tight">{feat.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Divider */}
                <div className="mx-4 sm:mx-8 border-t border-border/30" />

                {/* CTA section */}
                <motion.div
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                  className="px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                    <TrendingUp className="h-3 w-3" />
                    <span>Used daily by Pro and Elite subscribers</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedType("ALL")}
                      className="px-4 py-2.5 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
                    >
                      Go back
                    </button>
                    {successfulActionsCount >= 2 ? (
                      <Link
                        href="/dashboard/upgrade"
                        className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 group"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Upgrade to Elite</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ) : (
                      <div className="rounded-3xl border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Complete 2 actions to unlock stronger recommendations ({successfulActionsCount}/2)
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
          {/* Show loading indicator when switching filters and no groups visible */}
          {!isPlanGated && assets.length === 0 && isValidating && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40 mb-4" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Loading assets...
              </p>
            </div>
          )}
          {!isPlanGated && GROUP_ORDER.filter((g) => filteredGroups[g].length > 0).map(
            (group) => {
              const items = filteredGroups[group];
              return (
              <div key={group} className="space-y-4 sm:space-y-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 sm:gap-4 border-l-4 border-primary/40 pl-4 sm:pl-6 py-1 min-w-0">
                  <div className="min-w-0 flex-1 mt-1">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tighter uppercase truncate">
                      {group}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium mt-1">
                      {GROUP_PLAIN_ENGLISH[group as AssetGroup]}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 bg-card/40 backdrop-blur-2xl px-6 py-4 rounded-2xl border border-primary/10 w-full md:w-auto min-w-0 overflow-hidden">
                    <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em] leading-tight">
                      {GROUP_MESSAGES[group as AssetGroup][0]}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest leading-tight border-t border-primary/5 pt-2 mt-1">
                      {GROUP_MESSAGES[group as AssetGroup][1]}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((asset, idx) => (
                    <div 
                      key={asset.symbol}
                      className="animate-fade-in opacity-0"
                      style={{ animationDelay: `${Math.min(idx * 60, 600)}ms` }}
                    >
                    <MarketAssetCard
                      symbol={asset.symbol}
                      name={asset.name}
                      price={asset.price}
                      changePercent={asset.changePercent}
                      marketCap={asset.marketCap}
                      peRatio={asset.peRatio}
                      oneYearChange={asset.oneYearChange}
                      signals={asset.signals}
                      type={asset.type}
                      metadata={asset.metadata}
                      currency={asset.currency}
                      compatibilityScore={asset.compatibility?.score}
                      compatibilityLabel={asset.compatibility?.label}
                      sector={asset.sector}
                      dividendYield={asset.dividendYield}
                      fiftyTwoWeekHigh={asset.fiftyTwoWeekHigh}
                      fiftyTwoWeekLow={asset.fiftyTwoWeekLow}
                      fundHouse={asset.fundHouse}
                      schemeType={asset.schemeType}
                    />
                    </div>
                  ))}
                </div>
              </div>
              );
            },
          )}
          {!isPlanGated && assets.length === 0 && !isValidating && (
            <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-white/10 bg-card/70 py-20 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
              <Search className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                No assets found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try a ticker like AAPL, BTC or GOLD
              </p>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          <div
            ref={observerRef}
            className="h-20 flex items-center justify-center"
          >
            {isValidating && (
              <div className="flex items-center gap-2 opacity-40">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Loading assets...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footnote / Disclosure */}
        <div className="border-t border-border/30 pt-8 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-medium leading-relaxed max-w-4xl">
            <span className="font-bold text-foreground">
              Institutional Integrity Disclosure:
            </span>{" "}
            All market mappings, regime classifications and compatibility
            scores are generated through deterministic signal processing. These
            analysis layers are provided for interpretive context only and do
            not constitute investment advice, financial planning or specific
            security recommendations. Past performance attributes within
            specific regimes do not guarantee future alignment.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  </ErrorBoundary>
  );
}
