import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { redis, getCache, setCache } from "@/lib/redis";
import { createHash } from "crypto";
import { tavily } from "@tavily/core";
import { alertIfWebSearchOutage } from "./alerting";
import { INJECTION_PATTERNS } from "./guardrails";
import { logFireAndForgetError } from "@/lib/fire-and-forget";

// ── Circuit Breaker ───────────────────────────────────────────────────────────
// R7-FIX: Moved from in-memory counter to Redis for multi-instance accuracy.
// In serverless/multi-instance deployments, each instance had its own _consecutiveFailures
// counter, so a real outage could have N instances each below threshold while the
// actual total exceeded it. Redis provides a shared atomic counter with TTL.
const CIRCUIT_BREAKER_KEY = "web_search:consecutive_failures";
const CIRCUIT_BREAKER_TTL = 300; // 5 min — auto-resets if no updates
const CIRCUIT_WARN_THRESHOLD = 3;

async function incrementCircuitBreaker(): Promise<number> {
  try {
    const val = await redis.incr(CIRCUIT_BREAKER_KEY);
    // Set TTL only on first increment (key didn't exist before) — avoids resetting TTL on every hit
    if (val === 1) {
      await redis.expire(CIRCUIT_BREAKER_KEY, CIRCUIT_BREAKER_TTL).catch((e) => logFireAndForgetError(e, "circuit-breaker-ttl"));
    }
    return val;
  } catch {
    // Redis unavailable — fall back to allowing the request through
    return 0;
  }
}

const logger = createLogger({ service: "web-search" });

export interface WebSource {
  title: string;
  url: string;
  content: string;
}

export interface SearchResult {
  content: string;
  sources: { title: string; url: string; type: "web" }[];
}

export type SearchRegion = "US" | "IN";

// ── Cost & latency constants (from official Tavily docs) ──────────────────────
// basic / fast / ultra-fast = 1 credit each.  advanced = 2 credits.
// max_results: 3 for SIMPLE/MODERATE (tight token budget), 5 for COMPLEX
//   (more output tokens available, deeper grounding needed — same 1 credit cost).
// timeRange="week": market data ages quickly; "month" is too stale.
// score threshold=0.5: drop low-relevance results before LLM injection.
// Query cap=400 chars: official docs hard limit.
const SEARCH_DEPTH = "basic" as const;
const MAX_RESULTS_DEFAULT = 3;         // SIMPLE / MODERATE
const MAX_RESULTS_COMPLEX = 5;         // COMPLEX — deeper analysis, same 1 credit
const TIME_RANGE = "week" as const;
const SCORE_THRESHOLD = 0.5;
const QUERY_MAX_CHARS = 400;
const SNIPPET_MAX_CHARS = 900;

// ── Singleton Tavily client ───────────────────────────────────────────────────
// Lazy-initialised once at first call — matches the pattern used for other
// singleton HTTP clients in this codebase (orchestration.ts, compress.ts).
let _client: ReturnType<typeof tavily> | null = null;
let _clientChecked = false;

function getTavilyClient(): ReturnType<typeof tavily> | null {
  if (!_clientChecked) {
    const apiKey = process.env.TAVILY_API_KEY ?? null;
    if (apiKey) {
      _client = tavily({ apiKey });
      logger.info("Tavily client ready");
    } else {
      logger.warn("TAVILY_API_KEY not set — web search disabled");
    }
    _clientChecked = true;
  }
  return _client;
}

// ── Prompt-injection sanitizer ────────────────────────────────────────────────
// B2-FIX: INJECTION_PATTERNS imported from guardrails.ts — single source of truth.
// Previously duplicated here, which risked pattern drift if guardrails were updated.

function sanitizeSnippet(text: string): string {
  // R2-FIX: Normalize to NFKC before injection scanning to defeat Unicode homoglyph evasion.
  // Web search snippets from external sites could contain injection payloads using
  // Cyrillic lookalike characters (e.g. 'і' for 'i', 'а' for 'a').
  const normalized = text.normalize("NFKC");
  const lines = normalized
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const filtered = lines.filter((l) => !INJECTION_PATTERNS.some((p) => p.test(l)));
  const joined = filtered.join("\n");
  // Multi-line injection check: some patterns only match across line boundaries.
  // Only test patterns that can span multiple lines (contain \n or start-of-line anchors)
  // to avoid redundantly re-testing single-line patterns already checked above.
  const multiLinePatterns = INJECTION_PATTERNS.filter((p) => /\[INST\]|<\|im_start\|>|<\|im_end\|>|\bsystem\b|\bassistant\b|\buser\b/i.test(p.source));
  if (multiLinePatterns.some((p) => p.test(joined))) return "";
  return joined.slice(0, SNIPPET_MAX_CHARS);
}

