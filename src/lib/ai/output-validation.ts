/**
 * H6: Post-stream output validation
 *
 * Runs AFTER the LLM stream finishes to validate the response structure.
 * Non-blocking: logs warnings but never blocks the user from receiving the response.
 *
 * Validation rules:
 * - Tier-aware section presence checks (e.g., STARTER SIMPLE requires 4 sections)
 * - Follow-up question count limits (prevents excessive follow-ups)
 * - JSON schema validation for tool outputs (when tools are activated)
 * - No strict JSON schema validation for natural language responses
 */

import { createLogger } from "@/lib/logger";
import { recordValidationResult } from "./alerting";
import { z } from "zod";

const logger = createLogger({ service: "output-validation" });

export interface OutputValidationResult {
  valid: boolean;
  missingSections: string[];
  followUpCount: number;
  wordCount: number;
  tier: string;
  plan: string;
}

// ─── Expected sections per plan/tier ───────────────────────────────────────
// Educational and very short responses are exempt from structural checks.
const STARTER_SIMPLE_SECTIONS = ["## Bottom Line", "## What the Scores Tell Us", "## The Risk You Should Know"];
const STARTER_MODERATE_SECTIONS = [...STARTER_SIMPLE_SECTIONS, "## How It's Been Moving"];
const STARTER_COMPLEX_SECTIONS = [...STARTER_SIMPLE_SECTIONS, "## How the Pieces Fit Together"];

// PRO sections — proFormatFull() structure
const ASSET_SIMPLE_SECTIONS = ["## Bottom Line", "## The Signal Story", "## The Risk Vector"];
const ASSET_MODERATE_SECTIONS = [
  "## Bottom Line",
  "## The Signal Story",
  "## The Risk Vector",
  "## Business & Growth",
  "## Valuation Insight",
  // NOTE: "## Performance Context" is omitted for CRYPTO-only MODERATE queries
  // to avoid false-positive missing-section warnings.
];
const ASSET_COMPLEX_SECTIONS = [
  "## Bottom Line",
  "## The Signal Story",
  "## The Risk Vector",
  "## Business & Growth",
  "## Valuation Insight",
  "## Signal Layer Breakdown",
];

// Elite/Enterprise sections — eliteFormatFull() structure
const ELITE_ASSET_SIMPLE_SECTIONS = ["## Executive Summary", "## Factor Synthesis", "## Monitoring Checklist"];
const ELITE_ASSET_MODERATE_SECTIONS = [
  "## Executive Summary",
  "## Business & Growth",
  "## Valuation Insight",
  "## Risk Vector",
  "## Useful Supporting Data",
  "## Monitoring Checklist",
];
const ELITE_ASSET_COMPLEX_SECTIONS = [
  "## Executive Summary",
  "## Factor Synthesis",
  "## Probabilistic Outlook",
  "## Monitoring Checklist",
];

// Global/macro queries use a different structure
const GLOBAL_SECTIONS = ["## Market Pulse", "## Crypto Sector View", "## Key Risks", "## What to Watch"];

// Follow-up rules: format instructions require exactly 3
const EXPECTED_FOLLOW_UP_COUNT = 3;
const FOLLOW_UP_HEADER = "## Follow-up Questions";

// Modes that use non-standard section structures — skip validation
const EXEMPT_MODES = new Set(["compare", "stress-test", "portfolio"]);

/**
 * Validate LLM output structure after stream consumption.
 * Returns a result object; never throws.
 *
 * @param text       Full streamed response text
 * @param tier       SIMPLE | MODERATE | COMPLEX
 * @param plan       STARTER | PRO | ELITE | ENTERPRISE
 * @param isEducational  Whether the query was classified as educational
 * @param responseMode   compare | stress-test | portfolio | standard | etc.
 * @param assetType  GLOBAL | CRYPTO | etc.
 */
