import { getUserCreditsReadOnly } from "@/lib/services/credit.service";
import { getUserPlan } from "./plan-gate";

export interface CreditCheckResult {
  allowed: boolean;
  remaining: number;
  required: number;
  error?: string;
}

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

export { consumeCredits } from "@/lib/services/credit.service";

export function creditGate(cost: number) {
  return async (userId: string) => {
    const plan = await getUserPlan(userId);

    if (plan === "ELITE" || plan === "ENTERPRISE") {
      return { allowed: true, reason: "unlimited" };
    }

    return checkCredits(userId, cost);
  };
}
