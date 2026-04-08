import { createHash } from "crypto";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import type {
  CoinGeckoMarket,
  CoinGeckoDetail,
  CoinGeckoOHLC,
  CoinGeckoMarketChart,
  CoinGeckoSimplePrice,
  CoinGeckoMetadata,
} from "@/lib/types/coingecko";

const logger = createLogger({ service: "coingecko" });

const BASE_URL = "https://api.coingecko.com/api/v3";
const API_KEY = process.env.COINGECKO_API_KEY || "";

// Demo tier: ~30 requests/minute
const RATE_LIMIT_DELAY_MS = 2100; // ~28 req/min with safety margin
const MAX_RETRIES = 3;

// Cache TTLs (seconds)
const CACHE_TTL = {
  MARKETS: 300,       // 5 min — batch quotes
  DETAIL: 3600,       // 1 hour — rich metadata (changes slowly)
  OHLC: 3600,         // 1 hour — daily candles
  MARKET_CHART: 3600, // 1 hour
  SIMPLE_PRICE: 120,  // 2 min — lightweight price refresh
  TOP_COINS: 86400,   // 24 hours — top 50 list
} as const;

let lastRequestTime = 0;
let requestQueue: Promise<void> = Promise.resolve();

async function rateLimitedFetch(url: string, retries = 0): Promise<Response> {
  // Serialize all requests through a queue to prevent concurrent rate-limit bypass
  const ticket = requestQueue;
  let resolve: () => void;
  requestQueue = new Promise<void>((r) => { resolve = r; });

  await ticket; // wait for previous request to finish its delay

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
  resolve!(); // release next request in queue

  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (API_KEY) {
    headers["x-cg-demo-api-key"] = API_KEY;
  }

  const res = await fetch(url, { headers, next: { revalidate: 0 } });

  if (res.status === 429 && retries < MAX_RETRIES) {
    const backoff = Math.pow(2, retries + 1) * 1000;
    logger.warn({ url, retries, backoff }, "CoinGecko rate limited, backing off");
    await new Promise((r) => setTimeout(r, backoff));
    return rateLimitedFetch(url, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CoinGecko API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

export class CoinGeckoService {
  /**
   * Batch quotes for multiple coins — single API call.
   * GET /coins/markets?vs_currency=usd&ids=bitcoin,ethereum,...
   */
  static async getMarkets(
    ids: string[],
    vsCurrency = "usd",
    options?: { sparkline?: boolean; priceChangePercentage?: string },
  ): Promise<CoinGeckoMarket[]> {
    if (ids.length === 0) return [];

    const idsHash = createHash("md5").update(ids.sort().join(",")).digest("hex").slice(0, 12);
    const cacheKey = `cg:markets:${idsHash}:${vsCurrency}`;
    const cached = await getCache<CoinGeckoMarket[]>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      vs_currency: vsCurrency,
      ids: ids.join(","),
      order: "market_cap_desc",
      per_page: "250",
      page: "1",
      sparkline: String(options?.sparkline ?? false),
      price_change_percentage: options?.priceChangePercentage ?? "7d,14d,30d,60d,200d,1y",
    });

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/coins/markets?${params}`);
      const data: CoinGeckoMarket[] = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.MARKETS);
      logger.info({ count: data.length }, "Fetched CoinGecko markets");
      return data;
    } catch (err) {
      logger.error({ err: sanitizeError(err), ids: ids.length }, "getMarkets failed");
      return [];
    }
  }

  /**
   * Rich metadata for a single coin.
   * GET /coins/{id}?localization=false&tickers=false&community_data=true&developer_data=true
   */
  static async getCoinDetail(id: string): Promise<CoinGeckoDetail | null> {
    const cacheKey = `cg:detail:${id}`;
    const cached = await getCache<CoinGeckoDetail>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      localization: "false",
      tickers: "false",
      market_data: "true",
      community_data: "true",
      developer_data: "true",
      sparkline: "false",
    });

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/coins/${id}?${params}`);
      const data: CoinGeckoDetail = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.DETAIL);
      logger.debug({ id, name: data.name }, "Fetched CoinGecko coin detail");
      return data;
    } catch (err) {
      logger.error({ err: sanitizeError(err), id }, "getCoinDetail failed");
      return null;
    }
  }

  /**
   * OHLC candles for a coin.
   * GET /coins/{id}/ohlc?vs_currency=usd&days=365
   * Returns: [[timestamp, open, high, low, close], ...]
   */
  static async getOHLC(id: string, days = 365, vsCurrency = "usd"): Promise<CoinGeckoOHLC> {
    const cacheKey = `cg:ohlc:${id}:${days}:${vsCurrency}`;
    const cached = await getCache<CoinGeckoOHLC>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      vs_currency: vsCurrency,
      days: String(days),
    });

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/coins/${id}/ohlc?${params}`);
      const data: CoinGeckoOHLC = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.OHLC);
      logger.debug({ id, candles: data.length }, "Fetched CoinGecko OHLC");
      return data;
    } catch (err) {
      logger.error({ err: sanitizeError(err), id }, "getOHLC failed");
      return [];
    }
  }

  /**
   * Market chart (price + volume + market cap) for a coin.
   * GET /coins/{id}/market_chart?vs_currency=usd&days=365
   * Returns daily granularity for days > 90.
   */
  static async getMarketChart(
    id: string,
    days = 365,
    vsCurrency = "usd",
  ): Promise<CoinGeckoMarketChart | null> {
    const cacheKey = `cg:chart:${id}:${days}:${vsCurrency}`;
    const cached = await getCache<CoinGeckoMarketChart>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      vs_currency: vsCurrency,
      days: String(days),
    });

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/coins/${id}/market_chart?${params}`);
      const data: CoinGeckoMarketChart = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.MARKET_CHART);
      logger.debug({ id, pricePoints: data.prices.length }, "Fetched CoinGecko market chart");
      return data;
    } catch (err) {
      logger.error({ err: sanitizeError(err), id }, "getMarketChart failed");
      return null;
    }
  }

  /**
   * Lightweight batch price check.
   * GET /simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true
   */
  static async getSimplePrice(
    ids: string[],
    vsCurrency = "usd",
  ): Promise<CoinGeckoSimplePrice> {
    if (ids.length === 0) return {};

    const cacheKey = `cg:price:${ids.sort().join(",")}:${vsCurrency}`;
    const cached = await getCache<CoinGeckoSimplePrice>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      ids: ids.join(","),
      vs_currencies: vsCurrency,
      include_market_cap: "true",
      include_24hr_vol: "true",
      include_24hr_change: "true",
      include_last_updated_at: "true",
    });

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/simple/price?${params}`);
      const data: CoinGeckoSimplePrice = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.SIMPLE_PRICE);
      return data;
    } catch (err) {
      logger.error({ err: sanitizeError(err), ids: ids.length }, "getSimplePrice failed");
      return {};
    }
  }

  /**
   * Discover top N coins by market cap.
   * GET /coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50
   */
  static async getTopCoins(limit = 50, vsCurrency = "usd"): Promise<CoinGeckoMarket[]> {
    const cacheKey = `cg:top:${limit}:${vsCurrency}`;
    const cached = await getCache<CoinGeckoMarket[]>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      vs_currency: vsCurrency,
      order: "market_cap_desc",
      per_page: String(limit),
      page: "1",
      sparkline: "false",
    });

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/coins/markets?${params}`);
      const data: CoinGeckoMarket[] = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.TOP_COINS);
      logger.info({ count: data.length }, "Fetched top coins from CoinGecko");
      return data;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getTopCoins failed");
      return [];
    }
  }

  /**
   * Transform CoinGeckoDetail into our normalized CoinGeckoMetadata structure.
   */
  static transformDetailToMetadata(detail: CoinGeckoDetail): CoinGeckoMetadata {
    const md = detail.market_data;
    const dev = detail.developer_data;
    const comm = detail.community_data;
    const links = detail.links;

    return {
      image: detail.image,
      categories: detail.categories.filter(Boolean),
      genesisDate: detail.genesis_date,
      hashingAlgorithm: detail.hashing_algorithm,

      marketCapRank: detail.market_cap_rank,
      fullyDilutedValuation: md.fully_diluted_valuation?.usd ?? null,
      circulatingSupply: md.circulating_supply,
      totalSupply: md.total_supply,
      maxSupply: md.max_supply,

      ath: md.ath?.usd ?? 0,
      athDate: md.ath_date?.usd ?? "",
      athChangePercentage: md.ath_change_percentage?.usd ?? 0,
      atl: md.atl?.usd ?? 0,
      atlDate: md.atl_date?.usd ?? "",
      atlChangePercentage: md.atl_change_percentage?.usd ?? 0,

      priceChange24h: md.price_change_24h ?? 0,
      priceChangePercentage7d: md.price_change_percentage_7d ?? 0,
      priceChangePercentage14d: md.price_change_percentage_14d ?? 0,
      priceChangePercentage30d: md.price_change_percentage_30d ?? 0,
      priceChangePercentage60d: md.price_change_percentage_60d ?? 0,
      priceChangePercentage200d: md.price_change_percentage_200d ?? 0,
      priceChangePercentage1y: md.price_change_percentage_1y ?? 0,

      sentimentVotesUpPercentage: detail.sentiment_votes_up_percentage ?? 0,
      sentimentVotesDownPercentage: detail.sentiment_votes_down_percentage ?? 0,
      watchlistUsers: detail.watchlist_portfolio_users ?? 0,

      developer: dev
        ? {
            forks: dev.forks ?? 0,
            stars: dev.stars ?? 0,
            subscribers: dev.subscribers ?? 0,
            totalIssues: dev.total_issues ?? 0,
            closedIssues: dev.closed_issues ?? 0,
            pullRequestsMerged: dev.pull_requests_merged ?? 0,
            commitCount4Weeks: dev.commit_count_4_weeks ?? 0,
          }
        : null,

      community: comm
        ? {
            redditSubscribers: comm.reddit_subscribers ?? 0,
            telegramUsers: comm.telegram_channel_user_count,
          }
        : null,

      links: {
        homepage: links.homepage?.filter(Boolean) ?? [],
        whitepaper: links.whitepaper || null,
        blockchain: links.blockchain_site?.filter(Boolean) ?? [],
        twitter: links.twitter_screen_name
          ? `https://x.com/${links.twitter_screen_name}`
          : null,
        reddit: links.subreddit_url || null,
        github: links.repos_url?.github?.filter(Boolean) ?? [],
        telegram: links.telegram_channel_identifier
          ? `https://t.me/${links.telegram_channel_identifier}`
          : null,
      },

      description: detail.description?.en ?? "",
      lastDetailSync: new Date().toISOString(),
    };
  }

  /**
   * Convert CoinGecko OHLC data to our standard OHLCV format.
   * CoinGecko OHLC: [timestamp_ms, open, high, low, close]
   * Note: CoinGecko OHLC doesn't include volume — we supplement from market_chart if needed.
   */
  static ohlcToOHLCV(
    ohlc: CoinGeckoOHLC,
    volumes?: [number, number][],
  ): { date: string; open: number; high: number; low: number; close: number; volume: number }[] {
    const volumeMap = new Map<string, number>();
    if (volumes) {
      for (const [ts, vol] of volumes) {
        const d = new Date(ts);
        d.setUTCHours(0, 0, 0, 0);
        volumeMap.set(d.toISOString(), vol);
      }
    }

    const seen = new Set<string>();
    return ohlc
      .map(([ts, open, high, low, close]) => {
        const d = new Date(ts);
        d.setUTCHours(0, 0, 0, 0);
        const dateStr = d.toISOString();
        if (seen.has(dateStr)) return null;
        seen.add(dateStr);
        return {
          date: dateStr,
          open,
          high,
          low,
          close,
          volume: volumeMap.get(dateStr) ?? 0,
        };
      })
      .filter(Boolean) as { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  }

  /**
   * Convert CoinGecko market_chart prices to OHLCV.
   * market_chart only gives price (close) + volume — we synthesize O/H/L from close.
   */
  static marketChartToOHLCV(
    chart: CoinGeckoMarketChart,
  ): { date: string; open: number; high: number; low: number; close: number; volume: number }[] {
    const volumeMap = new Map<string, number>();
    for (const [ts, vol] of chart.total_volumes) {
      const d = new Date(ts);
      d.setUTCHours(0, 0, 0, 0);
      volumeMap.set(d.toISOString(), vol);
    }

    const seen = new Set<string>();
    return chart.prices
      .map(([ts, price]) => {
        const d = new Date(ts);
        d.setUTCHours(0, 0, 0, 0);
        const dateStr = d.toISOString();
        if (seen.has(dateStr)) return null;
        seen.add(dateStr);
        return {
          date: dateStr,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volumeMap.get(dateStr) ?? 0,
        };
      })
      .filter(Boolean) as { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  }
}
