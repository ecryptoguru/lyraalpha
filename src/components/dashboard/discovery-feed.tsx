"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Loader2,
  Zap,
} from "lucide-react";

import { DiscoveryFeedCard, type DiscoveryFeedItem } from "./discovery-feed-card";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { useRegion } from "@/lib/context/RegionContext";
import type { DiscoveryFeedResponse } from "@/lib/services/discovery-feed.service";
import { fetcher as sharedFetcher } from "@/lib/swr-fetcher";

const fetcher = (url: string): Promise<DiscoveryFeedResponse> =>
  sharedFetcher<DiscoveryFeedResponse>(url);

const TYPE_LABEL: Record<string, string> = {
  CRYPTO: "Crypto",
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
    <div className="flex items-center gap-2 rounded-2xl border border-warning/25 bg-warning/8 px-3.5 py-2.5 text-[11px] font-semibold text-warning">
      <Zap className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-bold">Momentum cluster detected</span>
        {" — "}{cluster.count} {TYPE_LABEL[cluster.type] ?? cluster.type} signals are firing simultaneously with high DRS scores.
      </span>
    </div>
  );
}

export function DiscoveryFeed({
  initialData,
  initialRegion,
}: {
  initialData?: DiscoveryFeedResponse;
  initialRegion?: "US" | "IN";
}) {
  const { region } = useRegion();
  const typeFilter = "crypto";
  const [offset, setOffset] = useState(0);
  const [prevItems, setPrevItems] = useState<DiscoveryFeedItem[]>([]);
  const [enableAutoLoad, setEnableAutoLoad] = useState(false);
  const limit = 20;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedOffsetRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ distanceFromBottom: number; heightBeforeLoad: number } | null>(null);

  const requestUrl = `/api/discovery/feed?region=${region}&type=${typeFilter}&limit=${limit}&offset=${offset}`;
  const shouldUseInitialData = offset === 0 && region === initialRegion;

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

  const handleLoadMore = useCallback(() => {
    if (!data?.hasMore || isLoading) return;
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
  }, [data?.hasMore, displayItems, getScrollContainer, isLoading, limit, offset]);

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
    if (!node || !enableAutoLoad || !data?.hasMore) return;

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
  }, [data?.hasMore, enableAutoLoad, getScrollContainer, handleLoadMore]);

  return (
    <div className="space-y-4 min-w-0 w-full overflow-x-hidden">

      {isLoading && !data ? (
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[220px] bg-card/60 backdrop-blur-2xl shadow-xl border border-border/20 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && displayItems.length > 0 ? (
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

      {!isLoading && displayItems.length === 0 ? (
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
  return formatRelativeTime(dateStr);
}
