import type { PlanTier } from "@/lib/ai/config";

/** Normalize unknown/string plan values to a strict PlanTier. Safe to use on client and server. */
export function normalizePlanTier(plan?: string | null): PlanTier {
  const normalized = String(plan || "STARTER").toUpperCase();
  if (normalized === "PRO") return "PRO";
  if (normalized === "ELITE") return "ELITE";
  if (normalized === "ENTERPRISE") return "ENTERPRISE";
  return "STARTER";
}
