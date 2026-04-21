import useSWR from "swr";

export type AdminUsageRange = "7d" | "30d" | "90d";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`Admin API error: ${r.status}`);
  return r.json();
});

const ADMIN_SWR_CONFIG = {
  revalidateOnFocus: false,
  refreshInterval: 60_000,
  dedupingInterval: 30_000,
};

export function useAdminOverview() {
  return useSWR("/api/admin/overview", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminRevenue() {
  return useSWR("/api/admin/revenue", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminAICosts() {
  return useSWR("/api/admin/ai-costs", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminUsage(range: AdminUsageRange = "30d") {
  return useSWR(`/api/admin/usage?range=${range}`, fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminEngines() {
  return useSWR("/api/admin/engines", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminRegime() {
  return useSWR("/api/admin/regime", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminInfrastructure() {
  return useSWR("/api/admin/infrastructure", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminUsers(page = 1, pageSize = 50) {
  return useSWR(`/api/admin/users?page=${page}&pageSize=${pageSize}`, fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminGrowth() {
  return useSWR("/api/admin/growth?range=30d", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminGrowthRange(range: AdminUsageRange = "30d") {
  return useSWR(`/api/admin/growth?range=${range}`, fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminBilling() {
  return useSWR("/api/admin/billing", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminMyra() {
  return useSWR("/api/admin/myra", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminCredits() {
  return useSWR("/api/admin/credits", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminWaitlist() {
  return useSWR("/api/admin/waitlist", fetcher, ADMIN_SWR_CONFIG);
}

export function useAdminCryptoData() {
  return useSWR("/api/admin/crypto-data", fetcher, ADMIN_SWR_CONFIG);
}

// Near-real-time runtime ops snapshot (daily cost burn, fallback mitigation,
// cron LLM hourly window). Refreshes faster than other admin widgets.
const ADMIN_OPS_SWR_CONFIG = {
  revalidateOnFocus: false,
  refreshInterval: 15_000,
  dedupingInterval: 5_000,
};

export function useAdminAIOps() {
  return useSWR("/api/admin/ai-ops", fetcher, ADMIN_OPS_SWR_CONFIG);
}
