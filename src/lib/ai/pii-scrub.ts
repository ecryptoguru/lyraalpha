/**
 * B3-FIX: PII scrubbing utility
 *
 * Redacts personally identifiable information (email addresses, phone numbers)
 * from text before it is sent to the LLM or stored in conversation logs.
 * Programmatic enforcement — does not rely on model compliance.
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "pii-scrub" });

// ── PII patterns (ordered by specificity — most specific first) ──────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // Email addresses — most common PII leak vector
  {
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    replacement: "[email]",
    label: "email",
  },
  // Phone numbers: international (+XX-XXXX-XXXX), US ((XXX) XXX-XXXX), Indian (+91 XXXXX XXXXX)
  // Broad pattern: optional country code + 2-5 digit groups separated by spaces/dashes
  {
    pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/g,
    replacement: "[phone]",
    label: "phone",
  },
  // Clerk user IDs (user_xxxxxxxxxxxxxxxx) — should not leak into LLM context
  {
    pattern: /\buser_[a-zA-Z0-9]{10,30}\b/g,
    replacement: "[user-id]",
    label: "clerk-user-id",
  },
];

export interface ScrubResult {
  scrubbed: string;
  redactionCount: number;
  redactionTypes: string[];
}

/**
 * Scrub PII from a text string. Returns the scrubbed text and metadata
 * about what was redacted (for logging/monitoring).
 *
 * Non-destructive: returns the original string if no PII is found.
 * Low-overhead: simple regex pass, no NLP or external API calls.
 */
export function scrubPII(text: string): ScrubResult {
  if (!text || text.length === 0) return { scrubbed: text, redactionCount: 0, redactionTypes: [] };

  let scrubbed = text;
  let totalRedactions = 0;
  const redactionTypes = new Set<string>();

  for (const { pattern, replacement, label } of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      scrubbed = scrubbed.replace(pattern, replacement);
      totalRedactions += matches.length;
      redactionTypes.add(label);
    }
  }

  if (totalRedactions > 0) {
    logger.debug(
      { redactionCount: totalRedactions, redactionTypes: [...redactionTypes] },
      "PII scrubbed from text",
    );
  }

  return {
    scrubbed,
    redactionCount: totalRedactions,
    redactionTypes: [...redactionTypes],
  };
}

/**
 * Convenience: scrub PII and return only the scrubbed string.
 * Use when you don't need redaction metadata.
 */
export function scrubPIIString(text: string): string {
  return scrubPII(text).scrubbed;
}
