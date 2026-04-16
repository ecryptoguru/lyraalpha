"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { toast } from "sonner";
import type { Region } from "@/lib/context/RegionContext";
import type { BrokerNormalizationResult } from "@/lib/types/broker";

import { fetcher } from "@/lib/swr-fetcher";

type PortfolioDetailResponse = { success: boolean; data: { portfolio: PortfolioDetail } };

export interface PortfolioSummary {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  _count: { holdings: number };
  healthSnapshots: { healthScore: number; date: string }[];
}

export interface PortfolioHolding {
  id: string;
  portfolioId: string;
  assetId: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currency: string;
  addedAt: string;
  asset: {
    symbol: string;
    name: string;
    type: string;
    price: number | null;
    changePercent: number | null;
    currency: string | null;
    region: string | null;
    sector: string | null;
    avgTrendScore: number | null;
    avgMomentumScore: number | null;
    avgVolatilityScore: number | null;
    avgLiquidityScore: number | null;
    avgTrustScore: number | null;
    avgSentimentScore: number | null;
    compatibilityScore: number | null;
    compatibilityLabel: string | null;
  };
}

export interface PortfolioDetail extends PortfolioSummary {
  holdings: PortfolioHolding[];
  healthSnapshots: {
    healthScore: number;
    diversificationScore: number;
    concentrationScore: number;
    volatilityScore: number;
    correlationScore: number;
    qualityScore: number;
    fragilityScore: number | null;
    riskMetrics: unknown;
    regime: string | null;
    date: string;
  }[];
}

