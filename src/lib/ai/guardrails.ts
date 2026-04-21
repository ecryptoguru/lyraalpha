/**
 * Thrown when user input fails a guardrail check (injection pattern, banned
 * phrase, intent-aware predictive language). Carries a user-safe `reason`
 * string so API routes can surface a 400 with the exact violation reason
 * without leaking internal state.
 */
export class SafetyViolationError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "SafetyViolationError";
    this.reason = reason;
  }
}

/**
 * Thrown when a user has exhausted a usage quota (daily token cap, credit balance,
 * per-request cost ceiling). Maps to HTTP 429 at the route boundary so the UI can
 * render an upgrade CTA instead of a generic "something went wrong" 500.
 *
 * `resetAt` is an optional ISO timestamp the caller can surface via a `Retry-After`
 * header or in-UI countdown.
 */
export class UsageLimitError extends Error {
  readonly reason: string;
  readonly resetAt?: string;
  readonly kind: "daily_tokens" | "credits" | "cost_ceiling";
  constructor(
    reason: string,
    kind: UsageLimitError["kind"] = "daily_tokens",
    resetAt?: string,
  ) {
    super(reason);
    this.name = "UsageLimitError";
    this.reason = reason;
    this.kind = kind;
    this.resetAt = resetAt;
  }
}

// Prompt injection patterns — catch role-hijacking and instruction-override attempts.
// Precompiled at module load for zero per-call cost.
// Exported for post-retrieval scanning in rag.ts (SEC-1).
export const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:previous|all|above|prior|your)\s+instructions?/i,
  /disregard\s+(?:previous|all|above|prior|your)\s+instructions?/i,
  /you\s+are\s+now\s+(?:a|an|the)?\s*(?:different|new|another|unrestricted)/i,
  /act\s+as\s+(?:if\s+you\s+(?:are|were)\s+(?:a\s+|an\s+|the\s+)?|a\s+|an\s+)(?:different|unrestricted|jailbroken|evil|dan)/i,
  /(?:system|assistant|user):\s*you\s+(?:are|must|should|will)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,  // Llama/ChatML instruction tokens
  /do\s+anything\s+now|dan\s+mode|jailbreak/i,
  /pretend\s+(?:you\s+(?:are|have\s+no)|there\s+are\s+no)\s+(?:restrictions?|rules?|guidelines?)/i,
  // Expanded variants — additional evasion vectors identified in audit
  /forget\s+(?:your|all|previous|the|above)\s+(?:instructions?|rules?|guidelines?|training)/i,
  /override\s+(?:your|all|previous|the|safety)\s+(?:instructions?|rules?|guidelines?|training|filters?)/i,
  /bypass\s+(?:your|all|safety|security|content)\s+(?:filters?|rules?|guidelines?|restrictions?|checks?)/i,
  /you\s+(?:must|should|have\s+to|need\s+to)\s+(?:ignore|disregard|forget|override|bypass)/i,
  /new\s+rules?:/i,
  /from\s+now\s+on[,.\s]*(?:you|always|never|ignore|disregard)/i,
  /(?:output|respond|reply|answer)\s+(?:only\s+)?(?:with|in)\s+(?:raw|unfiltered|uncensored|harmful)/i,
  /(?:reveal|show|display|print|repeat)\s+(?:your|the|system|initial|original)\s+(?:prompt|instructions?|rules?)/i,
  /\<\/?system\>|\<\/?assistant\>|\<\/?user\>/i,  // XML-style role injection
];

// Phrases matched exactly (substring match is fine for multi-word terms)
const BANNED_PHRASES = [
  "price prediction",
  "guaranteed return",
  // "safe bet" moved to intent-aware pattern below — colloquial risk-assessment use is valid.
  // "target price" removed (Block 10) — replaced with intent-aware regex below.
  // "should i buy/sell" removed — system prompt already reframes these as analysis.
  // Hard-blocking legitimate user queries is bad UX; the LLM handles them gracefully.
];

