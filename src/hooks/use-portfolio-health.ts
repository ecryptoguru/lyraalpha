"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/swr-fetcher";

export interface PortfolioHealthSnapshot {
  id: string;
  portfolioId: string;
  date: string;
  healthScore: number;
  diversificationScore: number;
  concentrationScore: number;
  volatilityScore: number;
  correlationScore: number;
  qualityScore: number;
  fragilityScore: number | null;
  riskMetrics: unknown;
  regime: string | null;
}

export type HealthBand = "Strong" | "Balanced" | "Fragile" | "High Risk";

export function getHealthBand(score: number): HealthBand {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Balanced";
  if (score >= 40) return "Fragile";
  return "High Risk";
}

export function getHealthBandColor(band: HealthBand): string {
  switch (band) {
    case "Strong":    return "text-success";
    case "Balanced":  return "text-warning";
    case "Fragile":   return "text-warning";
    case "High Risk": return "text-danger";
  }
}

export function usePortfolioHealth(portfolioId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{
    snapshot: PortfolioHealthSnapshot | null;
    message?: string;
  }>(
    portfolioId ? `/api/portfolio/${portfolioId}/health` : null,
    fetcher,
    { dedupingInterval: 60000, revalidateOnFocus: false },
  );

  const snapshot = data?.snapshot ?? null;
  const band = snapshot ? getHealthBand(snapshot.healthScore) : null;

  return {
    snapshot,
    band,
    bandColor: band ? getHealthBandColor(band) : null,
    isLoading,
    error,
    mutate,
  };
}

export function usePortfolioAnalytics(portfolioId: string | null) {
  const { data, error, isLoading } = useSWR<{
    analytics: PortfolioHealthSnapshot | null;
    plan: string;
    fragilityAvailable: boolean;
  }>(
    portfolioId ? `/api/portfolio/${portfolioId}/analytics` : null,
    fetcher,
    { dedupingInterval: 120000, revalidateOnFocus: false },
  );

  return {
    analytics: data?.analytics ?? null,
    plan: data?.plan ?? null,
    fragilityAvailable: data?.fragilityAvailable ?? false,
    isLoading,
    error,
  };
}