export function validateOutput(
  text: string,
  tier: string,
  plan: string,
  isEducational: boolean,
  responseMode: string | undefined,
  assetType: string,
): OutputValidationResult {
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Skip structural checks for cases where non-standard output is expected
  if (isEducational || !text || text.length < 100) {
    return { valid: true, missingSections: [], followUpCount: 0, wordCount, tier, plan };
  }

  // Skip for multi-asset modes that use entirely different structures
  if (responseMode && EXEMPT_MODES.has(responseMode)) {
    return { valid: true, missingSections: [], followUpCount: 0, wordCount, tier, plan };
  }

  // Determine expected sections.
  const isGlobal = assetType === "GLOBAL";
  let fullExpected: string[];

  if (isGlobal) {
    fullExpected = [...GLOBAL_SECTIONS];
    if (tier === "COMPLEX" && (plan === "ELITE" || plan === "ENTERPRISE")) {
      fullExpected.push("## On-Chain & Cross-Asset Signals");
    }
  } else if (plan === "STARTER") {
    fullExpected = tier === "MODERATE"
      ? [...STARTER_MODERATE_SECTIONS]
      : tier === "COMPLEX"
        ? [...STARTER_COMPLEX_SECTIONS]
        : [...STARTER_SIMPLE_SECTIONS];
  } else if (plan === "ELITE" || plan === "ENTERPRISE") {
    fullExpected = tier === "COMPLEX"
      ? [...ELITE_ASSET_COMPLEX_SECTIONS]
      : tier === "MODERATE"
        ? [...ELITE_ASSET_MODERATE_SECTIONS]
        : [...ELITE_ASSET_SIMPLE_SECTIONS];
  } else {
    // PRO
    fullExpected = tier === "COMPLEX"
      ? [...ASSET_COMPLEX_SECTIONS]
      : tier === "MODERATE"
        ? [...ASSET_MODERATE_SECTIONS]
        : [...ASSET_SIMPLE_SECTIONS];
  }

  // Check section presence (case-insensitive substring match for robustness)
  const textLower = text.toLowerCase();
  const missingSections = fullExpected.filter(
    (section) => !textLower.includes(section.toLowerCase()),
  );

  // Count follow-up questions (all tiers require exactly 3)
  let followUpCount = 0;
  const followUpIdx = textLower.indexOf(FOLLOW_UP_HEADER.toLowerCase());
  if (followUpIdx !== -1) {
    // R6: Slice to 400 chars max after the header — prevents overcounting if the model
    // produces additional content (e.g. a disclaimer note) after the follow-up questions.
    // 400 chars safely fits 3 questions × ~100 chars each plus header padding.
    const afterFollowUp = text.slice(followUpIdx + FOLLOW_UP_HEADER.length, followUpIdx + FOLLOW_UP_HEADER.length + 400);
    // Count lines that start with a number (1. 2. 3.)
    followUpCount = (afterFollowUp.match(/^\s*\d+[.)]/gm) || []).length;
  }

  const valid = missingSections.length === 0;
  return { valid, missingSections, followUpCount, wordCount, tier, plan };
}

/**
 * Log validation results. Only emits warnings when issues are detected.
 * Never emits for clean passes to keep log noise minimal.
 */
export function logValidationResult(result: OutputValidationResult): void {
  // OBS-1: Feed the sliding window counter for the validation failure rate alert.
  recordValidationResult(result.valid).catch((e: unknown) => {
    logger.debug({ err: e }, "recordValidationResult failed");
  });

  if (result.missingSections.length > 0) {
    logger.warn(
      {
        event: "output_validation_missing_sections",
        tier: result.tier,
        plan: result.plan,
        missingSections: result.missingSections,
        wordCount: result.wordCount,
      },
      `LLM output missing ${result.missingSections.length} expected section(s)`,
    );
  }

  // Follow-up count check — all tiers require exactly 3
  if (result.followUpCount > 0 && result.followUpCount !== EXPECTED_FOLLOW_UP_COUNT) {
    logger.warn(
      {
        event: "output_validation_followup_count",
        tier: result.tier,
        plan: result.plan,
        expected: EXPECTED_FOLLOW_UP_COUNT,
        actual: result.followUpCount,
      },
      `Follow-up question count mismatch: expected ${EXPECTED_FOLLOW_UP_COUNT}, got ${result.followUpCount}`,
    );
  }
}

/**
 * Validate tool output against a Zod schema.
 * Used when tools are activated to ensure structured outputs match expected format.
 * Returns validation result with parsed data or error details.
 */