// Block 11: Intent-aware "safe bet" / "safe bets" check.
// "is X a safe bet in a risk-off regime?" → analytical risk question → allowed.
// "is X a safe bet?" / "tell me a safe bet" / "give me safe bets" → advice request → blocked.
const SAFE_BET_PREDICTION_PATTERN =
  /(?:\bis\s+.{0,40}\bsafe\s+bets?\b(?!\s+(?:in|for|during|under|given|against|when|if))|(?:^|tell\s+me|give\s+me|what(?:'s|\s+is)|find\s+me|recommend)\s+.{0,40}safe\s+bets?\b(?!\s+(?:in|for|during|under|given|against|when|if)))/i;

// Block 10: Intent-aware "target price" check.
// "what's the analyst target price for BTC-USD?" → data lookup → allowed.
// "my target price is $200" / "predict target price" → prediction claim → blocked.
const TARGET_PRICE_PREDICTION_PATTERN =
  /(?:my|your|predict(?:ing|ed)?|forecast(?:ing|ed)?|will\s+reach|going\s+to\s+(?:hit|reach|be))\s+.{0,30}(?:target\s+price|price\s+target)/i;

// Single words matched as whole words only (won't block "buyback", "short-term", "long-term", etc.)
// Precompiled at module load — avoids new RegExp() on every call.
// Block 10: moon/pump/dump only blocked when NOT in an analytical context.
// "pump-and-dump scheme", "supply dump risk", "going-to-the-moon sentiment" are valid
// financial/crypto analysis vocabulary. Bad-faith uses lack analytical qualifiers.
const ANALYTICAL_EXCEPTION_PATTERN =
  /\b(?:risk|scheme|pattern|detect|avoid|watch|signal|prevent|analysis|analys[ei]s|sentiment|trap|scam)\b/i;

// R4: Patterns test against lowerQuery (already .toLowerCase()), so no /i flag needed.
// Using a consistent lowercased input eliminates the maintenance trap of mixed case handling.
const BANNED_WORD_PATTERNS: { word: string; regex: RegExp }[] = [
  "moon",
  "pump",
  "dump",
].map((w) => ({ word: w, regex: new RegExp(`\\b${w}\\b`) }));

export function checkPromptInjection(query: string): { isValid: boolean; reason?: string } {
  // R2-FIX: Normalize to NFKC form before pattern matching to defeat Unicode homoglyph evasion.
  // Attackers can substitute Cyrillic characters that look identical to Latin letters
  // (e.g. 'і' U+0456 for 'i', 'а' U+0430 for 'a') to bypass regex-based injection detection.
  // NFKC normalization canonicalizes visually-similar characters to their base equivalents.
  const normalized = query.normalize("NFKC");
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isValid: false,
        reason: "Your query contains content that cannot be processed.",
      };
    }
  }
  return { isValid: true };
}

export function checkFinancialGuardrails(query: string): { isValid: boolean; reason?: string } {
  const lowerQuery = query.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lowerQuery.includes(phrase)) {
      return {
        isValid: false,
        reason: `Your query contains prohibited language ("${phrase}"). We cannot provide financial advice or price predictions.`,
      };
    }
  }

  // Block 10: intent-aware target-price check — only block when combined with prediction language,
  // not when asking about analyst consensus target prices (legitimate data lookup).
  if (TARGET_PRICE_PREDICTION_PATTERN.test(query)) {
    return {
      isValid: false,
      reason: `Your query appears to request a price prediction. We cannot predict prices — try asking about analyst consensus targets or price ranges instead.`,
    };
  }

  // Block 11: intent-aware "safe bet" check — allow "is X a safe bet in a risk-off regime?" (analysis)
  // but block bare recommendation requests like "give me a safe bet" (advice).
  if (SAFE_BET_PREDICTION_PATTERN.test(query)) {
    return {
      isValid: false,
      reason: `Your query contains prohibited language ("safe bet"). We cannot recommend or guarantee safe investments. Try asking about risk profile, downside scenarios, or regime-adjusted risk/reward instead.`,
    };
  }

  // Block 10: moon/pump/dump blocked only outside analytical context.
  // "pump-and-dump scheme", "supply dump risk", "going-to-moon sentiment as contrarian signal"
  // are standard financial/crypto vocabulary and should not be rejected.
  const isAnalyticalContext = ANALYTICAL_EXCEPTION_PATTERN.test(lowerQuery);
  if (!isAnalyticalContext) {
    for (const { word, regex } of BANNED_WORD_PATTERNS) {
      if (regex.test(lowerQuery)) {
        return {
          isValid: false,
          reason: `Your query contains prohibited language ("${word}"). We cannot provide financial advice or price predictions.`,
        };
      }
    }
  }

  return { isValid: true };
}

