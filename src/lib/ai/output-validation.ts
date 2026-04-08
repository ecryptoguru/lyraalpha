/**
 * H6: Post-stream output validation
 *
 * Lightweight, tier-aware section-presence checks that run AFTER the stream
 * is fully consumed. Purely observational — logs warnings but never blocks
 * or retries the response.
 *
 * Con mitigations:
 * - Soft logging only (warn level) — user always gets the full response
 * - Tier-aware: SIMPLE/educational queries skip structural checks entirely
 * - Section checks are substring-based (zero regex overhead)
 * - Follow-up count uses a simple split, not a full parse
 * - No false positives for portfolio/compare/stress-test modes which use
 *   different section structures
 */

import { createLogger } from "@/lib/logger";
import { recordValidationResult } from "./alerting";

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
  // NOTE: "## Performance Context" is STOCK-only in proFormatFull — omitted to avoid
  // false-positive missing-section warnings for CRYPTO/ETF/COMMODITY MODERATE queries.
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
const GLOBAL_SECTIONS = ["## Market Pulse", "## Sector & Asset Class View", "## Key Risks", "## What to Watch"];

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
 * @param assetType  GLOBAL | STOCK | CRYPTO | etc.
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
      fullExpected.push("## Cross-Asset Signals");
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

  // Count follow-up questions (only for MODERATE+ non-SIMPLE tiers)
  let followUpCount = 0;
  if (tier !== "SIMPLE") {
    const followUpIdx = textLower.indexOf(FOLLOW_UP_HEADER.toLowerCase());
    if (followUpIdx !== -1) {
      // R6: Slice to 400 chars max after the header — prevents overcounting if the model
      // produces additional content (e.g. a disclaimer note) after the follow-up questions.
      // 400 chars safely fits 3 questions × ~100 chars each plus header padding.
      const afterFollowUp = text.slice(followUpIdx + FOLLOW_UP_HEADER.length, followUpIdx + FOLLOW_UP_HEADER.length + 400);
      // Count lines that start with a number (1. 2. 3.)
      followUpCount = (afterFollowUp.match(/^\s*\d+[.)]/gm) || []).length;
    }
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

  // Follow-up count check — only for MODERATE+ where we expect exactly 3
  if (result.tier !== "SIMPLE" && result.followUpCount > 0 && result.followUpCount !== EXPECTED_FOLLOW_UP_COUNT) {
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
