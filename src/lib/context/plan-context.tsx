"use client";

import { createContext, useContext, useCallback, useSyncExternalStore } from "react";
import useSWR from "swr";
import type { PlanTier } from "@/lib/ai/config";
import { normalizePlanTier } from "@/lib/utils/plan";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const noop = () => {};
const subscribe = () => noop;
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface PlanContextValue {
  plan: PlanTier;
  isLoading: boolean;
  revalidate: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({
  plan: initialPlan,
  children,
}: {
  plan: PlanTier;
  children: React.ReactNode;
}) {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const { data, isLoading, mutate } = useSWR<{ plan: PlanTier }>(
    mounted ? "/api/user/plan" : null,
    fetcher,
    {
      fallbackData: { plan: initialPlan },
      refreshInterval: 5 * 60_000,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  const plan = normalizePlanTier(data?.plan ?? initialPlan);

  const revalidate = useCallback(() => {
    void mutate();
  }, [mutate]);

  return (
    <PlanContext.Provider value={{ plan, isLoading: mounted ? isLoading : false, revalidate }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlanContext() {
  return useContext(PlanContext);
}
