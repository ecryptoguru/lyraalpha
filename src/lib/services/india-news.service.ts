import { createLogger } from "@/lib/logger";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "india-news" });

const CACHE_TTL = {
  RSS_FEED: 1800, // 30 min
} as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface IndiaNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category?: string;
}

// ─── RSS Feed URLs ──────────────────────────────────────────────────

const RSS_FEEDS = {
  MONEYCONTROL_MARKET: "https://www.moneycontrol.com/rss/marketreports.xml",
  MONEYCONTROL_BUSINESS: "https://www.moneycontrol.com/rss/business.xml",
  MONEYCONTROL_STOCKS: "https://www.moneycontrol.com/rss/lateststocknews.xml",
  ET_MARKETS: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
} as const;

// ─── Simple XML Parser (no external dependency) ─────────────────────

function parseRSSItems(xml: string, source: string): IndiaNewsItem[] {
  const items: IndiaNewsItem[] = [];

  // Extract all <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const description = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const category = extractTag(block, "category");

    if (title && link) {
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description || "").slice(0, 500),
        pubDate: pubDate || new Date().toISOString(),
        source,
        category: category || undefined,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular tags
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ─── Service ────────────────────────────────────────────────────────

export class IndiaNewsService {
  /**
   * Fetch and parse a single RSS feed.
   */
  private static async fetchFeed(url: string, source: string): Promise<IndiaNewsItem[]> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; InsightAlphaAI/1.0)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        logger.warn({ url, status: res.status }, "RSS feed fetch failed");
        return [];
      }

      const xml = await res.text();
      return parseRSSItems(xml, source);
    } catch (err) {
      logger.error({ err: String(err), url }, "RSS feed error");
      return [];
    }
  }

  /**
   * Get latest Indian market news from all RSS sources.
   * Returns deduplicated, sorted by date.
   */
  static async getIndianMarketNews(limit = 30): Promise<IndiaNewsItem[]> {
    const cacheKey = `india:news:market:${limit}`;
    const cached = await getCache<IndiaNewsItem[]>(cacheKey);
    if (cached) return cached;

    const feeds = await Promise.allSettled([
      this.fetchFeed(RSS_FEEDS.MONEYCONTROL_MARKET, "Moneycontrol"),
      this.fetchFeed(RSS_FEEDS.MONEYCONTROL_STOCKS, "Moneycontrol"),
      this.fetchFeed(RSS_FEEDS.ET_MARKETS, "Economic Times"),
    ]);

    const allItems: IndiaNewsItem[] = [];
    for (const result of feeds) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value);
      }
    }

    // Deduplicate by title similarity (first 60 chars)
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      const key = item.title.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date (newest first) and limit
    const sorted = unique
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, limit);

    await setCache(cacheKey, sorted, CACHE_TTL.RSS_FEED);
    logger.debug({ count: sorted.length }, "Fetched Indian market news from RSS");
    return sorted;
  }

  /**
   * Search Indian news for a specific stock symbol.
   * Matches against title text (e.g., "Reliance", "TCS", "HDFC").
   */
  static async getNewsForSymbol(symbol: string, limit = 5): Promise<IndiaNewsItem[]> {
    // Strip .NS/.BO suffix and get company keyword
    const keyword = symbol.replace(/\.(NS|BO)$/, "").toUpperCase();
    const allNews = await this.getIndianMarketNews(60);

    return allNews
      .filter((item) => {
        const text = `${item.title} ${item.description}`.toUpperCase();
        return text.includes(keyword);
      })
      .slice(0, limit);
  }

  /**
   * Derive a simple sentiment from news title keywords.
   * This is a basic heuristic — not NLP-grade.
   */
  static deriveSentiment(title: string): "POSITIVE" | "NEGATIVE" | "NEUTRAL" {
    const lower = title.toLowerCase();
    const bullish = ["surge", "rally", "gain", "rise", "jump", "soar", "bull", "high", "record", "profit", "beat", "upgrade", "buy", "outperform", "boom"];
    const bearish = ["fall", "drop", "crash", "decline", "loss", "bear", "low", "sell", "downgrade", "cut", "slump", "plunge", "weak", "miss", "warning"];

    const bullCount = bullish.filter((w) => lower.includes(w)).length;
    const bearCount = bearish.filter((w) => lower.includes(w)).length;

    if (bullCount > bearCount) return "POSITIVE";
    if (bearCount > bullCount) return "NEGATIVE";
    return "NEUTRAL";
  }
}
