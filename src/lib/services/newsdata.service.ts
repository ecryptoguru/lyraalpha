import { createLogger } from "@/lib/logger";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "newsdata-crypto" });

const BASE_URL = "https://newsdata.io/api/1/crypto";
const AUTH_TOKEN = process.env.NEWSDATA_API_KEY || process.env.NEWDATA_API_KEY || "";
const DEFAULT_PAGE_SIZE = 10;
const MAX_RETRIES = 2;

const CACHE_TTL = {
  NEWS: 1800,
  TRENDING: 900,
} as const;

export interface CryptoPanicPost {
  kind: string;
  domain: string;
  title: string;
  published_at: string;
  slug: string;
  url: string;
  source: {
    title: string;
    region: string;
    domain: string;
  };
  currencies?: {
    code: string;
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
  sentiment?: "positive" | "negative" | "neutral";
  sentiment_stats?: {
    positive?: number;
    negative?: number;
    neutral?: number;
  };
  article_id?: string;
  description?: string;
  content?: string;
  image_url?: string;
}

export interface NewsDataCryptoArticle {
  article_id: string;
  title: string;
  link: string;
  keywords?: string[];
  creator?: string[];
  video_url?: string | null;
  description?: string | null;
  content?: string | null;
  pubDate: string;
  pubDateTZ?: string;
  image_url?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  source_icon?: string | null;
  source_priority?: number;
  country?: string[];
  category?: string[];
  language?: string;
  ai_tag?: string[];
  sentiment?: "positive" | "negative" | "neutral" | string;
  sentiment_stats?: {
    positive?: number;
    negative?: number;
    neutral?: number;
  } | null;
  ai_region?: string | string[];
  ai_org?: string | string[];
  coin?: string[] | string | null;
  duplicate?: boolean;
}

export interface NewsDataCryptoResponse {
  status: string;
  totalResults: number;
  results: NewsDataCryptoArticle[];
  nextPage?: string | null;
}

export type CryptoPanicResponse = NewsDataCryptoResponse;

const SYMBOL_TO_COIN: Record<string, string> = {
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

export function getNewsDataCoinCode(symbol: string): string | null {
  return SYMBOL_TO_COIN[symbol] ?? null;
}

function asStringArray(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function normalizeSentiment(value: string | undefined | null): "POSITIVE" | "NEGATIVE" | "NEUTRAL" {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "positive") return "POSITIVE";
  if (normalized === "negative") return "NEGATIVE";
  return "NEUTRAL";
}

function getHostname(url: string | null | undefined): string {
  if (!url) return "newsdata.io";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "newsdata.io";
  }
}

function coerceRegion(country: string[] | undefined): string {
  if (!country?.length) return "GLOBAL";
  return country[0] || "GLOBAL";
}

function mapArticle(article: NewsDataCryptoArticle): CryptoPanicPost {
  const coinCodes = asStringArray(article.coin).map((coin) => coin.toUpperCase());
  const sourceDomain = getHostname(article.source_url || article.link);
  const sourceTitle = article.source_id || sourceDomain;
  const sentimentStats = article.sentiment_stats || undefined;

  return {
    kind: article.video_url ? "media" : "news",
    domain: sourceDomain,
    title: article.title,
    published_at: article.pubDate,
    slug: article.article_id,
    url: article.link,
    source: {
      title: sourceTitle,
      region: coerceRegion(article.country),
      domain: sourceDomain,
    },
    currencies: coinCodes.length
      ? coinCodes.map((code) => ({
          code,
          title: code,
          slug: code.toLowerCase(),
          url: `https://newsdata.io/api/1/crypto?coin=${code.toLowerCase()}`,
        }))
      : undefined,
    votes: {
      negative: 0,
      positive: 0,
      important: 0,
      liked: 0,
      disliked: 0,
      lol: 0,
      toxic: 0,
      saved: 0,
      comments: 0,
    },
    sentiment: article.sentiment ? normalizeSentiment(article.sentiment).toLowerCase() as "positive" | "negative" | "neutral" : undefined,
    sentiment_stats: sentimentStats,
    article_id: article.article_id,
    description: article.description || undefined,
    content: article.content || undefined,
    image_url: article.image_url || undefined,
  };
}

async function rateLimitedFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`NewsData 429: rate limited after ${MAX_RETRIES} retries`);
    }
    const backoff = 1000 * (attempt + 1) * 3;
    logger.warn({ attempt, backoff }, "NewsData rate limited — backing off");
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return rateLimitedFetch(url, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NewsData ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

function buildNewsDataUrl(params: URLSearchParams): string {
  return `${BASE_URL}?${params.toString()}`;
}

export class NewsDataCryptoService {
  static isConfigured(): boolean {
    return !!AUTH_TOKEN;
  }

  /**
   * Get crypto news, optionally filtered by coin codes.
   */
  static async getNews(options?: {
    currencies?: string[];
    kind?: "news" | "media";
    filter?: "rising" | "hot" | "bullish" | "bearish" | "important" | "saved" | "lol";
    limit?: number;
  }): Promise<CryptoPanicPost[]> {
    if (!AUTH_TOKEN) {
      logger.debug("NewsData crypto endpoint not configured — skipping");
      return [];
    }

    const { currencies, kind = "news", filter, limit = 20 } = options || {};
    const coinStr = currencies?.map((coin) => coin.toLowerCase()).join(",") || "";
    const cacheKey = `newsdata:crypto:${coinStr}:${kind}:${filter || "all"}:${limit}`;
    const cached = await getCache<CryptoPanicPost[]>(cacheKey);
    if (cached) return cached;

    try {
      const collected: CryptoPanicPost[] = [];
      let nextPage: string | null | undefined;
      const pageSize = Math.min(DEFAULT_PAGE_SIZE, Math.max(1, limit));

      while (collected.length < limit) {
        const params = new URLSearchParams({
          apikey: AUTH_TOKEN,
          size: String(Math.min(pageSize, limit - collected.length)),
        });

        if (coinStr) params.set("coin", coinStr);
        if (kind === "media") params.set("video", "1");
        if (nextPage) params.set("page", nextPage);

        if (filter === "hot" || filter === "rising") {
          params.set("sort", "relevancy");
        } else if (filter === "important") {
          params.set("sort", "source");
        }

        const res = await rateLimitedFetch(buildNewsDataUrl(params));
        const data = (await res.json()) as NewsDataCryptoResponse;
        const articles = (data.results || []).map(mapArticle);
        collected.push(...articles);

        if (!data.nextPage || articles.length === 0) {
          break;
        }

        nextPage = data.nextPage;
      }

      const posts = collected.slice(0, limit);
      await setCache(cacheKey, posts, filter === "hot" ? CACHE_TTL.TRENDING : CACHE_TTL.NEWS);
      logger.debug({ count: posts.length, coins: coinStr }, "Fetched NewsData crypto news");
      return posts;
    } catch (err) {
      logger.error({ err: String(err) }, "getNews failed");
      return [];
    }
  }

  /**
   * Get trending crypto news across all coins.
   */
  static async getTrendingNews(limit = 15): Promise<CryptoPanicPost[]> {
    return this.getNews({ filter: "hot", limit });
  }

  /**
   * Get news for a specific crypto symbol (our internal symbol format).
   */
  static async getNewsForSymbol(symbol: string, limit = 5): Promise<CryptoPanicPost[]> {
    const code = getNewsDataCoinCode(symbol);
    if (!code) return [];
    return this.getNews({ currencies: [code], limit });
  }

  /**
   * Derive sentiment from NewsData sentiment metadata or fallback vote counts.
   */
  static deriveSentiment(post: CryptoPanicPost): {
    sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    score: number;
    totalVotes: number;
  } {
    const sentimentStats = post.sentiment_stats;
    if (sentimentStats) {
      const positive = sentimentStats.positive || 0;
      const negative = sentimentStats.negative || 0;
      const neutral = sentimentStats.neutral || 0;
      const total = positive + negative + neutral;

      if (total === 0) return { sentiment: "NEUTRAL", score: 0, totalVotes: 0 };

      const score = (positive - negative) / total;
      const sentiment = score > 0.2 ? "POSITIVE" : score < -0.2 ? "NEGATIVE" : "NEUTRAL";
      return { sentiment, score: Math.round(score * 100) / 100, totalVotes: total };
    }

    if (post.sentiment) {
      const normalized = normalizeSentiment(post.sentiment);
      return {
        sentiment: normalized,
        score: normalized === "POSITIVE" ? 1 : normalized === "NEGATIVE" ? -1 : 0,
        totalVotes: 1,
      };
    }

    const v = post.votes;
    const positive = (v.positive || 0) + (v.liked || 0) + (v.important || 0);
    const negative = (v.negative || 0) + (v.disliked || 0) + (v.toxic || 0);
    const total = positive + negative;

    if (total === 0) return { sentiment: "NEUTRAL", score: 0, totalVotes: 0 };

    const score = (positive - negative) / total;
    const sentiment = score > 0.2 ? "POSITIVE" : score < -0.2 ? "NEGATIVE" : "NEUTRAL";
    return { sentiment, score: Math.round(score * 100) / 100, totalVotes: total };
  }
}

export { NewsDataCryptoService as CryptoPanicService };
export { getNewsDataCoinCode as getCryptoPanicCode };