// P2: Per-conversation character cap — prevents context-window exhaustion from
// extremely long single messages. 5000 chars is the single-message limit; this
// cap applies to the full conversation history passed to the LLM.
const CONVERSATION_CHAR_CAP = 50_000;

export function validateConversationLength(messages: Array<{ role: string; content: string | unknown }>): {
  isValid: boolean;
  reason?: string;
} {
  const totalChars = messages.reduce((sum, m) => {
    const text = typeof m.content === "string" ? m.content : "";
    return sum + text.length;
  }, 0);
  if (totalChars > CONVERSATION_CHAR_CAP) {
    return {
      isValid: false,
      reason: `Conversation is too long (${Math.round(totalChars / 1000)}k chars). Please start a new conversation to continue.`,
    };
  }
  return { isValid: true };
}

// P2: Base64 / high-entropy injection scan — second-line defense against encoded payloads.
// Attackers may base64-encode prompt injections to bypass regex-based injection detection.
// This scan detects suspiciously dense base64-like strings that could hide instructions.
// Requires ≥2 high-entropy runs to block — single occurrences (data URLs, tx signatures)
// are common in legitimate crypto queries and should not hard-reject.
const BASE64_PATTERN = /[A-Za-z0-9+/]{40,}={0,2}/g;
// Shannon entropy threshold — base64 encoded text has entropy ~6 bits/char.
// Natural language is ~4-4.5 bits/char. We flag strings above 5.8 as suspicious.
// 5.8 avoids false-positives on hex addresses and partial base64 in URLs.
const ENTROPY_THRESHOLD = 5.8;
const MIN_SUSPICIOUS_RUNS = 2;

function shannonEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const ch of str) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function checkBase64Injection(query: string): { isValid: boolean; reason?: string } {
  const matches = query.match(BASE64_PATTERN);
  if (!matches) return { isValid: true };
  let suspiciousCount = 0;
  for (const match of matches) {
    const entropy = shannonEntropy(match);
    if (entropy >= ENTROPY_THRESHOLD) {
      suspiciousCount++;
      if (suspiciousCount >= MIN_SUSPICIOUS_RUNS) {
        return {
          isValid: false,
          reason: "Your query contains encoded content that cannot be processed.",
        };
      }
    }
  }
  return { isValid: true };
}

export function validateInput(query: string): {
  isValid: boolean;
  reason?: string;
} {
  // R2-FIX: Normalize to NFKC before any checks — single normalization point for the
  // entire validation pipeline. Defeats Unicode homoglyph evasion across all guardrails.
  const normalized = query.normalize("NFKC");

  if (normalized.length > 5000) {
    return {
      isValid: false,
      reason: "Your query is too long. Please keep it under 5000 characters.",
    };
  }

  const injectionCheck = checkPromptInjection(normalized);
  if (!injectionCheck.isValid) return injectionCheck;

  // P2: Base64/high-entropy injection scan — second-line defense after regex patterns
  const base64Check = checkBase64Injection(normalized);
  if (!base64Check.isValid) return base64Check;

  const financialCheck = checkFinancialGuardrails(normalized);
  if (!financialCheck.isValid) return financialCheck;

  return { isValid: true };
}
