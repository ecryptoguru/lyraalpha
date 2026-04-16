import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr-fetcher";

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
      // Optimistic update — flip the star instantly, rollback on failure.
      // SWR mutate with { revalidate: false } suppresses the background refetch while
      // the request is in flight; we revalidate at the end to pick up server-computed
      // fields (e.g. asset snapshot).
      const optimisticItem: WatchlistItem = {
        id: `pending-${symbol}`,
        userId: "",
        assetId: "",
        symbol,
        region: assetRegion ?? "US",
        note: null,
        createdAt: new Date().toISOString(),
        asset: {
          symbol,
          name: symbol,
          type: "CRYPTO",
          price: null,
          changePercent: null,
          currency: null,
          region: assetRegion ?? null,
          marketCap: null,
          sector: null,
          scoreDynamics: null,
          compatibilityScore: null,
        },
      };
      const rollbackSnapshot = data;
      void mutate(
        (current) =>
          current
            ? { items: [...current.items, optimisticItem] }
            : { items: [optimisticItem] },
        { revalidate: false },
      );
      try {
        const res = await fetch("/api/user/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, region: assetRegion }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to add to watchlist");
        }
        await mutate(); // pull the real row (with server-assigned id + asset snapshot)
        return true;
      } catch (err) {
        // Rollback on failure so the UI stays consistent with the server state.
        void mutate(rollbackSnapshot, { revalidate: true });
        toast.error(err instanceof Error ? err.message : "Failed to add to watchlist");
        return false;
      }
    },
    [mutate, data],
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
      const rollbackSnapshot = data;
      void mutate(
        (current) =>
          current
            ? { items: current.items.filter((i) => i.symbol !== symbol) }
            : { items: [] },
        { revalidate: false },
      );
      try {
        const res = await fetch("/api/user/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to remove from watchlist");
        }
        await mutate();
        return true;
      } catch (err) {
        void mutate(rollbackSnapshot, { revalidate: true });
        toast.error(err instanceof Error ? err.message : "Failed to remove from watchlist");
        return false;
      }
    },
    [mutate, data],
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
