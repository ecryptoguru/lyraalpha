/**
 * Credit guards for Lyra AI service.
 * Handles credit consumption checks and enterprise bypass logic.
 */

import { consumeCredits, getCreditCost } from "@/lib/services/credit.service";
import { createLogger } from "@/lib/logger";
import { UsageLimitError } from "../guardrails";
import type { LyraContext } from "@/lib/engines/types";

const logger = createLogger({ service: "lyra-credit-guard" });

export interface CreditCheckResult {
  success: boolean;
  remainingCredits: number | null;
  creditCost: number;
}

/**
 * Check and consume credits for a Lyra request.
 * Enterprise users and SKIP_CREDITS mode bypass credit checks.
 */
export async function checkAndConsumeCredits(
  userId: string,
  userPlan: string,
  tier: string,
  context: LyraContext,
): Promise<CreditCheckResult> {
  // Enterprise and SKIP_CREDITS bypass
  if (userPlan === "ENTERPRISE" || process.env.SKIP_CREDITS === "true") {
    return { success: true, remainingCredits: null, creditCost: 0 };
  }

  const isAssetPageQuery = context.symbol && context.symbol !== "GLOBAL";
  const creditCost = isAssetPageQuery ? 5 : getCreditCost(tier as "SIMPLE" | "MODERATE" | "COMPLEX");
  const costDescriptor = isAssetPageQuery ? "Lyra Asset Intel Query" : `${tier} query`;

  const { success, remaining } = await consumeCredits(userId, creditCost, costDescriptor);
  if (!success) {
    logger.warn({ userId, creditCost, remaining }, "Insufficient credits");
    throw new UsageLimitError(
      `Insufficient credits. You have ${remaining} credits. Upgrade or purchase more credits to continue.`,
      "credits",
    );
  }

  logger.debug({ creditCost, remaining }, "Credits consumed");
  return { success: true, remainingCredits: remaining, creditCost };
}

/**
 * Runtime safety guard for SKIP_CREDITS env var.
 * Bypasses all credit checks and daily token caps.
 * Throws in production to prevent accidental misconfiguration.
 */
export function validateSkipCreditsConfig(): void {
  if (process.env.SKIP_CREDITS === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: SKIP_CREDITS=true in PRODUCTION — all credit checks and daily token caps are DISABLED. " +
        "This must NEVER be enabled in production. Remove the env var to start the server.",
      );
    } else {
      logger.warn("SKIP_CREDITS=true — credit checks and daily token caps are bypassed (development only)");
    }
  }
}
