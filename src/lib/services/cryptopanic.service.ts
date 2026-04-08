import { createLogger } from "@/lib/logger";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "cryptopanic" });

const BASE_URL = "https://cryptopanic.com/api/free/v1";
const AUTH_TOKEN = process.env.CRYPTOPANIC_API_KEY || "";

// Free tier: ~5 req/min
const RATE_LIMIT_DELAY_MS = 13000; // ~4.6 req/min with safety
const MAX_RETRIES = 2;
let lastRequestTime = 0;

const CACHE_TTL = {
  NEWS: 1800,     // 30 min
  TRENDING: 900,  // 15 min
} as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface CryptoPanicPost {
  kind: string;         // "news" | "media"
  domain: string;       // e.g. "coindesk.com"
  title: string;
  published_at: string; // ISO date
  slug: string;
  url: string;
  source: {
    title: string;
    region: string;
    domain: string;
  };
  currencies?: {
    code: string;       // e.g. "BTC"
    title: string;
    slug: string;
    url: string;
  }[];
  votes: {
    negative: number;
    positive: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
    comments: number;
  };
}

export interface CryptoPanicResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CryptoPanicPost[];
}

// ─── Mapping: Our symbols → CryptoPanic currency codes ──────────────

const SYMBOL_TO_CRYPTO_CODE: Record<string, string> = {
  "BTC-USD": "BTC",
  "ETH-USD": "ETH",
  "SOL-USD": "SOL",
  "XRP-USD": "XRP",
  "ADA-USD": "ADA",
  "DOGE-USD": "DOGE",
  "DOT-USD": "DOT",
  "AVAX-USD": "AVAX",
  "LINK-USD": "LINK",
  "MATIC-USD": "MATIC",
  "UNI7083-USD": "UNI",
  "AAVE-USD": "AAVE",
  "ATOM-USD": "ATOM",
  "LTC-USD": "LTC",
  "NEAR-USD": "NEAR",
  "ARB-USD": "ARB",
  "OP-USD": "OP",
  "SUI-USD": "SUI",
  "APT-USD": "APT",
  "FTM-USD": "FTM",
  "GRT-USD": "GRT",
  "IMX-USD": "IMX",
  "SAND-USD": "SAND",
  "MANA-USD": "MANA",
  "AXS-USD": "AXS",
  "CRV-USD": "CRV",
  "COMP-USD": "COMP",
  "SNX-USD": "SNX",
  "MKR-USD": "MKR",
  "SHIB-USD": "SHIB",
  "PEPE-USD": "PEPE",
  "BNB-USD": "BNB",
  "TRX-USD": "TRX",
  "TON-USD": "TON",
  "ICP-USD": "ICP",
  "FIL-USD": "FIL",
  "RENDER-USD": "RNDR",
  "FET-USD": "FET",
  "INJ-USD": "INJ",
  "THETA-USD": "THETA",
  "ALGO-USD": "ALGO",
  "XLM-USD": "XLM",
  "HBAR-USD": "HBAR",
  "VET-USD": "VET",
  "EGLD-USD": "EGLD",
  "KAVA-USD": "KAVA",
  "1INCH-USD": "1INCH",
  "FLOW-USD": "FLOW",
  "MNT-USD": "MNT",
  "STX-USD": "STX",
};

export function getCryptoPanicCode(symbol: string): string | null {
  return SYMBOL_TO_CRYPTO_CODE[symbol] ?? null;
}

// ─── Rate-limited Fetch ─────────────────────────────────────────────

async function rateLimitedFetch(url: string, attempt = 0): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const res = await fetch(url, { next: { revalidate: 0 } });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`CryptoPanic 429: rate limited after ${MAX_RETRIES} retries`);
    }
    const backoff = 15000 * (attempt + 1);
    logger.warn({ attempt, backoff }, "CryptoPanic rate limited — backing off");
    await new Promise((r) => setTimeout(r, backoff));
    return rateLimitedFetch(url, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CryptoPanic ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

// ─── Service ────────────────────────────────────────────────────────

export class CryptoPanicService {
  static isConfigured(): boolean {
    return !!AUTH_TOKEN;
  }

  /**
   * Get crypto news, optionally filtered by currency code.
   * GET /posts/?auth_token=...&currencies=BTC&kind=news
   */
  static async getNews(options?: {
    currencies?: string[];
    kind?: "news" | "media";
    filter?: "rising" | "hot" | "bullish" | "bearish" | "important" | "saved" | "lol";
    limit?: number;
  }): Promise<CryptoPanicPost[]> {
    if (!AUTH_TOKEN) {
      logger.debug("CryptoPanic not configured — skipping");
      return [];
    }

    const { currencies, kind = "news", filter, limit = 20 } = options || {};
    const currencyStr = currencies?.join(",") || "";
    const cacheKey = `cp:news:${currencyStr}:${kind}:${filter || "all"}`;
    const cached = await getCache<CryptoPanicPost[]>(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        auth_token: AUTH_TOKEN,
        kind,
        public: "true",
      });
      if (currencyStr) params.set("currencies", currencyStr);
      if (filter) params.set("filter", filter);

      const url = `${BASE_URL}/posts/?${params}`;
      const res = await rateLimitedFetch(url);
      const data: CryptoPanicResponse = await res.json();
      const posts = (data?.results || []).slice(0, limit);
      await setCache(cacheKey, posts, CACHE_TTL.NEWS);
      logger.debug({ count: posts.length, currencies: currencyStr }, "Fetched CryptoPanic news");
      return posts;
    } catch (err) {
      logger.error({ err: String(err) }, "getNews failed");
      return [];
    }
  }

  /**
   * Get trending/hot crypto news across all currencies.
   */
  static async getTrendingNews(limit = 15): Promise<CryptoPanicPost[]> {
    return this.getNews({ filter: "hot", limit });
  }

  /**
   * Get news for a specific crypto symbol (our internal symbol format).
   */
  static async getNewsForSymbol(symbol: string, limit = 5): Promise<CryptoPanicPost[]> {
    const code = getCryptoPanicCode(symbol);
    if (!code) return [];
    return this.getNews({ currencies: [code], limit });
  }

  /**
   * Derive a simple sentiment from CryptoPanic votes.
   * Returns: { sentiment: "POSITIVE"|"NEGATIVE"|"NEUTRAL", score: -1..1, votes: {...} }
   */
  static deriveSentiment(post: CryptoPanicPost): {
    sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    score: number;
    totalVotes: number;
  } {
    const v = post.votes;
    const positive = (v.positive || 0) + (v.liked || 0) + (v.important || 0);
    const negative = (v.negative || 0) + (v.disliked || 0) + (v.toxic || 0);
    const total = positive + negative;

    if (total === 0) return { sentiment: "NEUTRAL", score: 0, totalVotes: 0 };

    const score = (positive - negative) / total; // -1 to 1
    const sentiment = score > 0.2 ? "POSITIVE" : score < -0.2 ? "NEGATIVE" : "NEUTRAL";
    return { sentiment, score: Math.round(score * 100) / 100, totalVotes: total };
  }
}
