"use client";

import useSWR from "swr";
import type { PlanTier } from "@/lib/ai/config";
import { usePlanContext } from "@/lib/context/plan-context";
import { normalizePlanTier } from "@/lib/utils/plan";

import { fetcher } from "@/lib/swr-fetcher";

interface UsePlanReturn {
  plan: PlanTier;
  isElite: boolean;
  isPro: boolean;
  isStarter: boolean;
  isLoading: boolean;
  revalidate: () => void;
}

export function usePlan(): UsePlanReturn {
  const context = usePlanContext();

  // If inside PlanProvider (dashboard), use context — it already polls /api/user/plan every 60s.
  // If outside PlanProvider (e.g. landing page components), fall back to a direct SWR fetch.
  const { data, isLoading: swrLoading, mutate } = useSWR<{ plan: PlanTier }>(
    context ? null : "/api/user/plan",
    fetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false },
  );

  const plan: PlanTier = context
    ? context.plan
    : normalizePlanTier(data?.plan);

  const isLoading = context ? context.isLoading : swrLoading;
  const revalidate = context ? context.revalidate : () => { void mutate(); };

  return {
    plan,
    isElite: plan === "ELITE" || plan === "ENTERPRISE",
    isPro: plan === "PRO",
    isStarter: plan === "STARTER",
    isLoading,
    revalidate,
  };
}