export function validateToolOutput<T>(
  output: unknown,
  schema: z.ZodSchema<T>,
): { success: boolean; data?: T; error?: string } {
  try {
    const parsed = schema.parse(output);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map((e) =>
        `${Array.isArray(e.path) ? e.path.join(".") : String(e.path)}: ${e.message}`
      ).join(", ");
      return { success: false, error: errorDetails };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

// ─── Myra output validation ──────────────────────────────────────────────────
// Lightweight post-generation check for plan/pricing hallucinations.
// Non-blocking: logs warnings but never blocks the user from receiving the response.

// Known plan prices (canonical source of truth — must match buildMyraPlatformFacts)
const KNOWN_PLAN_PRICES: Record<string, string> = {
  starter: "free",
  pro: "$19",
  elite: "$49",
  enterprise: "custom",
};

// Patterns that indicate a specific price claim — e.g. "$29/month", "₹499", "99 per month"
const PRICE_CLAIM_PATTERN = /(?:\$|€|₹|£)\s?\d+[\d,.]*|(?:\d+[\d,.]*)\s?(?:per\s+month|\/mo|\/month)/i;

// Plan name pattern — matches "Starter plan", "Pro tier", "Elite subscription", etc.
const PLAN_NAME_PATTERN = /\b(starter|pro|elite|enterprise)\s+(?:plan|tier|subscription|package)/i;

export interface MyraValidationResult {
  valid: boolean;
  warnings: string[];
  wordCount: number;
}

export function validateMyraOutput(text: string): MyraValidationResult {
  const warnings: string[] = [];
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Check for price claims adjacent to plan names
  const planMatch = text.match(PLAN_NAME_PATTERN);
  if (planMatch) {
    const planKey = planMatch[1].toLowerCase();
    const knownPrice = KNOWN_PLAN_PRICES[planKey];
    const priceMatch = text.match(PRICE_CLAIM_PATTERN);
    if (priceMatch && knownPrice) {
      const claimedPrice = priceMatch[0].toLowerCase();
      const knownPriceLower = knownPrice.toLowerCase();
      // If the claimed price doesn't match the known price, flag it
      if (!claimedPrice.includes(knownPriceLower) && knownPrice !== "custom") {
        warnings.push(`Possible price hallucination: claimed "${claimedPrice}" for ${planKey} plan, expected "${knownPrice}"`);
      }
    }
  }

  // Check for invented plan entitlements — phrases like "unlimited credits" or "unlimited queries"
  const unlimitedPattern = /\bunlimited\s+(credits|queries|questions|requests|calls|sessions)\b/i;
  if (unlimitedPattern.test(text)) {
    warnings.push(`Possible entitlement hallucination: "unlimited" claim detected — no plan offers unlimited credits`);
  }

  // Check for model/LLM self-disclosure — Myra should never reveal her underlying model.
  // Narrowed: bare "openai" matches KB quotes like "OpenAI's API" (legitimate reference).
  // Only flag when in a self-referential context (e.g. "powered by OpenAI", "I am an OpenAI model").
  const modelDisclosurePattern = /\b(gpt-[\w.-]+|azure\s+(openai|ai)|\b(?:i\s+am|i'm|powered\s+by|built\s+(on|with))\s+(?:an?\s+)?(?:openai|llm|language\s+model|ai\s+model)|(?:large\s+)?language\s+model|ai\s+model)\b/i;
  if (modelDisclosurePattern.test(text)) {
    warnings.push("Possible model self-disclosure: Myra should not reveal underlying AI model details");
  }

  return { valid: warnings.length === 0, warnings, wordCount };
}

export function logMyraValidationResult(result: MyraValidationResult): void {
  if (result.warnings.length > 0) {
    logger.warn(
      {
        event: "myra_output_validation_warning",
        warnings: result.warnings,
        wordCount: result.wordCount,
      },
      `Myra output validation: ${result.warnings.length} warning(s)`,
    );
  }
  recordValidationResult(result.valid).catch((e: unknown) => {
    logger.debug({ err: e }, "recordValidationResult failed for Myra");
  });
}
