import useSWR from "swr";
import { useMounted } from "@/hooks/use-mounted";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard points");
  }
  return response.json() as Promise<DashboardPointsResponse>;
};

export interface DashboardPointsRedemption {
  type: string;
  alreadyRedeemed?: boolean;
}

export interface DashboardPoints {
  credits: number;
  xp: number;
  level: number;
  tierName: string;
  tierEmoji: string;
  multiplier?: number;
  progressPercent: number;
  xpInCurrentLevel?: number;
  xpNeededForNext?: number;
  isMaxLevel?: boolean;
  totalCreditsEarned?: number;
  referralCreditsEarned?: number;
  weeklyXp?: number;
  streak?: number;
  redemptions?: DashboardPointsRedemption[];
}

export interface DashboardPointHistoryItem {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface DashboardRedemptionOption {
  type: string;
  name: string;
  xpCost: number;
  credits: number;
  plan?: string;
  trialDays?: number;
}

export interface DashboardPointsResponse {
  points?: DashboardPoints;
  history?: DashboardPointHistoryItem[];
  redemptionOptions?: DashboardRedemptionOption[];
  error?: string;
}

interface UseDashboardPointsOptions {
  enabled?: boolean;
  revalidateOnFocus?: boolean;
}

export function useDashboardPoints(options: UseDashboardPointsOptions = {}) {
  const { enabled = true, revalidateOnFocus = false } = options;
  const mounted = useMounted();

  const swr = useSWR<DashboardPointsResponse>(
    mounted && enabled ? "/api/points" : null,
    fetcher,
    {
      revalidateOnFocus,
      focusThrottleInterval: 30000,
      dedupingInterval: 5000,
      keepPreviousData: true,
    },
  );

  return {
    ...swr,
    mounted,
    points: swr.data?.points ?? null,
    history: swr.data?.history ?? [],
    redemptionOptions: swr.data?.redemptionOptions ?? [],
  };
}
