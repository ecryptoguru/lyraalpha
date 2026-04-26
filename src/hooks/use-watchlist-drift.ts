"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/swr-fetcher";

/**
 * Returns the count of watchlist assets whose regime compatibility
 * score has dropped below 40 (misaligned / drifting).
 */
export function useWatchlistDrift() {
  const { data, isLoading } = useSWR<{ driftCount: number }>(
    "/api/user/watchlist/drift-alert",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
      keepPreviousData: true,
    },
  );

  return {
    driftCount: data?.driftCount ?? 0,
    isLoading,
  };
}
