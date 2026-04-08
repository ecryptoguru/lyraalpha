"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
    },
  );

  return {
    driftCount: data?.driftCount ?? 0,
    isLoading,
  };
}
