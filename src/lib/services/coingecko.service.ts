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

// Demo tier: ~30 requests/minute (official docs: "varies depending on traffic")
// Using 2100ms → ~28 req/min with safety margin for traffic spikes
const RATE_LIMIT_DELAY_MS = 2100;
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

// ─── Token-bucket rate limiter (replaces serial promise queue) ────────────
// Demo tier: ~30 requests/minute.  We allow a small burst (3) and then
// enforce a 2100ms minimum gap between request *starts* to stay well under
// the limit even during traffic spikes.  This prevents the old serial-queue
// bottleneck where request N had to wait for request N-1 to finish entirely.
const MAX_CONCURRENCY = 3;
let lastRequestTime = 0;
let inFlight = 0;
const waiting: Array<(release: () => void) => void> = [];

function processWaiting() {
  while (inFlight < MAX_CONCURRENCY && waiting.length > 0) {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      setTimeout(processWaiting, RATE_LIMIT_DELAY_MS - elapsed);
      return;
    }
    lastRequestTime = now;
    inFlight++;
    const resolve = waiting.shift()!;
    resolve(() => {
      inFlight--;
      processWaiting();
    });
  }
}

async function acquireSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    waiting.push(resolve);
    processWaiting();
  });
}

async function rateLimitedFetch(url: string, retries = 0): Promise<Response> {
  const release = await acquireSlot();
  try {

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
  } finally {
    release();
  }
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

  /**
   * Get global market data (total market cap, volume, BTC dominance, etc.)
   * GET /global
   */
  static async getGlobalData(): Promise<{
    totalMarketCap: Record<string, number>;
    totalVolume: Record<string, number>;
    btcDominance: number;
    ethDominance: number;
    activeCryptocurrencies: number;
    markets: number;
  } | null> {
    const cacheKey = "cg:global";
    const cached = await getCache<{
      totalMarketCap: Record<string, number>;
      totalVolume: Record<string, number>;
      btcDominance: number;
      ethDominance: number;
      activeCryptocurrencies: number;
      markets: number;
    }>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/global`);
      const data = await res.json();
      await setCache(cacheKey, data, 300); // 5 min cache
      logger.info({ btcDominance: data.data.market_cap_percentage.btc }, "Fetched global market data");
      return {
        totalMarketCap: data.data.total_market_cap,
        totalVolume: data.data.total_volume,
        btcDominance: data.data.market_cap_percentage.btc,
        ethDominance: data.data.market_cap_percentage.eth,
        activeCryptocurrencies: data.data.active_cryptocurrencies,
        markets: data.data.markets,
      };
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getGlobalData failed");
      return null;
    }
  }

  /**
   * Get trending coins (top 7 trending coins on CoinGecko)
   * GET /search/trending
   */
  static async getTrendingCoins(): Promise<
    { id: string; name: string; symbol: string; marketCapRank: number | null; score: number }[]
  > {
    const cacheKey = "cg:trending";
    const cached = await getCache<{ id: string; name: string; symbol: string; marketCapRank: number | null; score: number }[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/search/trending`);
      const data = await res.json();
      await setCache(cacheKey, data, 600); // 10 min cache
      const coins = data.coins.map((item: Record<string, unknown>) => ({
        id: String((item.item as Record<string, unknown>).id),
        name: String((item.item as Record<string, unknown>).name),
        symbol: String((item.item as Record<string, unknown>).symbol),
        marketCapRank: (item.item as Record<string, unknown>).market_cap_rank as number | null,
        score: Number((item.item as Record<string, unknown>).score),
      }));
      logger.info({ count: coins.length }, "Fetched trending coins");
      return coins;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getTrendingCoins failed");
      return [];
    }
  }

  /**
   * Get exchange rates (crypto to fiat conversions)
   * GET /exchange_rates
   */
  static async getExchangeRates(): Promise<Record<string, { name: string; unit: string; value: number; type: string }>> {
    const cacheKey = "cg:exchange_rates";
    const cached = await getCache<Record<string, { name: string; unit: string; value: number; type: string }>>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/exchange_rates`);
      const data = await res.json();
      await setCache(cacheKey, data, 86400); // 24 hour cache
      logger.info({ count: Object.keys(data.rates).length }, "Fetched exchange rates");
      return data.rates;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getExchangeRates failed");
      return {};
    }
  }

  /**
   * Get coin categories (DeFi, NFT, Layer 1, etc.)
   * GET /coins/categories
   */
  static async getCoinCategories(): Promise<
    { id: string; name: string; marketCap: number; marketCapChange24h: number; volume: number }[]
  > {
    const cacheKey = "cg:categories";
    const cached = await getCache<{ id: string; name: string; marketCap: number; marketCapChange24h: number; volume: number }[]>(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({ order: "market_cap_desc" });
      const res = await rateLimitedFetch(`${BASE_URL}/coins/categories?${params}`);
      const data = await res.json();
      await setCache(cacheKey, data, 3600); // 1 hour cache
      const categories = data.map((cat: Record<string, unknown>) => ({
        id: String(cat.id),
        name: String(cat.name),
        marketCap: Number(cat.market_cap),
        marketCapChange24h: Number(cat.market_cap_change_24h),
        volume: Number(cat.volume_24h),
      }));
      logger.info({ count: categories.length }, "Fetched coin categories");
      return categories;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getCoinCategories failed");
      return [];
    }
  }
}
