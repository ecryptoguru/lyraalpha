import useSWR from "swr";
import { useCallback, useMemo } from "react";

interface WatchlistAsset {
  symbol: string;
  name: string;
  type: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  region: string | null;
  marketCap: number | null;
  sector: string | null;
  scoreDynamics: Record<string, unknown> | null;
  compatibilityScore: number | null;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  region: string;
  note: string | null;
  createdAt: string;
  asset: WatchlistAsset;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to load watchlist");
  }
  return data;
};

export function useWatchlist(region?: string) {
  const url = region ? `/api/user/watchlist?region=${region}` : "/api/user/watchlist";

  const { data, error, isLoading, mutate } = useSWR<{ items: WatchlistItem[] }>(
    url,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const symbolSet = useMemo(() => new Set(items.map((i) => i.symbol)), [items]);

  const isWatchlisted = useCallback(
    (symbol: string) => symbolSet.has(symbol),
    [symbolSet],
  );

  const addToWatchlist = useCallback(
    async (symbol: string, assetRegion?: string) => {
      try {
        const res = await fetch("/api/user/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, region: assetRegion }),
        });
        if (!res.ok) throw new Error("Failed to add");
        await mutate();
        return true;
      } catch {
        return false;
      }
    },
    [mutate],
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
      try {
        const res = await fetch("/api/user/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (!res.ok) throw new Error("Failed to remove");
        await mutate();
        return true;
      } catch {
        return false;
      }
    },
    [mutate],
  );

  const toggleWatchlist = useCallback(
    async (symbol: string, assetRegion?: string) => {
      if (isWatchlisted(symbol)) {
        return removeFromWatchlist(symbol);
      }
      return addToWatchlist(symbol, assetRegion);
    },
    [isWatchlisted, addToWatchlist, removeFromWatchlist],
  );

  return {
    items,
    isLoading,
    error,
    isWatchlisted,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    mutate,
  };
}
