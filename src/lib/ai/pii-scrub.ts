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

type ReplacementFn = (match: string, ...groups: string[]) => string;

interface PIIPattern {
  pattern: RegExp;
  replacement: string | ReplacementFn;
  label: string;
}

const PII_PATTERNS: PIIPattern[] = [
  // Email addresses — most common PII leak vector
  {
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    replacement: "[email]",
    label: "email",
  },
  // Phone numbers: international (+XX-XXXX-XXXX), US ((XXX) XXX-XXXX), Indian (+91 XXXXX XXXXX)
  // R1-FIX: Narrowed to avoid matching financial data (prices, market caps, percentages).
  // Three alternatives, all with negative lookbehind for currency symbols:
  //   1. International format: + prefix + digit groups (e.g. +1-555-123-4567)
  //   2. US parenthesized area code: (XXX) + digit groups (e.g. (555) 123-4567)
  //   3. Plain digit groups after phone-context words (captured in group 1):
  //      call/phone/number/reach/contact/dial/at/on followed by ": " or " "
  //      (e.g. "Phone: 555-123-4567" → group 1 = "Phone: ")
  // The old broad pattern matched any 3-group digit sequence, causing false positives on
  // financial data like "$50,000" or "1,000,000" in a financial analysis platform.
  //
  // Note: uses (?:|: ) instead of character class [: ] inside lookbehind/alternation
  // because V8 (Node 24) has a bug where character classes containing colon inside
  // lookbehinds and capturing groups fail to match.
  {
    pattern: /(?<![.$€₹£%\d])(?:\+\d{1,3}[-.\s]?)\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b|(?<![.$€₹£%\d])\(\d{2,5}\)[-\s]\d{3,5}[-.\s]?\d{3,5}\b|((?:call|phone|number|reach|contact|dial|at|on)(?:|: | ))\d{2,5}[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/gi,
    replacement: (match, contextWord?: string) => contextWord ? `${contextWord}[phone]` : "[phone]",
    label: "phone",
  },
  // Clerk user IDs (user_xxxxxxxxxxxxxxxx) — should not leak into LLM context
  {
    pattern: /\buser_[a-zA-Z0-9]{10,30}\b/g,
    replacement: "[user-id]",
    label: "clerk-user-id",
  },
  // BIP-39 mnemonic phrases (12 / 15 / 18 / 21 / 24 words) — catastrophic if pasted.
  // We do NOT verify against the BIP-39 wordlist here (too large for a regex pass);
  // instead we flag any sequence of 12-24 ALL-LOWERCASE words separated by single
  // spaces that is flanked by start-of-string, newline, or an obvious context word.
  // This catches the common paste-by-accident case without matching normal prose.
  // False-positive rate is further reduced by requiring each word to be 3-8 chars
  // (BIP-39 dictionary range).
  {
    pattern: /(?:^|\n|seed(?:\s+phrase)?:?\s*|mnemonic:?\s*|recovery(?:\s+phrase)?:?\s*)((?:[a-z]{3,8}\s+){11,23}[a-z]{3,8})\b/gi,
    replacement: "[redacted-seed-phrase]",
    label: "bip39-mnemonic",
  },
  // Hex private keys — 64 hex chars. REQUIRES a context word (private key / privkey /
  // secret key) to avoid false positives on transaction hashes and SHA-256 digests
  // which share the same shape and are legitimately discussed in crypto analysis.
  {
    pattern: /((?:private[\s_-]?key|priv[\s_-]?key|secret[\s_-]?key|wallet[\s_-]?key)(?:\s*[:=]\s*|\s+(?:is|=)\s+))(0x)?[0-9a-fA-F]{64}\b/gi,
    replacement: (_match, prefix: string) => `${prefix}[redacted-private-key]`,
    label: "hex-private-key",
  },
  // Indian PAN (Permanent Account Number): 5 uppercase letters + 4 digits + 1 uppercase letter
  // e.g. ABCDE1234F — always preceded by "PAN" or similar context to avoid matching
  // random alphanumeric strings in financial data (ticker symbols, CUSIPs, etc.)
  {
    pattern: /((?:PAN|pan(?:\s+card)?|PAN\s+card)(?:\s*(?:number|no|:|=|is)\s*))[A-Z]{5}\d{4}[A-Z]\b/gi,
    replacement: (_match, prefix: string) => `${prefix}[redacted-pan]`,
    label: "pan-number",
  },
  // Indian Aadhaar: 12-digit number, typically displayed as XXXX XXXX XXXX or XXXX-XXXX-XXXX
  // Requires "Aadhaar" or "aadhar" context word to avoid matching 12-digit financial figures.
  {
    pattern: /((?:Aadhaar|Aadhar|aadhaar|aadhar)(?:\s*(?:number|no|:|=|is)\s*))\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
    replacement: (_match, prefix: string) => `${prefix}[redacted-aadhaar]`,
    label: "aadhaar-number",
  },
  // US SSN: XXX-XX-XXXX or XXX XX XXXX format
  // Requires "SSN" or "Social Security" context word to avoid matching random digit groups.
  {
    pattern: /((?:SSN|Social\s+Security(?:\s+number)?)(?:\s*(?:number|no|:|=|is)\s*))\d{3}[-\s]\d{2}[-\s]\d{4}\b/gi,
    replacement: (_match, prefix: string) => `${prefix}[redacted-ssn]`,
    label: "ssn",
  },
  // Generic API keys / bearer tokens. Targets well-known provider prefixes rather
  // than guessing — avoids false positives on random 32+ char base64-ish content
  // that shows up in financial data blobs.
  //   - OpenAI:      sk-..., sk-proj-...
  //   - Anthropic:   sk-ant-...
  //   - Azure/AWS:   AKIA..., AWS-style
  //   - Clerk:       sk_live_... / sk_test_...
  //   - Supabase/JWT eyJ... (only when ≥ 100 chars — real JWTs are long)
  //   - Stripe:      sk_live_... / pk_live_...
  {
    pattern: /\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|pk_(?:live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{100,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,
    replacement: "[redacted-api-key]",
    label: "api-key",
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
      scrubbed = scrubbed.replace(pattern, replacement as Parameters<typeof scrubbed.replace>[1]);
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
