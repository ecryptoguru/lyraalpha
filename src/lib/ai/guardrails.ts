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
// "what's the analyst target price for AAPL?" → data lookup → allowed.
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
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(query)) {
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

export function validateInput(query: string): {
  isValid: boolean;
  reason?: string;
} {
  if (query.length > 5000) {
    return {
      isValid: false,
      reason: "Your query is too long. Please keep it under 5000 characters.",
    };
  }

  const injectionCheck = checkPromptInjection(query);
  if (!injectionCheck.isValid) return injectionCheck;

  const financialCheck = checkFinancialGuardrails(query);
  if (!financialCheck.isValid) return financialCheck;

  return { isValid: true };
}