// ── Topic & country helpers ───────────────────────────────────────────────────
// Docs: topic="finance" and topic="news" are recognised values.
// country is only valid when topic="general" — passing it with topic="finance"
// will cause an API error. Docs confirmed this constraint.
const CRYPTO_KEYWORDS =
  /\b(?:crypto|bitcoin|btc|ethereum|eth|solana|sol|xrp|cardano|ada|dogecoin|doge|polkadot|dot|avalanche|avax|chainlink|link|polygon|matic|defi|token|coin|blockchain|usd|usdt|usdc|dai|price|whale|wallet|exchange|cefi|altcoin|stablecoin|nft|web3|dex|amm|apy|tvl|staking|yield|farm|liquidity|swap|bridge|layer2|l2|rollup|airdrop|mint|gas|halving|hashrate|mining|validator|governance|dao|memecoin|shitcoin|ico|ido|ieo|presale|rug|hodl|pump|dump|ath|atl|onchain|defillama|coingecko|coinmarketcap)\b/i;

// News-specific keywords — queries about headlines, breaking events, announcements.
// Must be checked BEFORE finance so that news queries about finance topics
// (e.g. "latest crypto news") route to Tavily's news-optimized pipeline.
const NEWS_KEYWORDS =
  /\b(?:news|headline|breaking|announcement|update|latest|today|this week|press release|reported|according to)\b/i;

function resolveTopic(query: string): "finance" | "news" | "general" {
  if (CRYPTO_KEYWORDS.test(query)) return "finance";
  if (NEWS_KEYWORDS.test(query)) return "news";
  return "general";
}

// Region-specific domain lists — steer Tavily toward high-quality crypto sources.
// Without domain steering, Tavily may return Reddit/Quora/paywalled sites for crypto queries.
// Configurable via environment variables for runtime flexibility.
const DEFAULT_INDIA_CRYPTO_DOMAINS = [
  "coingecko.com",
  "coinmarketcap.com",
  "cointelegraph.com",
  "coindesk.com",
  "decrypt.co",
  "theblock.co",
  "reuters.com",
  "economictimes.indiatimes.com",
  "livemint.com",
  "moneycontrol.com",
];

const DEFAULT_US_CRYPTO_DOMAINS = [
  "coingecko.com",
  "coinmarketcap.com",
  "cointelegraph.com",
  "coindesk.com",
  "decrypt.co",
  "theblock.co",
  "reuters.com",
  "bloomberg.com",
  "cnbc.com",
  "thedefiant.io",
];

function getIndiaCryptoDomains(): string[] {
  const envValue = process.env.TAVILY_INDIA_CRYPTO_DOMAINS;
  if (!envValue) return DEFAULT_INDIA_CRYPTO_DOMAINS;
  return envValue.split(",").map((d) => d.trim()).filter(Boolean);
}

function getUSCryptoDomains(): string[] {
  const envValue = process.env.TAVILY_US_CRYPTO_DOMAINS;
  if (!envValue) return DEFAULT_US_CRYPTO_DOMAINS;
  return envValue.split(",").map((d) => d.trim()).filter(Boolean);
}

