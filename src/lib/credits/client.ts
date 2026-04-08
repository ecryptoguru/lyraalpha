import { mutate } from "swr";
import type { DashboardPointsResponse } from "@/hooks/use-dashboard-points";

const CREDIT_SWr_KEYS = ["/api/points", "/api/user/credits", "/api/user/credits/balance", "/api/user/plan"] as const;

type CreditsApiResponse = {
  balance?: number;
  credits?: number;
};

function updateNumericField<T extends Record<string, unknown>>(
  current: T | undefined,
  field: keyof T,
  nextValue: number,
) {
  if (!current || typeof current[field] !== "number") return current;
  return {
    ...current,
    [field]: clampCredits(nextValue),
  };
}

function clampCredits(value: number): number {
  return Math.max(0, value);
}

export async function applyOptimisticCreditDelta(delta: number) {
  await Promise.all([
    mutate<DashboardPointsResponse>(
      "/api/points",
      (current) => {
        if (!current?.points || typeof current.points.credits !== "number") return current;
        return {
          ...current,
          points: {
            ...current.points,
            credits: clampCredits(current.points.credits + delta),
          },
        };
      },
      { revalidate: false },
    ),
    mutate<CreditsApiResponse>(
      "/api/user/credits",
      (current) => {
        if (!current || typeof current.balance !== "number") return current;
        return {
          ...current,
          balance: clampCredits(current.balance + delta),
        };
      },
      { revalidate: false },
    ),
    mutate<CreditsApiResponse>(
      "/api/user/credits/balance",
      (current) => {
        if (!current || typeof current.credits !== "number") return current;
        return {
          ...current,
          credits: clampCredits(current.credits + delta),
        };
      },
      { revalidate: false },
    ),
    mutate<{ credits?: number }>(
      "/api/user/plan",
      (current) => {
        if (!current || typeof current.credits !== "number") return current;
        return {
          ...current,
          credits: clampCredits(current.credits + delta),
        };
      },
      { revalidate: false },
    ),
  ]);
}

export async function setAuthoritativeCreditBalance(balance: number) {
  await Promise.all([
    mutate<DashboardPointsResponse>(
      "/api/points",
      (current) => {
        if (!current?.points || typeof current.points.credits !== "number") return current;
        return {
          ...current,
          points: {
            ...current.points,
            credits: clampCredits(balance),
          },
        };
      },
      { revalidate: false },
    ),
    mutate<CreditsApiResponse>("/api/user/credits", (current) => updateNumericField(current, "balance", balance), { revalidate: false }),
    mutate<CreditsApiResponse>("/api/user/credits/balance", (current) => updateNumericField(current, "credits", balance), { revalidate: false }),
    mutate<{ credits?: number }>("/api/user/plan", (current) => updateNumericField(current, "credits", balance), { revalidate: false }),
  ]);
}

export async function revalidateCreditViews() {
  await Promise.all(CREDIT_SWr_KEYS.map((key) => mutate(key)));
}

export async function applyOptimisticCreditsAndRevalidate(delta: number) {
  await applyOptimisticCreditDelta(delta);
  void revalidateCreditViews();
}