export function usePortfolios(region?: Region) {
  const url = region ? `/api/portfolio?region=${region}` : "/api/portfolio";
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: { portfolios: PortfolioSummary[] } }>(
    url,
    fetcher,
    { dedupingInterval: 60000, revalidateOnFocus: false },
  );

  return {
    portfolios: data?.data?.portfolios ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function usePortfolio(portfolioId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: { portfolio: PortfolioDetail } }>(
    portfolioId ? `/api/portfolio/${portfolioId}` : null,
    fetcher,
    { dedupingInterval: 30000, revalidateOnFocus: false },
  );

  return {
    portfolio: data?.data?.portfolio ?? null,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Build an optimistic PortfolioHolding row with server-unknown fields set to null.
 * The UI renders these as placeholders (e.g. "—" for price) until the server
 * response arrives and revalidation replaces this row with the authoritative one.
 */
function buildOptimisticHolding(
  portfolioId: string,
  body: { symbol: string; quantity: number; avgPrice: number },
  currency: string,
): PortfolioHolding {
  return {
    id: `pending-${Date.now()}-${body.symbol}`,
    portfolioId,
    assetId: "",
    symbol: body.symbol,
    quantity: body.quantity,
    avgPrice: body.avgPrice,
    currency,
    addedAt: new Date().toISOString(),
    asset: {
      symbol: body.symbol,
      name: body.symbol,
      type: "CRYPTO",
      price: null,
      changePercent: null,
      currency,
      region: null,
      sector: null,
      avgTrendScore: null,
      avgMomentumScore: null,
      avgVolatilityScore: null,
      avgLiquidityScore: null,
      avgTrustScore: null,
      avgSentimentScore: null,
      compatibilityScore: null,
      compatibilityLabel: null,
    },
  };
}

export function usePortfolioMutations() {
  const { mutate } = useSWRConfig();

  const createPortfolio = useCallback(
    async (body: { name: string; description?: string; currency: string; region: string }) => {
      try {
        const res = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to create portfolio");
        await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/portfolio"));
        return data;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create portfolio");
        throw err;
      }
    },
    [mutate],
  );

  const deletePortfolio = useCallback(
    async (portfolioId: string) => {
      try {
        const res = await fetch(`/api/portfolio/${portfolioId}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to delete portfolio");
        }
        await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/portfolio"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete portfolio");
        throw err;
      }
    },
    [mutate],
  );

  const addHolding = useCallback(
    async (portfolioId: string, body: { symbol: string; quantity: number; avgPrice: number }) => {
      const key = `/api/portfolio/${portfolioId}`;
      // Optimistic insert — user sees the row instantly. Server response replaces
      // the pending row with the authoritative one (including asset snapshot +
      // updated health scores) via the final revalidation.
      try {
        const result = await mutate<PortfolioDetailResponse>(
          key,
          async (current) => {
            const res = await fetch(`${key}/holdings`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to add holding");
            return current; // placeholder; we revalidate below to pull the real detail
          },
          {
            optimisticData: (current) => {
              if (!current?.data?.portfolio) return current as PortfolioDetailResponse;
              const optimistic = buildOptimisticHolding(portfolioId, body, current.data.portfolio.currency);
              return {
                ...current,
                data: {
                  portfolio: {
                    ...current.data.portfolio,
                    holdings: [...current.data.portfolio.holdings, optimistic],
                  },
                },
              };
            },
            rollbackOnError: true,
            revalidate: true,
            populateCache: false,
          },
        );
        return result;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add holding");
        throw err;
      }
    },
    [mutate],
  );

  const removeHolding = useCallback(
    async (portfolioId: string, holdingId: string) => {
      const key = `/api/portfolio/${portfolioId}`;
      try {
        await mutate<PortfolioDetailResponse>(
          key,
          async (current) => {
            const res = await fetch(`${key}/holdings/${holdingId}`, { method: "DELETE" });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error ?? "Failed to remove holding");
            }
            return current;
          },
          {
            optimisticData: (current) => {
              if (!current?.data?.portfolio) return current as PortfolioDetailResponse;
              return {
                ...current,
                data: {
                  portfolio: {
                    ...current.data.portfolio,
                    holdings: current.data.portfolio.holdings.filter((h) => h.id !== holdingId),
                  },
                },
              };
            },
            rollbackOnError: true,
            revalidate: true,
            populateCache: false,
          },
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove holding");
        throw err;
      }
    },
    [mutate],
  );

  const updateHolding = useCallback(
    async (
      portfolioId: string,
      holdingId: string,
      body: { quantity?: number; avgPrice?: number },
    ) => {
      const key = `/api/portfolio/${portfolioId}`;
      try {
        const result = await mutate<PortfolioDetailResponse>(
          key,
          async (current) => {
            const res = await fetch(`${key}/holdings/${holdingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to update holding");
            return current;
          },
          {
            optimisticData: (current) => {
              if (!current?.data?.portfolio) return current as PortfolioDetailResponse;
              return {
                ...current,
                data: {
                  portfolio: {
                    ...current.data.portfolio,
                    holdings: current.data.portfolio.holdings.map((h) =>
                      h.id === holdingId
                        ? {
                            ...h,
                            quantity: body.quantity ?? h.quantity,
                            avgPrice: body.avgPrice ?? h.avgPrice,
                          }
                        : h,
                    ),
                  },
                },
              };
            },
            rollbackOnError: true,
            revalidate: true,
            populateCache: false,
          },
        );
        return result;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update holding");
        throw err;
      }
    },
    [mutate],
  );

  const importBrokerSnapshot = useCallback(
    async (
      portfolioId: string,
      snapshot: BrokerNormalizationResult,
      replaceExisting = false,
    ) => {
      try {
        const res = await fetch(`/api/portfolio/${portfolioId}/broker/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot, replaceExisting }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to import broker snapshot");

        // Broker import triggers server-side recomputation of health + holdings —
        // revalidate both in parallel so the UI refreshes in a single render pass.
        await Promise.all([
          mutate(`/api/portfolio/${portfolioId}`),
          mutate(`/api/portfolio/${portfolioId}/health`),
        ]);
        return data;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to import broker snapshot");
        throw err;
      }
    },
    [mutate],
  );

  return { createPortfolio, deletePortfolio, addHolding, removeHolding, updateHolding, importBrokerSnapshot };
}
