"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  BarChart3,
  Crown,
  Filter,
  Globe,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { DiscoveryFeedCard, type DiscoveryFeedItem } from "./discovery-feed-card";
import { usePlan } from "@/hooks/use-plan";
import { useRegion } from "@/lib/context/RegionContext";
import type { DiscoveryFeedResponse } from "@/lib/services/discovery-feed.service";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  STOCK: "Stocks",
  ETF: "ETFs",
  CRYPTO: "Crypto",
  COMMODITY: "Commodities",
  MUTUAL_FUND: "Mutual Funds",
};

function SignalClusterBanner({ items }: { items: DiscoveryFeedItem[] }) {
  const cluster = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of items) {
      if (!item.locked && item.drs >= 65) {
        groups[item.type] = (groups[item.type] ?? 0) + 1;
      }
    }
    const qualifying = Object.entries(groups).filter(([, count]) => count >= 3);
    if (!qualifying.length) return null;
    const [type, count] = qualifying.reduce((best, cur) => cur[1] > best[1] ? cur : best);
    return { type, count };
  }, [items]);

  if (!cluster) return null;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 text-[11px] font-semibold text-amber-400">
      <Zap className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-bold">Momentum cluster detected</span>
        {" — "}{cluster.count} {TYPE_LABEL[cluster.type] ?? cluster.type} signals are firing simultaneously with high DRS scores.
      </span>
    </div>
  );
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Discovery feed error: ${res.status}`);
  return res.json() as Promise<DiscoveryFeedResponse>;
};

const TYPE_FILTERS = [
  { key: "all", label: "All Assets" },
  { key: "stock", label: "Stocks" },
  { key: "etf", label: "ETFs" },
  { key: "crypto", label: "Crypto" },
  { key: "commodity", label: "Commodities" },
  { key: "mf", label: "Mutual Fund" },
] as const;

export function DiscoveryFeed({
  initialData,
  initialTypeFilter = "all",
  initialRegion,
}: {
  initialData?: DiscoveryFeedResponse;
  initialTypeFilter?: string;
  initialRegion?: "US" | "IN";
}) {
  const { region } = useRegion();
  const { isElite } = usePlan();
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  const [showUpgradeCard, setShowUpgradeCard] = useState(false);
  const [offset, setOffset] = useState(0);
  const [prevItems, setPrevItems] = useState<DiscoveryFeedItem[]>([]);
  const [enableAutoLoad, setEnableAutoLoad] = useState(false);
  const limit = 20;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedOffsetRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ distanceFromBottom: number; heightBeforeLoad: number } | null>(null);

  const requestUrl = `/api/discovery/feed?region=${region}&type=${typeFilter}&limit=${limit}&offset=${offset}`;
  const shouldUseInitialData = offset === 0 && region === initialRegion && typeFilter === initialTypeFilter;

  const { data, isLoading } = useSWR<DiscoveryFeedResponse>(requestUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnMount: false,
    dedupingInterval: 10_000,
    keepPreviousData: true,
    fallbackData: shouldUseInitialData ? initialData : undefined,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enable = () => setEnableAutoLoad(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(enable, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(enable, 900);
    return () => clearTimeout(timeoutId);
  }, []);

  const availableTypeFilters = useMemo(() => {
    const available = data?.availableTypes ?? {};
    return TYPE_FILTERS.filter((filter) => {
      if (filter.key === "all") return true;
      if (filter.key === "crypto" && region === "US") return true;
      const mapped = filter.key === "mf" ? "MUTUAL_FUND" : filter.key.toUpperCase();
      return (available[mapped] ?? 0) > 0;
    });
  }, [data?.availableTypes, region]);

  const effectiveTypeFilter = availableTypeFilters.some((filter) => filter.key === typeFilter)
    ? typeFilter
    : "all";

  const getScrollContainer = useCallback(() => {
    if (scrollContainerRef.current) return scrollContainerRef.current;

    const container = loadMoreRef.current?.closest('[data-slot="sidebar-inset"]');
    if (container instanceof HTMLElement) {
      scrollContainerRef.current = container;
      return container;
    }

    const fallback = document.querySelector('[data-slot="sidebar-inset"]');
    if (fallback instanceof HTMLElement) {
      scrollContainerRef.current = fallback;
      return fallback;
    }

    return null;
  }, []);

  const displayItems = useMemo(() => {
    if (!data?.items) return prevItems;
    if (offset === 0) return data.items;

    const existingIds = new Set(prevItems.map((item) => item.id));
    const newItems = data.items.filter((item) => !existingIds.has(item.id));
    return [...prevItems, ...newItems];
  }, [data, offset, prevItems]);

  const resetFeedState = useCallback((nextTypeFilter: string) => {
    lastRequestedOffsetRef.current = null;
    pendingScrollRestoreRef.current = null;
    setOffset(0);
    setPrevItems([]);
    setTypeFilter(nextTypeFilter);
  }, []);

  const handleFilterChange = useCallback((key: string) => {
    if (key === "crypto" && !isElite) {
      setShowUpgradeCard(true);
      resetFeedState(key);
      return;
    }

    setShowUpgradeCard(false);
    resetFeedState(key);
  }, [isElite, resetFeedState]);

  const handleLoadMore = useCallback(() => {
    if (!data?.hasMore || isLoading || showUpgradeCard) return;
    if (pendingScrollRestoreRef.current) return; // don't load while restoring scroll

    const nextOffset = offset + limit;
    if (lastRequestedOffsetRef.current === nextOffset) return;

    const scrollContainer = getScrollContainer();
    if (scrollContainer) {
      pendingScrollRestoreRef.current = {
        distanceFromBottom:
          scrollContainer.scrollHeight - (scrollContainer.scrollTop + scrollContainer.clientHeight),
        heightBeforeLoad: scrollContainer.scrollHeight,
      };
    }

    lastRequestedOffsetRef.current = nextOffset;
    setPrevItems(displayItems);
    setOffset(nextOffset);
  }, [data?.hasMore, displayItems, getScrollContainer, isLoading, limit, offset, showUpgradeCard]);

  useEffect(() => {
    if (offset === 0) {
      lastRequestedOffsetRef.current = null;
      pendingScrollRestoreRef.current = null;
    }
  }, [offset, region, typeFilter]);

  useEffect(() => {
    if (!pendingScrollRestoreRef.current || isLoading || offset === 0) return;

    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    const { distanceFromBottom, heightBeforeLoad } = pendingScrollRestoreRef.current;

    const applyRestore = () => {
      const gained = scrollContainer.scrollHeight - heightBeforeLoad;
      if (gained <= 0) return; // new items not yet painted
      pendingScrollRestoreRef.current = null;
      const nextScrollTop =
        scrollContainer.scrollHeight - scrollContainer.clientHeight - distanceFromBottom;
      scrollContainer.scrollTop = Math.max(0, nextScrollTop);
    };

    // Fast path: items already in DOM by the time effect runs
    if (scrollContainer.scrollHeight > heightBeforeLoad) {
      applyRestore();
      return;
    }

    // Slow path: wait until container grows (ResizeObserver)
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (scrollContainer.scrollHeight > heightBeforeLoad) {
          ro.disconnect();
          applyRestore();
        }
      });
      ro.observe(scrollContainer);
      const timeout = setTimeout(() => {
        ro.disconnect();
        pendingScrollRestoreRef.current = null;
      }, 2000);
      return () => { ro.disconnect(); clearTimeout(timeout); };
    }

    // Fallback for environments without ResizeObserver
    requestAnimationFrame(() => {
      applyRestore();
      pendingScrollRestoreRef.current = null;
    });
  }, [data, displayItems.length, getScrollContainer, isLoading, offset]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !enableAutoLoad || showUpgradeCard || !data?.hasMore) return;

    const scrollContainer = getScrollContainer();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: scrollContainer,
        rootMargin: "200px 0px 200px 0px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [data?.hasMore, enableAutoLoad, getScrollContainer, handleLoadMore, showUpgradeCard]);

  return (
    <div className="space-y-4 min-w-0 w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 min-w-0 w-full">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 w-full max-w-full">
          <Filter className="h-3 w-3 text-muted-foreground/70 dark:text-muted-foreground/40 shrink-0" />
          {availableTypeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => handleFilterChange(filter.key)}
              className={cn(
                "px-3 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border min-h-[38px]",
                effectiveTypeFilter === filter.key
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card/40 border-border/45 text-muted-foreground/85 dark:bg-card/60 backdrop-blur-2xl shadow-xl dark:border-border/30 dark:text-muted-foreground hover:text-muted-foreground hover:border-border/70 dark:hover:border-border/60",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {showUpgradeCard ? (
        <div className="w-full max-w-3xl mx-auto py-2 animate-in fade-in duration-500">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/80 backdrop-blur-xl shadow-[0_8px_60px_-12px_rgba(245,158,11,0.12)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/4 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-primary/3 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative px-8 pt-10 pb-8 flex flex-col items-center text-center">
              <div className="relative mb-5 animate-in fade-in zoom-in-90 duration-400 delay-150 fill-mode-both">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary/90 border-2 border-background flex items-center justify-center shadow-lg shadow-primary/30">
                  <Lock className="h-2.5 w-2.5 text-black" />
                </div>
              </div>

              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-200 fill-mode-both">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                  <span className="premium-gradient-text">Crypto Intelligence</span>
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                  Institutional-grade crypto analysis with on-chain data, DeFi metrics and network intelligence across 50+ tokens.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-300 fill-mode-both">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { icon: <Globe className="h-3.5 w-3.5" />, label: "50+ Tokens" },
                  { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "On-Chain Data" },
                  { icon: <Shield className="h-3.5 w-3.5" />, label: "Risk Scoring" },
                  { icon: <Zap className="h-3.5 w-3.5" />, label: "Network Intel" },
                ].map((feature) => (
                  <div
                    key={feature.label}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-card/80 border border-white/5"
                  >
                    <div className="h-7 w-7 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                      {feature.icon}
                    </div>
                    <span className="text-[11px] font-bold text-foreground/80 tracking-tight">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-8 border-t border-border/30" />

            <div className="px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-400 fill-mode-both">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest">
                <TrendingUp className="h-3 w-3" />
                <span>Most popular upgrade for active traders</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgradeCard(false);
                    resetFeedState("all");
                  }}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
                >
                  Go back
                </button>
                <Link
                  href="/dashboard/upgrade"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 group"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Upgrade to Elite</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!showUpgradeCard && isLoading && !data ? (
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[220px] bg-card/60 backdrop-blur-2xl shadow-xl border border-border/20 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : null}

      {!showUpgradeCard && !isLoading && displayItems.length > 0 ? (
        <>
          <SignalClusterBanner items={displayItems} />
          <div className="flex items-center gap-4 text-[9px] font-bold text-muted-foreground/70 dark:text-muted-foreground/40 uppercase tracking-widest">
            <span>{data?.total ?? displayItems.length} signals detected</span>
            <span>•</span>
            <span>Showing {displayItems.length}</span>
            {displayItems[0]?.computedAt ? (
              <>
                <span>•</span>
                <span>Updated {formatTimeAgo(displayItems[0].computedAt)}</span>
              </>
            ) : null}
          </div>

          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-0 w-full">
            {displayItems.map((item) => (
              <DiscoveryFeedCard key={item.id} item={item} />
            ))}
          </div>

          {(data?.hasMore || isLoading) && enableAutoLoad ? (
            <div className="flex justify-center pt-4">
              <div
                ref={loadMoreRef}
                className="flex min-h-12 min-w-52 items-center justify-center rounded-2xl border border-border/45 bg-card/40 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/85 backdrop-blur-2xl shadow-xl dark:border-border/30 dark:bg-card/60 dark:text-muted-foreground"
              >
                <span>{data?.hasMore ? "Loading more signals automatically" : "Loading signals"}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!showUpgradeCard && !isLoading && displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="h-16 w-16 rounded-full bg-card/60 backdrop-blur-2xl shadow-xl border border-border/20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-muted-foreground/45 dark:text-muted-foreground/20" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground/80 dark:text-muted-foreground uppercase tracking-widest">
              Discovery Feed Warming Up
            </p>
            <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground/40 max-w-sm leading-relaxed">
              The Discovery Relevance Score engine needs at least one sync cycle to compute signals.
              Run a market sync to populate the feed.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}
