import { getUserCreditsReadOnly } from "@/lib/services/credit.service";
import { getUserPlan } from "./plan-gate";

/**
 * @deprecated Not used by any hot path — all credit checks go through
 * consumeCredits() in credit.service.ts directly. This module can be
 * removed once no external consumers remain.
 */

export interface CreditCheckResult {
  allowed: boolean;
  remaining: number;
  required: number;
  error?: string;
}

/** @deprecated Use consumeCredits() from credit.service.ts instead */
export async function checkCredits(userId: string, cost: number): Promise<CreditCheckResult> {
  const credits = await getUserCreditsReadOnly(userId);

  if (credits >= cost) {
    return { allowed: true, remaining: credits, required: cost };
  }

  return {
    allowed: false,
    remaining: credits,
    required: cost,
    error: `Insufficient credits. Need ${cost}, have ${credits}`,
  };
}

/** @deprecated Use consumeCredits() from credit.service.ts instead */
export function creditGate(cost: number) {
  return async (userId: string) => {
    const plan = await getUserPlan(userId);

    if (plan === "ELITE" || plan === "ENTERPRISE") {
      return { allowed: true, reason: "unlimited" };
    }

    return checkCredits(userId, cost);
  };
}
