/**
 * Guard modules for Lyra AI service.
 * Provides credit checks and daily token cap enforcement.
 */

export {
  checkAndConsumeCredits,
  validateSkipCreditsConfig,
  type CreditCheckResult,
} from "./credit-guard";

export {
  DAILY_TOKEN_CAPS_DEFAULTS,
  DAILY_TOKEN_CAPS_REDIS_KEY,
  getEffectiveDailyTokenCaps,
  incrementDailyTokens,
  getDailyTokensUsed,
  clearCapsCache,
} from "./token-cap";
