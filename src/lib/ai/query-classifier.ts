import { QueryComplexity } from "./config";
import { COMMON_WORDS } from "./types";

// ─── SIMPLE (ABSOLUTE): Always SIMPLE regardless of analytical signals ───
// Platform-specific educational queries and greetings — never escalate these
// ORDER MATTERS: cheapest/most-common patterns first to short-circuit .some() early
const SIMPLE_ABSOLUTE = [
  // 1. Greetings — single char-class check, fastest possible
  /^(?:hi|hello|hey|thanks|thank you|ok|okay|got it|sure)\s*[.!?]?\s*$/i,
  // 2. Meaning/definition queries — short prefix match
  /^what(?:'s| is) the (?:meaning|definition)\b/i,
  // 3. Platform score/engine concepts — anchored to start to avoid matching injected context
  /^(?:what is|explain|tell me about|how to use)\s+(?:the\s+)?(?:trend|momentum|volatility|liquidity|trust|sentiment)\s+(?:score|engine)\b/i,
  /^(?:what does|how does|can you explain)\s+(?:the\s+)?(?:trend|momentum|volatility|liquidity|trust|sentiment)\s+(?:score|engine)\b/i,
  /^(?:what is|explain|tell me about)\s+(?:the\s+)?(?:arcs|dse|signal strength|market regime)\b/i,
  /^(?:what(?:'s| is)|can you explain)\s+the\s+difference\s+between\s+(?:the\s+)?(?:momentum|trend|volatility|liquidity|trust|sentiment)\s+score\s+and\s+(?:the\s+)?(?:momentum|trend|volatility|liquidity|trust|sentiment)\s+score\b/i,
  // 4. Bare concept definitions (long but covers many educational queries)
  /^(?:what(?:'s| is)|explain|define|how does)\s+(?:a |an |the )?(?:momentum|trend|volatility|liquidity|diversification|rebalancing|hedging|leverage|short selling|dollar cost averaging|compound interest|yield|spread|basis|arbitrage|alpha|beta|drawdown|sharpe|sortino|calmar|correlation|covariance|standard deviation|variance|skewness|kurtosis|market cap|float|short interest|put call ratio|open interest|implied volatility|vix|fear greed|sentiment|breadth|relative strength|momentum|mean reversion|reversion|carry|factor|regime|cycle|rotation|sector|asset class|crypto|blockchain|defi|nft|staking|yield farming|layer1|layer2|l1|l2|tokenomics|fdv|tvl|on.chain|onchain|gas fee|smart contract|validator|consensus|slippage|liquidity pool|amm|dex|cex|bridge|oracle)\??$/i,
  // 5. Platform-specific score/concept queries
  /^(?:what|how) (?:is|does|are|do) (?:a |an |the )?(?:sharpe|sortino|alpha|beta|pe ratio|rsi|macd|moving average|bollinger|volatility score|trend score|momentum score|liquidity score|trust score|sentiment score|dse|arcs|signal strength|regime|market regime)/i,
  /^(?:explain|define)\s+(?:the\s+)?(?:sharpe|sortino|alpha|beta|pe ratio|rsi|macd|moving average|bollinger|volatility|trend|momentum|liquidity|trust|sentiment|dse|arcs|signal strength|regime|market regime)/i,
  // 6. Simple "difference between" educational queries — expanded to cover common beginner pairs
  //    that were incorrectly hitting COMPLEX_PATTERNS ("difference between" + long-"how" catch-all)
  /^what(?:'s| is) the difference between (?:alpha and beta|etf and mutual fund|stocks and bonds|bonds and equities|growth and value|active and passive|trading and investing|investing and trading|saving and investing|investing and saving|stocks and mutual funds|mutual funds and stocks|stocks and etfs|etfs and stocks|demat and trading|sip and lump\s*sum|large[- ]cap and small[- ]cap|small[- ]cap and large[- ]cap|equity and debt|debt and equity|futures and options|options and futures|nifty and sensex|sensex and nifty|direct and regular|regular and direct)\b/i,
  // 7. Educational "should I" questions without tickers — beginner investing, not portfolio strategy
  /^should i (?:invest in (?:index funds|etfs|mutual funds|stocks|bonds|gold|sip|crypto|nfts|growth|value|growth or value|etfs or mutual funds)|start (?:investing|trading|a sip)|buy (?:index funds|etfs|mutual funds|gold|bonds)|average down|hold cash|invest during)\b/i,
  // 8. Educational "how do I" / "how should I" / "how much should I" questions without tickers
  /^how (?:do|should|can|much should) i (?:start investing|begin investing|invest|buy (?:my first|a) stock|open a demat|choose (?:stocks|a broker|mutual funds)|find (?:good stocks|small[- ]cap)|track (?:my portfolio|portfolio)|rebalance (?:my portfolio|a portfolio)|reduce (?:portfolio risk|risk)|diversify|avoid (?:emotional|panic)|average down|build (?:a |my )?(?:long[- ]term |passive )?(?:portfolio|income)|know if a stock is (?:undervalued|overvalued)|invest in (?:each|every|a single|one) stock)\b/i,
  // 9. "When should I" educational questions
  /^when should i (?:sell|buy|invest|rebalance|book profits|exit|hold)\b/i,
  // 10. "What should I do when" pattern — educational risk/behavior
  /^what should i do (?:when|if|during) (?:my stocks? (?:fall|drop|crash)|the market (?:fall|drop|crash|correct)|a (?:market )?(?:crash|correction|downturn))\b/i,
  // 11. Beginner safety / loss / binary questions
  /^can i (?:lose|make|earn|invest|afford|start|use)\b/i,
  // 12. Duration / holding / timing educational questions
  /^how long (?:should|do|can|will) i (?:hold|keep|wait|invest)\b/i,
  // 13. Broker / platform / account choice — educational, no analytical value
  /^which (?:broker|platform|app|demat|trading account|bank|fund|etf|mutual fund) (?:is|are) (?:best|good|recommended|better|safer)\b/i,
  // 14. Educational "what financial ratios / fundamentals / metrics" — definitional lists
  /^what (?:financial |key |important )?(?:ratios?|metrics?|fundamentals?|indicators?) (?:should|do|can|must) i (?:look at|check|use|consider|track)\b/i,
  // 15. Simple "is X safe / good / risky" questions — no analytical signals
  /^is (?:stock market|investing|trading|sip|etf|mutual fund|crypto|bitcoin|gold) (?:investing |trading )?(?:safe|good|risky|worth it|better|recommended)\b/i,
];

// ─── SIMPLE (SOFT): Educational/definitional — can be overridden by MODERATE_SIGNALS ───
const SIMPLE_PATTERNS = [
  /^what (?:is|are|does|do) /i,
  /^how (?:does|do|is|are) /i,
  /^explain /i,
  /^define /i,
  /^tell me (?:about|what) /i,
  /^can you explain/i,
];

// ─── COMPLEX: Multi-asset comparison, regime analysis, portfolio, deep analysis ───
const COMPLEX_PATTERNS = [
  /compar(?:e|ing|ison)/i,
  /(?:vs|versus|against)\s+/i,
  /thesis\b/i, // "investment thesis" = COMPLEX
  /institutional\b/i, // "institutional grade" = COMPLEX
  // "difference between TICKER and TICKER" = COMPLEX; "difference between ETF and MF" = MODERATE (handled by MODERATE_SIGNALS below)
  /difference between\s+[A-Z]{2,8}[-.]?[A-Z]{0,4}\s+(?:and|&|vs)\s+[A-Z]{2,8}/i,
  /how to use.*(?:rsi|macd|moving average|bollinger)/i,  // "how to use RSI" = MODERATE
  // "portfolio" alone is too broad — only match when combined with actionable/analytical context
  // e.g. "What is the ideal portfolio allocation?" = COMPLEX; "How do I build a portfolio?" = SIMPLE
  /\b(?:portfolio\s+(?:risk|allocation|rebalance|exposure|correlation|positioning|impact|stress|fragility|simulation|health)|(?:my|your|the)\s+portfolio\b(?!\s+(?:performance|tracker?|tracking)))/i,
  /(?<!un)correlat(?:ion|ed|e)/i,
  /cross[- ](?:asset|sector|market)/i,
  /regime\s+(?:shift|change|transition|impact|analysis)/i,
  // long "how" questions with substantial context — but NOT educational "how do I start investing" patterns
  // Guard: must contain an analytical signal (ticker, metric, scenario) to qualify as COMPLEX
  /how (?:would|will) .{20,200}/i, // "how would/will" with context = scenario analysis = COMPLEX
  /(?:factor|sector)\s+(?:rotation|alignment|exposure|tilt)/i,
  /(?:macro|global)\s+(?:impact|outlook|analysis|environment|picture)/i,
  /(?:risk[- ]adjusted|drawdown|tail risk|black swan|systemic)/i,
  /(?:multiple|several|all|every)\s+(?:assets?|stocks?|cryptos?|etfs?)/i,
  /\bposition(?:ing|ed)?\s+(?:my\s+)?(?:portfolio|exposure|allocation)/i,  // "positioning my portfolio"
  /\b(?:rate\s+(?:hike|cut|rise|increase|decrease)|interest\s+rate\s+(?:impact|effect|change))/i,  // rate scenarios
  /\b(?:should\s+i|how\s+(?:should|do\s+i))\s+(?:position|allocate|adjust|hedge)\b/i,  // actionable portfolio questions ("invest" removed — caught by SIMPLE_ABSOLUTE for educational intent)
  /\b(?:what(?:'s|\s+is)\s+the\s+best\s+(?:way|approach|strategy)\s+to)/i,  // strategic questions
  /\b(?:inflation|stagflation|recession|soft\s+landing|hard\s+landing)\s+(?:impact|scenario|hedge|play|trade)/i,
  /\b(?:the|this)\s+(?:\w+\s+)?sector\b.*\b(?:this|next|last)\s+(?:week|month|quarter|year)\b/i,  // "the AI sector this week" (time-bounded sector analysis)
  /\b(?:tech|semiconductor|ai|energy|financial|healthcare|consumer|industrial|utility|real estate)\s+sector\s+(?:outlook|analysis|performance|rotation|trend)/i,  // "tech sector outlook"
  /\b(?:current|now|today|this\s+(?:week|month|quarter)|right\s+now|happening)\b.*\bsector\s+(?:rotation|analysis|performance|breakdown)\b/i,  // "what's happening with sector rotation" — contextual, not definitional
  /\bsector\s+(?:rotation|analysis|performance|breakdown|comparison)\b.*\b(?:now|today|current|this\s+(?:week|month|quarter)|impact|effect|signal)\b/i,  // "sector rotation analysis this week"
];

// ─── MODERATE signals: override SIMPLE when query has analytical intent ───
// If a query starts with "What are..." but contains these, it's analysis not education
const MODERATE_SIGNALS = [
  /\b[A-Z]{2,8}\b/,                          // contains an uppercase ticker (NVDA, AAPL)
  /\b(?:this|next|last)\s+(?:week|month|quarter|year)\b/i,  // time-bounded
  /\b(?:latest|recent|current|today|news|updates?|developments?)\b/i,
  /\b(?:driver|catalyst|trigger|outlook|setup|play|trade|position)s?\b/i,
  /\b(?:valuation|multiple|earnings|revenue|margin|guidance|estimate|consensus|undervalued|overvalued|fairly valued|intrinsic value|book value|price[- ]to[- ](?:earnings|book|sales)|fcf yield|roe|roa|debt[- ]to[- ]equity)\b/i,
  /\b(?:support|resistance|breakout|trend|momentum|volatility)\b/i,
  /technical\s+(?:analysis|indicator|trading)/i,
  /\b(?:sector|industry|market)\b/i,          // sector/market analysis
  /\b(?:bull|bear|risk|upside|downside)\b/i,
  /difference between/i,                      // educational comparisons → MODERATE (ticker-vs-ticker already caught by COMPLEX_PATTERNS)
];

// Catches lowercase tickers like "nvda", "aapl", "btc-usd" that the uppercase regex misses.
// Extracts 3-8 char words, uppercases them, and checks they're not common English words.
// Uses shared COMMON_WORDS from types.ts (single source of truth).
const FINANCE_STOPWORDS = new Set([
  "RATE", "HOLD", "BASE", "BULL", "BEAR", "LONG", "SHORT", "CALL", "PUT", "RISK",
  "FUND", "BOND", "CASH", "GOLD", "COIN", "DROP", "FALL", "RISE", "PUMP", "DUMP",
  "FEES", "LOSS", "GAIN", "MINT", "BURN", "DEFI", "NODE", "HODL", "SWAP", "PEAK", "LOWS",
  "ETF", "ETFS", "IPO", "CEO", "GDP", "USD", "DSE", "ARCS", "RSI", "MACD", "VIX",
]);

function hasLowercaseTicker(text: string): boolean {
  const words = text.match(/\b[a-zA-Z]{3,8}(?:-[a-zA-Z]{1,4})?\b/g);
  if (!words) return false;
  return words.some((w) => {
    const upper = w.toUpperCase();
    return !COMMON_WORDS.has(upper) && !FINANCE_STOPWORDS.has(upper) && /^[a-z]/.test(w) && /^[a-zA-Z-]+$/.test(w);
  });
}

function hasModerateSignal(text: string): boolean {
  return MODERATE_SIGNALS.some((p) => p.test(text));
}

function hasUppercaseTicker(text: string): boolean {
  const words = text.match(/\b[A-Z]{2,8}(?:[-.][A-Z]{1,4})?(?:=F)?\b/g);
  if (!words) return false;
  return words.some((w) => {
    const upper = w.toUpperCase();
    return !COMMON_WORDS.has(upper) && !FINANCE_STOPWORDS.has(upper);
  });
}

function hasStandaloneLowercaseAssetIntent(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= 4 && hasLowercaseTicker(trimmed);
}

const ASSET_NAME_PATTERNS = [
  /\b(?:bitcoin|ethereum|solana|bnb|ripple|cardano|avalanche|polkadot|chainlink|uniswap|aave|compound|maker|curve)\b/i,
  /\b(?:crypto|cryptocurrency|coin|token|defi|nft|layer1|layer2|l1|l2|altcoin|stablecoin|meme.?coin)\b/i,
];

function hasAssetSpecificIntent(text: string): boolean {
  return hasUppercaseTicker(text) || hasStandaloneLowercaseAssetIntent(text) || ASSET_NAME_PATTERNS.some((p) => p.test(text));
}

// ─── Short query heuristic ───
const SHORT_QUERY_MAX = 40;   // queries under 40 chars are likely simple
const LONG_QUERY_MIN = 150;   // queries over 150 chars are likely complex

/**
 * Classifies a user query into SIMPLE, MODERATE, or COMPLEX tier.
 * Pure heuristic — no AI call, runs in <1ms.
 *
 * @param query - The user's question text
 * @param conversationLength - Number of messages in conversation (longer = more complex context)
 * @returns QueryComplexity tier
 */
export function classifyQuery(
  query: string,
  conversationLength: number = 1,
): QueryComplexity {
  const trimmed = query.trim();

  // ABSOLUTE SIMPLE: platform-specific educational queries and greetings — never escalate
  if (SIMPLE_ABSOLUTE.some((p) => p.test(trimmed))) {
    return "SIMPLE";
  }

  // Check explicit COMPLEX patterns (they take priority over soft SIMPLE)
  if (COMPLEX_PATTERNS.some((p) => p.test(trimmed))) {
    return "COMPLEX";
  }

  // Short messages with soft SIMPLE pattern and no analytical intent → SIMPLE
  if (trimmed.length <= SHORT_QUERY_MAX) {
    if (SIMPLE_PATTERNS.some((p) => p.test(trimmed))) {
      if (!hasModerateSignal(trimmed)) {
        return "SIMPLE";
      }
    }
  }

  // Long queries with substantial context → COMPLEX, but ONLY when analytical signals are
  // also present AND the query is not an educational/definitional one (Block 4A).
  // Guard: a 150+ char explanation request like "Can you explain in detail what the volatility
  // score means..." has MODERATE_SIGNAL words but is definitional — must stay SIMPLE.
  if (trimmed.length >= LONG_QUERY_MIN && hasModerateSignal(trimmed) && !SIMPLE_ABSOLUTE.some((p) => p.test(trimmed))) {
    return "COMPLEX";
  }

  // Deep conversations escalate gradually — avoids a jarring credit cliff.
  // Turn 20+: genuinely long multi-turn session → COMPLEX.
  // Turn 12-19: escalate to MODERATE but not COMPLEX (query content still drives complexity first).
  // Block 4B: Skip escalation when query is educational — both SIMPLE_ABSOLUTE and
  // SIMPLE_PATTERNS without moderate signals (e.g. "explain beta" on turn 15 should stay SIMPLE).
  const isEducational = SIMPLE_ABSOLUTE.some((p) => p.test(trimmed)) ||
    (SIMPLE_PATTERNS.some((p) => p.test(trimmed)) && !hasModerateSignal(trimmed));
  if (conversationLength >= 20 && !isEducational) {
    return "COMPLEX";
  }
  if (conversationLength >= 12 && !isEducational) {
    return "MODERATE";
  }

  // Check SIMPLE patterns for medium-length queries
  // BUT only if no analytical signals are present (prevents "What are the key drivers for NVDA" → SIMPLE)
  if (SIMPLE_PATTERNS.some((p) => p.test(trimmed))) {
    if (!hasModerateSignal(trimmed)) {
      return "SIMPLE";
    }
  }

  // Asset-specific queries should use the standard analysis path by default.
  // Only explicit multi-asset / portfolio / regime / strategic patterns above
  // should escalate to COMPLEX.
  if (hasAssetSpecificIntent(trimmed)) {
    return "MODERATE";
  }

  // Default: MODERATE (standard analysis path)
  return "MODERATE";
}
