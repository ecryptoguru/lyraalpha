import type { PlanTier } from "@/lib/ai/config";

/** Normalize unknown/string plan values to a strict PlanTier. Safe to use on client and server.
 *  During Beta, all new signups are ELITE — so the default fallback is ELITE, not STARTER. */
export function normalizePlanTier(plan?: string | null): PlanTier {
  const normalized = String(plan || "ELITE").toUpperCase();
  if (normalized === "PRO") return "PRO";
  if (normalized === "ELITE") return "ELITE";
  if (normalized === "ENTERPRISE") return "ENTERPRISE";
  if (normalized === "STARTER") return "STARTER";
  return "ELITE";
}
