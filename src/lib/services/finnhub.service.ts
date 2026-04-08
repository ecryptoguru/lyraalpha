import { createLogger } from "@/lib/logger";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "finnhub" });

const BASE_URL = "https://finnhub.io/api/v1";
const API_KEY = process.env.FINNHUB_API_KEY || "";

// Free tier docs indicate 60 req/min; keep safety margin below that.
const RATE_LIMIT_DELAY_MS = 1300; // ~46 req/min effective ceiling
const MAX_RETRIES = 3;
let lastRequestTime = 0;
let requestQueue: Promise<void> = Promise.resolve();
// H2: Endpoint cooldowns and disables are persisted in Redis so they survive
// serverless cold starts. In-process queue + lastRequestTime are fine as
// module-level since QStash dedup ensures a single cron instance at a time.
const ENDPOINT_DISABLE_SECONDS = 12 * 60 * 60; // 12 hours
const COOLDOWN_KEY_PREFIX = "fh:cooldown:";
const DISABLE_KEY_PREFIX = "fh:disabled:";

function endpointSlug(path: string): string {
  return path.replace(/\//g, "_").replace(/^_/, "");
}

async function isEndpointDisabled(endpoint: string): Promise<boolean> {
  const key = `${DISABLE_KEY_PREFIX}${endpointSlug(endpoint)}`;
  const val = await getCache<string>(key);
  return val !== null;
}

async function disableEndpoint(endpoint: string): Promise<void> {
  const key = `${DISABLE_KEY_PREFIX}${endpointSlug(endpoint)}`;
  await setCache(key, "1", ENDPOINT_DISABLE_SECONDS);
}

async function getEndpointCooldown(endpoint: string): Promise<number> {
  const key = `${COOLDOWN_KEY_PREFIX}${endpointSlug(endpoint)}`;
  const val = await getCache<number>(key);
  return val ?? 0;
}

async function setEndpointCooldown(endpoint: string, durationMs: number): Promise<void> {
  const key = `${COOLDOWN_KEY_PREFIX}${endpointSlug(endpoint)}`;
  const ttlSeconds = Math.ceil(durationMs / 1000);
  await setCache(key, Date.now() + durationMs, ttlSeconds);
}

const CACHE_TTL = {
  NEWS: 1800,              // 30 min
  SENTIMENT: 3600,         // 1 hour
  INSIDER: 86400,          // 24 hours
  INSIDER_SENTIMENT: 86400,// 24 hours
  EARNINGS_CALENDAR: 3600, // 1 hour
  RECOMMENDATION: 86400,   // 24 hours
  PRICE_TARGET: 86400,     // 24 hours
  BASIC_FINANCIALS: 86400, // 24 hours
  COMPANY_PROFILE: 86400,  // 24 hours
  PEERS: 86400,            // 24 hours
  UPGRADE_DOWNGRADE: 86400,// 24 hours
  ETF_PROFILE: 86400,      // 24 hours
  ETF_HOLDINGS: 86400,     // 24 hours
  ECONOMIC_CALENDAR: 3600, // 1 hour
  QUOTE: 300,              // 5 min
  IPO_CALENDAR: 86400,     // 24 hours
  MARKET_NEWS: 1800,       // 30 min
} as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface FinnhubCompanyNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubNewsSentiment {
  buzz: { articlesInLastWeek: number; buzz: number; weeklyAverage: number };
  companyNewsScore: number;
  sectorAverageBullishPercent: number;
  sectorAverageNewsScore: number;
  sentiment: { bearishPercent: number; bullishPercent: number };
  symbol: string;
}

export interface FinnhubInsiderTransaction {
  name: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
  symbol: string;
}

export interface FinnhubInsiderSentiment {
  symbol: string;
  data: {
    symbol: string;
    year: number;
    month: number;
    change: number;
    mspr: number; // Monthly Share Purchase Ratio
  }[];
}

export interface FinnhubEarningsCalendarEvent {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export interface FinnhubPriceTarget {
  lastUpdated: string;
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
}

export interface FinnhubBasicFinancials {
  metric: Record<string, number | null>;
  metricType: string;
  series: Record<string, { period: string; v: number }[]>;
  symbol: string;
}

export interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export interface FinnhubUpgradeDowngrade {
  symbol: string;
  gradeTime: number;
  company: string;
  fromGrade: string;
  toGrade: string;
  action: string;
}

export interface FinnhubETFProfile {
  symbol: string;
  profile: {
    name: string;
    assetClass: string;
    aum: number;
    avgVolume: number;
    cusip: string;
    description: string;
    dividendYield: number;
    domicile: string;
    etfCompany: string;
    expenseRatio: number;
    inceptionDate: string;
    investmentSegment: string;
    isInverse: boolean;
    isLeveraged: boolean;
    nav: number;
    priceToBook: number;
    priceToEarnings: number;
    trackingIndex: string;
    website: string;
  };
}

export interface FinnhubETFHolding {
  symbol: string;
  name: string;
  cusip: string;
  isin: string;
  percent: number;
  value: number;
  share: number;
  assetType: string;
}

export interface FinnhubEconomicEvent {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: string;
  prev: number | null;
  time: string;
  unit: string;
}

export interface FinnhubIPOEvent {
  date: string;
  exchange: string;
  name: string;
  numberOfShares: number;
  price: string;
  status: string;
  symbol: string;
  totalSharesValue: number;
}

export interface FinnhubQuote {
  c: number;  // current
  d: number;  // change
  dp: number; // change %
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
}

export interface FinnhubMarketNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// ─── Rate-limited Fetch ─────────────────────────────────────────────

async function rateLimitedFetch(url: string, attempt = 0): Promise<Response> {
  const endpoint = new URL(url).pathname;

  if (await isEndpointDisabled(endpoint)) {
    throw new Error(`Finnhub 403: endpoint temporarily disabled ${endpoint}`);
  }

  const cooldownUntil = await getEndpointCooldown(endpoint);
  if (cooldownUntil > Date.now()) {
    await new Promise((r) => setTimeout(r, cooldownUntil - Date.now()));
  }

  // Serialize all requests through a queue to avoid concurrency bursts.
  const ticket = requestQueue;
  const gate: { release: (() => void) | null } = { release: null };
  requestQueue = new Promise<void>((resolve) => {
    gate.release = resolve;
  });

  await ticket;

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
  gate.release?.();

  const res = await fetch(url, {
    headers: { "X-Finnhub-Token": API_KEY },
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`Finnhub 429: rate limited after ${MAX_RETRIES} retries`);
    }
    const backoff = 3000 * (attempt + 1);
    setEndpointCooldown(endpoint, backoff).catch(() => {});
    logger.warn({ url: url.split("?")[0], attempt, backoff }, "Finnhub rate limited — backing off");
    await new Promise((r) => setTimeout(r, backoff));
    return rateLimitedFetch(url, attempt + 1);
  }

  if (res.status === 403) {
    await disableEndpoint(endpoint).catch(() => {});
    const body = await res.text().catch(() => "");
    logger.warn({ endpoint, disabledForSeconds: ENDPOINT_DISABLE_SECONDS }, "Finnhub endpoint disabled due to 403");
    throw new Error(`Finnhub 403: ${body.slice(0, 200)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Finnhub ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

function buildUrl(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${BASE_URL}${path}?${qs}`;
}

// ─── Service ────────────────────────────────────────────────────────

export class FinnhubService {
  static isConfigured(): boolean {
    return !!API_KEY;
  }

  // ── News ──────────────────────────────────────────────────────────

  /**
   * Company-specific news for a symbol within a date range.
   * GET /company-news?symbol=AAPL&from=2024-01-01&to=2024-01-10
   */
  static async getCompanyNews(symbol: string, fromDate: string, toDate: string): Promise<FinnhubCompanyNews[]> {
    const cacheKey = `fh:news:${symbol}:${fromDate}`;
    const cached = await getCache<FinnhubCompanyNews[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/company-news", { symbol, from: fromDate, to: toDate });
      const res = await rateLimitedFetch(url);
      const data: FinnhubCompanyNews[] = await res.json();
      const limited = data.slice(0, 10); // Keep top 10 per symbol
      await setCache(cacheKey, limited, CACHE_TTL.NEWS);
      return limited;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getCompanyNews failed");
      return [];
    }
  }

  /**
   * General market news by category.
   * GET /news?category=general
   * Categories: general, forex, crypto, merger
   */
  static async getMarketNews(category: string = "general"): Promise<FinnhubMarketNews[]> {
    const cacheKey = `fh:marketnews:${category}`;
    const cached = await getCache<FinnhubMarketNews[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/news", { category });
      const res = await rateLimitedFetch(url);
      const data: FinnhubMarketNews[] = await res.json();
      const limited = data.slice(0, 20);
      await setCache(cacheKey, limited, CACHE_TTL.MARKET_NEWS);
      return limited;
    } catch (err) {
      logger.error({ err: String(err), category }, "getMarketNews failed");
      return [];
    }
  }

  // ── Sentiment ─────────────────────────────────────────────────────

  /**
   * News sentiment and buzz for a symbol.
   * GET /news-sentiment?symbol=AAPL
   */
  static async getNewsSentiment(symbol: string): Promise<FinnhubNewsSentiment | null> {
    const cacheKey = `fh:sentiment:${symbol}`;
    const cached = await getCache<FinnhubNewsSentiment>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/news-sentiment", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubNewsSentiment = await res.json();
      if (data?.symbol) {
        await setCache(cacheKey, data, CACHE_TTL.SENTIMENT);
      }
      return data?.symbol ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getNewsSentiment failed");
      return null;
    }
  }

  // ── Insider Data ──────────────────────────────────────────────────

  /**
   * Insider transactions for a symbol.
   * GET /stock/insider-transactions?symbol=AAPL
   */
  static async getInsiderTransactions(symbol: string): Promise<FinnhubInsiderTransaction[]> {
    const cacheKey = `fh:insider:${symbol}`;
    const cached = await getCache<FinnhubInsiderTransaction[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/insider-transactions", { symbol });
      const res = await rateLimitedFetch(url);
      const data = await res.json();
      const txns: FinnhubInsiderTransaction[] = (data?.data || []).slice(0, 20);
      await setCache(cacheKey, txns, CACHE_TTL.INSIDER);
      return txns;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getInsiderTransactions failed");
      return [];
    }
  }

  /**
   * Monthly insider sentiment (MSPR) for a symbol.
   * GET /stock/insider-sentiment?symbol=AAPL&from=2024-01-01&to=2025-01-01
   */
  static async getInsiderSentiment(symbol: string, fromDate: string, toDate: string): Promise<FinnhubInsiderSentiment | null> {
    const cacheKey = `fh:insidersent:${symbol}`;
    const cached = await getCache<FinnhubInsiderSentiment>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/insider-sentiment", { symbol, from: fromDate, to: toDate });
      const res = await rateLimitedFetch(url);
      const data: FinnhubInsiderSentiment = await res.json();
      if (data?.data?.length) {
        await setCache(cacheKey, data, CACHE_TTL.INSIDER_SENTIMENT);
      }
      return data?.data?.length ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getInsiderSentiment failed");
      return null;
    }
  }

  // ── Earnings ──────────────────────────────────────────────────────

  /**
   * Earnings calendar (upcoming and recent).
   * GET /calendar/earnings?from=2024-01-01&to=2024-03-01
   */
  static async getEarningsCalendar(fromDate: string, toDate: string): Promise<FinnhubEarningsCalendarEvent[]> {
    const cacheKey = `fh:earnings:${fromDate}:${toDate}`;
    const cached = await getCache<FinnhubEarningsCalendarEvent[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/calendar/earnings", { from: fromDate, to: toDate });
      const res = await rateLimitedFetch(url);
      const data = await res.json();
      const events: FinnhubEarningsCalendarEvent[] = data?.earningsCalendar || [];
      await setCache(cacheKey, events, CACHE_TTL.EARNINGS_CALENDAR);
      return events;
    } catch (err) {
      logger.error({ err: String(err) }, "getEarningsCalendar failed");
      return [];
    }
  }

  // ── Analyst Data ──────────────────────────────────────────────────

  /**
   * Recommendation trends for a symbol.
   * GET /stock/recommendation?symbol=AAPL
   */
  static async getRecommendationTrends(symbol: string): Promise<FinnhubRecommendation[]> {
    const cacheKey = `fh:rec:${symbol}`;
    const cached = await getCache<FinnhubRecommendation[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/recommendation", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubRecommendation[] = await res.json();
      const limited = Array.isArray(data) ? data.slice(0, 6) : [];
      await setCache(cacheKey, limited, CACHE_TTL.RECOMMENDATION);
      return limited;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getRecommendationTrends failed");
      return [];
    }
  }

  /**
   * Price target consensus for a symbol.
   * GET /stock/price-target?symbol=AAPL
   */
  static async getPriceTarget(symbol: string): Promise<FinnhubPriceTarget | null> {
    const cacheKey = `fh:pt:${symbol}`;
    const cached = await getCache<FinnhubPriceTarget>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/price-target", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubPriceTarget = await res.json();
      if (data?.targetMean) {
        await setCache(cacheKey, data, CACHE_TTL.PRICE_TARGET);
      }
      return data?.targetMean ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getPriceTarget failed");
      return null;
    }
  }

  /**
   * Upgrade/downgrade history for a symbol.
   * GET /stock/upgrade-downgrade?symbol=AAPL
   */
  static async getUpgradeDowngrade(symbol: string): Promise<FinnhubUpgradeDowngrade[]> {
    const cacheKey = `fh:ud:${symbol}`;
    const cached = await getCache<FinnhubUpgradeDowngrade[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/upgrade-downgrade", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubUpgradeDowngrade[] = await res.json();
      const limited = Array.isArray(data) ? data.slice(0, 10) : [];
      await setCache(cacheKey, limited, CACHE_TTL.UPGRADE_DOWNGRADE);
      return limited;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getUpgradeDowngrade failed");
      return [];
    }
  }

  // ── Fundamentals ──────────────────────────────────────────────────

  /**
   * Basic financials (60+ ratios + time-series).
   * GET /stock/metric?symbol=AAPL&metric=all
   */
  static async getBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
    const cacheKey = `fh:fin:${symbol}`;
    const cached = await getCache<FinnhubBasicFinancials>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/metric", { symbol, metric: "all" });
      const res = await rateLimitedFetch(url);
      const data: FinnhubBasicFinancials = await res.json();
      if (data?.metric && Object.keys(data.metric).length > 0) {
        await setCache(cacheKey, data, CACHE_TTL.BASIC_FINANCIALS);
      }
      return data?.metric ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getBasicFinancials failed");
      return null;
    }
  }

  /**
   * Company profile.
   * GET /stock/profile2?symbol=AAPL
   */
  static async getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile | null> {
    const cacheKey = `fh:profile:${symbol}`;
    const cached = await getCache<FinnhubCompanyProfile>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/profile2", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubCompanyProfile = await res.json();
      if (data?.ticker) {
        await setCache(cacheKey, data, CACHE_TTL.COMPANY_PROFILE);
      }
      return data?.ticker ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getCompanyProfile failed");
      return null;
    }
  }

  /**
   * Peer companies for a symbol.
   * GET /stock/peers?symbol=AAPL
   */
  static async getPeers(symbol: string): Promise<string[]> {
    const cacheKey = `fh:peers:${symbol}`;
    const cached = await getCache<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/stock/peers", { symbol });
      const res = await rateLimitedFetch(url);
      const data: string[] = await res.json();
      const peers = Array.isArray(data) ? data.filter(p => p !== symbol).slice(0, 10) : [];
      await setCache(cacheKey, peers, CACHE_TTL.PEERS);
      return peers;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getPeers failed");
      return [];
    }
  }

  // ── ETF Data ──────────────────────────────────────────────────────

  /**
   * ETF profile data.
   * GET /etf/profile?symbol=SPY
   */
  static async getETFProfile(symbol: string): Promise<FinnhubETFProfile | null> {
    const cacheKey = `fh:etfp:${symbol}`;
    const cached = await getCache<FinnhubETFProfile>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/etf/profile", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubETFProfile = await res.json();
      if (data?.profile?.name) {
        await setCache(cacheKey, data, CACHE_TTL.ETF_PROFILE);
      }
      return data?.profile?.name ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getETFProfile failed");
      return null;
    }
  }

  /**
   * ETF holdings.
   * GET /etf/holdings?symbol=SPY
   */
  static async getETFHoldings(symbol: string): Promise<FinnhubETFHolding[]> {
    const cacheKey = `fh:etfh:${symbol}`;
    const cached = await getCache<FinnhubETFHolding[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/etf/holdings", { symbol });
      const res = await rateLimitedFetch(url);
      const data = await res.json();
      const holdings: FinnhubETFHolding[] = (data?.holdings || []).slice(0, 25);
      await setCache(cacheKey, holdings, CACHE_TTL.ETF_HOLDINGS);
      return holdings;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getETFHoldings failed");
      return [];
    }
  }

  // ── Economic Calendar ─────────────────────────────────────────────

  /**
   * Economic calendar events.
   * GET /calendar/economic?from=2024-01-01&to=2024-01-31
   */
  static async getEconomicCalendar(fromDate: string, toDate: string): Promise<FinnhubEconomicEvent[]> {
    const cacheKey = `fh:econ:${fromDate}:${toDate}`;
    const cached = await getCache<FinnhubEconomicEvent[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/calendar/economic", { from: fromDate, to: toDate });
      const res = await rateLimitedFetch(url);
      const data = await res.json();
      const events: FinnhubEconomicEvent[] = (data?.economicCalendar || []).slice(0, 50);
      await setCache(cacheKey, events, CACHE_TTL.ECONOMIC_CALENDAR);
      return events;
    } catch (err) {
      logger.error({ err: String(err) }, "getEconomicCalendar failed");
      return [];
    }
  }

  // ── IPO Calendar ──────────────────────────────────────────────────

  /**
   * IPO calendar.
   * GET /calendar/ipo?from=2024-01-01&to=2024-03-01
   */
  static async getIPOCalendar(fromDate: string, toDate: string): Promise<FinnhubIPOEvent[]> {
    const cacheKey = `fh:ipo:${fromDate}:${toDate}`;
    const cached = await getCache<FinnhubIPOEvent[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/calendar/ipo", { from: fromDate, to: toDate });
      const res = await rateLimitedFetch(url);
      const data = await res.json();
      const events: FinnhubIPOEvent[] = (data?.ipoCalendar || []).slice(0, 30);
      await setCache(cacheKey, events, CACHE_TTL.IPO_CALENDAR);
      return events;
    } catch (err) {
      logger.error({ err: String(err) }, "getIPOCalendar failed");
      return [];
    }
  }

  // ── Quote ─────────────────────────────────────────────────────────

  /**
   * Real-time quote for a symbol.
   * GET /quote?symbol=AAPL
   */
  static async getQuote(symbol: string): Promise<FinnhubQuote | null> {
    const cacheKey = `fh:quote:${symbol}`;
    const cached = await getCache<FinnhubQuote>(cacheKey);
    if (cached) return cached;

    try {
      const url = buildUrl("/quote", { symbol });
      const res = await rateLimitedFetch(url);
      const data: FinnhubQuote = await res.json();
      if (data?.c > 0) {
        await setCache(cacheKey, data, CACHE_TTL.QUOTE);
      }
      return data?.c > 0 ? data : null;
    } catch (err) {
      logger.error({ err: String(err), symbol }, "getQuote failed");
      return null;
    }
  }
}
