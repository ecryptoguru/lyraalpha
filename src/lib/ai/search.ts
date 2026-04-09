import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { createHash } from "crypto";
import { tavily } from "@tavily/core";
import { alertIfWebSearchOutage } from "./alerting";

// ── Circuit Breaker ───────────────────────────────────────────────────────────
// Tracks consecutive failures so one structured event fires per outage window.
// Resets on first success.
let _consecutiveFailures = 0;
const CIRCUIT_WARN_THRESHOLD = 3;

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
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:previous|all|above|prior|your)\s+instructions?/i,
  /disregard\s+(?:previous|all|above|prior|your)\s+instructions?/i,
  /you\s+are\s+now\s+(?:a|an|the)?\s*(?:different|new|another|unrestricted)/i,
  /act\s+as\s+(?:if\s+you\s+(?:are|were)\s+(?:a\s+|an\s+|the\s+)?|a\s+|an\s+)(?:different|unrestricted|jailbroken|evil|dan)/i,
  /(?:system|assistant|user):\s*you\s+(?:are|must|should|will)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
  /do\s+anything\s+now|dan\s+mode|jailbreak/i,
  /pretend\s+(?:you\s+(?:are|have\s+no)|there\s+are\s+no)\s+(?:restrictions?|rules?|guidelines?)/i,
];

function sanitizeSnippet(text: string): string {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const filtered = lines.filter((l) => !INJECTION_PATTERNS.some((p) => p.test(l)));
  const joined = filtered.join("\n");
  if (INJECTION_PATTERNS.some((p) => p.test(joined))) return "";
  return joined.slice(0, SNIPPET_MAX_CHARS);
}

// ── Topic & country helpers ───────────────────────────────────────────────────
// Docs: topic="finance" and topic="news" are recognised values.
// country is only valid when topic="general" — passing it with topic="finance"
// will cause an API error. Docs confirmed this constraint.
const FINANCE_KEYWORDS =
  /\b(?:stock|etf|index|fund|equity|bond|yield|commodity|crypto|price|regime|inflation|rate|fed|rbi|ecb|gdp|sector|nifty|sensex|nasdaq|s&p|dow|ftse|dax|nikkei|reliance|tata|hdfc|bse|nse|rupee|rbi)\b/i;

function resolveTopic(query: string): "finance" | "news" | "general" {
  if (FINANCE_KEYWORDS.test(query)) return "finance";
  return "general";
}

// Region-specific domain lists — steer Tavily toward high-quality financial sources.
// Without domain steering, Tavily may return Reddit/Quora/paywalled sites for finance queries.
// Configurable via environment variables for runtime flexibility.
const DEFAULT_INDIA_FINANCE_DOMAINS = [
  "moneycontrol.com",
  "economictimes.indiatimes.com",
  "livemint.com",
  "business-standard.com",
  "reuters.com",
  "ndtvprofit.com",
  "rbi.org.in",
  "nseindia.com",
  "bseindia.com",
];

const DEFAULT_US_FINANCE_DOMAINS = [
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "cnbc.com",
  "marketwatch.com",
  "seekingalpha.com",
  "investopedia.com",
  "federalreserve.gov",
  "sec.gov",
];

function getIndiaFinanceDomains(): string[] {
  const envValue = process.env.TAVILY_INDIA_FINANCE_DOMAINS;
  if (!envValue) return DEFAULT_INDIA_FINANCE_DOMAINS;
  return envValue.split(",").map((d) => d.trim()).filter(Boolean);
}

function getUSFinanceDomains(): string[] {
  const envValue = process.env.TAVILY_US_FINANCE_DOMAINS;
  if (!envValue) return DEFAULT_US_FINANCE_DOMAINS;
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

  const cacheKey = `tavily:v1:${createHash("sha256")
    .update(`${region}:${trimmedQuery}:${effectiveMaxResults}`)
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
  // Applied regardless of topic — finance + news queries both benefit.
  if (region === "IN") {
    searchOptions.includeDomains = getIndiaFinanceDomains();
  } else {
    searchOptions.includeDomains = getUSFinanceDomains();
  }

  try {
    const response = await client.search(trimmedQuery, searchOptions);
    const elapsed = Date.now() - start;

    // Score-based filtering (docs best practice: filter score > threshold)
    const relevantResults = response.results.filter((r) => r.score >= SCORE_THRESHOLD);

    const sanitizedResults = relevantResults
      .map((r) => {
        const snippet = sanitizeSnippet(r.content || "");
        return snippet ? { title: r.title, url: r.url, snippet } : null;
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

    // Circuit-breaker recovery
    if (_consecutiveFailures > 0) {
      logger.info(
        { event: "web_search_recovery", previousFailures: _consecutiveFailures },
        "Tavily recovered after consecutive failures",
      );
      _consecutiveFailures = 0;
    }

    try {
      await setCache(cacheKey, { content, sources }, 20 * 60); // 20 min TTL
    } catch (e) {
      logger.warn({ err: sanitizeError(e) }, "Failed to write web search cache");
    }

    return { content, sources };
  } catch (error) {
    const elapsed = Date.now() - start;
    _consecutiveFailures++;
    alertIfWebSearchOutage(_consecutiveFailures).catch(() => {});

    const errMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit");
    const isServerError = /5\d\d/.test(errMsg);
    const logLevel = _consecutiveFailures >= CIRCUIT_WARN_THRESHOLD ? "warn" : "error";

    logger[logLevel](
      {
        event: "web_search_error",
        err: sanitizeError(error),
        elapsedMs: elapsed,
        isRateLimit,
        isServerError,
        consecutiveFailures: _consecutiveFailures,
        outage: _consecutiveFailures >= CIRCUIT_WARN_THRESHOLD,
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