// ── Main exported function ────────────────────────────────────────────────────
// queryComplexity drives result count: "complex"→5, anything else→3.
// Same 1 credit cost regardless of count.
export async function searchWeb(
  query: string,
  _maxResults?: number,           // kept for signature compat — queryComplexity is authoritative
  _searchDepth?: "basic" | "advanced", // always "basic" (1 credit)
  region: SearchRegion = "US",
  queryComplexity?: "simple" | "moderate" | "complex",
): Promise<SearchResult> {
  void _maxResults;
  void _searchDepth;
  const effectiveMaxResults = queryComplexity === "complex" ? MAX_RESULTS_COMPLEX : MAX_RESULTS_DEFAULT;

  const client = getTavilyClient();
  if (!client) return { content: "", sources: [] };

  // Docs: keep query under 400 chars
  const trimmedQuery = query.slice(0, QUERY_MAX_CHARS);

  // Cache key includes topic hint so queries that resolve to different topics
  // don't incorrectly share cache entries (e.g. "crypto" → finance vs general).
  // Topic is resolved from the query text, not from the API response, so it's
  // deterministic and safe to include in the cache key.
  const topicHint = NEWS_KEYWORDS.test(trimmedQuery) ? "nws" : CRYPTO_KEYWORDS.test(trimmedQuery) ? "fin" : "gen";
  const cacheKey = `tavily:v2:${createHash("sha256")
    .update(`${region}:${topicHint}:${trimmedQuery}:${effectiveMaxResults}`)
    .digest("hex")
    .slice(0, 16)}`;

  try {
    const cached = await getCache<SearchResult>(cacheKey);
    if (cached) {
      logger.info({ resultCount: cached.sources.length, region }, "Web search cache HIT");
      return cached;
    }
  } catch (e) {
    logger.warn({ err: sanitizeError(e) }, "Failed to read web search cache");
  }

  const start = Date.now();
  const topic = resolveTopic(trimmedQuery);

  // Build search options per Tavily SDK docs (camelCase)
  const searchOptions: Parameters<ReturnType<typeof tavily>["search"]>[1] = {
    searchDepth: SEARCH_DEPTH,
    maxResults: effectiveMaxResults,
    timeRange: TIME_RANGE,
    topic,
    includeAnswer: false,
    includeImages: false,
    includeRawContent: false,
  };

  // country only valid for topic="general" (docs constraint — API error if used with finance)
  if (topic === "general" && region === "IN") {
    searchOptions.country = "india";
  }

  // Domain steering: pin high-quality financial sources per region.
  // Only applied for finance + news topics — general queries (e.g. weather, sports)
  // must NOT be restricted to financial domains or they return zero results.
  if (topic === "finance" || topic === "news") {
    if (region === "IN") {
      searchOptions.includeDomains = getIndiaCryptoDomains();
    } else {
      searchOptions.includeDomains = getUSCryptoDomains();
    }
  }

  try {
    const response = await client.search(trimmedQuery, searchOptions);
    const elapsed = Date.now() - start;

    // Score-based filtering (docs best practice: filter score > threshold)
    const relevantResults = response.results.filter((r) => r.score >= SCORE_THRESHOLD);

    const sanitizedResults = relevantResults
      .map((r) => {
        const snippet = sanitizeSnippet(r.content || "");
        // R4-FIX: Sanitize titles too — a malicious SEO-poisoned page title could carry
        // an injection payload into the system context via [WEB: title].
        const title = sanitizeSnippet(r.title || "");
        return snippet && title ? { title, url: r.url, snippet } : null;
      })
      .filter((r): r is { title: string; url: string; snippet: string } => r !== null);

    const content = sanitizedResults
      .map((r) => `[WEB: ${r.title}]\n${r.snippet}`)
      .join("\n\n");

    const sources = sanitizedResults.map((r) => ({
      title: r.title,
      url: r.url,
      type: "web" as const,
    }));

    logger.info(
      {
        resultCount: sources.length,
        rawResultCount: response.results.length,
        filteredOut: response.results.length - relevantResults.length,
        responseTime: response.responseTime,
        elapsedMs: elapsed,
        region,
        topic,
        searchDepth: SEARCH_DEPTH,
        maxResults: effectiveMaxResults,
        queryComplexity: queryComplexity ?? "default",
      },
      "Tavily search completed",
    );

    // Circuit-breaker recovery — atomic GET+DEL via pipeline to prevent race
    // where another instance increments the counter between our GET and DEL.
    // Upstash pipeline executes as a single HTTP request (atomic on server).
    try {
      const pipe = redis.pipeline();
      pipe.get(CIRCUIT_BREAKER_KEY);
      pipe.del(CIRCUIT_BREAKER_KEY);
      const pipeResults = await pipe.exec();
      const currentFailures = pipeResults?.[0] as string | null;
      if (currentFailures !== null) {
        logger.info(
          { event: "web_search_recovery", previousFailures: Number(currentFailures) },
          "Tavily recovered after consecutive failures — circuit breaker reset",
        );
      }
    } catch {
      // Non-critical — TTL will auto-expire
    }

    try {
      await setCache(cacheKey, { content, sources }, 20 * 60); // 20 min TTL
    } catch (e) {
      logger.warn({ err: sanitizeError(e) }, "Failed to write web search cache");
    }

    return { content, sources };
  } catch (error) {
    const elapsed = Date.now() - start;
    const consecutiveFailures = await incrementCircuitBreaker();
    alertIfWebSearchOutage(consecutiveFailures).catch((e) => logFireAndForgetError(e, "web-search-outage-alert"));

    const errMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit");
    const isServerError = /5\d\d/.test(errMsg);
    const logLevel = consecutiveFailures >= CIRCUIT_WARN_THRESHOLD ? "warn" : "error";

    logger[logLevel](
      {
        event: "web_search_error",
        err: sanitizeError(error),
        elapsedMs: elapsed,
        isRateLimit,
        isServerError,
        consecutiveFailures,
        outage: consecutiveFailures >= CIRCUIT_WARN_THRESHOLD,
        provider: "tavily",
      },
      isRateLimit
        ? "Tavily rate limit hit — degrading gracefully"
        : isServerError
          ? "Tavily server error — degrading gracefully"
          : "Web search failed — degrading gracefully",
    );

    return { content: "", sources: [] };
  }
}
