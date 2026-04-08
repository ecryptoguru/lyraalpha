"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import type { Region } from "@/lib/context/RegionContext";
import type { BrokerNormalizationResult } from "@/lib/types/broker";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

export function usePortfolioMutations() {
  const { mutate } = useSWRConfig();

  const createPortfolio = useCallback(
    async (body: { name: string; description?: string; currency: string; region: string }) => {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to create portfolio");
      await mutate((key: string) => typeof key === "string" && key.startsWith("/api/portfolio"));
      return data;
    },
    [mutate],
  );

  const deletePortfolio = useCallback(
    async (portfolioId: string) => {
      const res = await fetch(`/api/portfolio/${portfolioId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete portfolio");
      }
      await mutate((key: string) => typeof key === "string" && key.startsWith("/api/portfolio"));
    },
    [mutate],
  );

  const addHolding = useCallback(
    async (portfolioId: string, body: { symbol: string; quantity: number; avgPrice: number }) => {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to add holding");
      await mutate(`/api/portfolio/${portfolioId}`);
      return data;
    },
    [mutate],
  );

  const removeHolding = useCallback(
    async (portfolioId: string, holdingId: string) => {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings/${holdingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to remove holding");
      }
      await mutate(`/api/portfolio/${portfolioId}`);
    },
    [mutate],
  );

  const updateHolding = useCallback(
    async (
      portfolioId: string,
      holdingId: string,
      body: { quantity?: number; avgPrice?: number },
    ) => {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings/${holdingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to update holding");
      await mutate(`/api/portfolio/${portfolioId}`);
      return data;
    },
    [mutate],
  );

  const importBrokerSnapshot = useCallback(
    async (
      portfolioId: string,
      snapshot: BrokerNormalizationResult,
      replaceExisting = false,
    ) => {
      const res = await fetch(`/api/portfolio/${portfolioId}/broker/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, replaceExisting }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to import broker snapshot");

      await mutate(`/api/portfolio/${portfolioId}`);
      await mutate(`/api/portfolio/${portfolioId}/health`);
      return data;
    },
    [mutate],
  );

  return { createPortfolio, deletePortfolio, addHolding, removeHolding, updateHolding, importBrokerSnapshot };
}
