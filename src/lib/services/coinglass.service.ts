/**
 * CoinGlass API Service
 * Provides derivatives data: open interest, funding rates, liquidations.
 * ⚠️ NO free tier — minimum is Hobbyist at $29/mo (30 req/min).
 * Docs: https://docs.coinglass.com
 * Pricing: https://www.coinglass.com/pricing
 */

import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "coinglass" });

const BASE_URL = "https://open-api.coinglass.com/public/v2";
const API_KEY = process.env.COINGLASS_API_KEY || "";

// Hobbyist tier: 30 req/min → 2200ms delay for safety
const RATE_LIMIT_DELAY_MS = 2200;
const MAX_RETRIES = 3;

const CACHE_TTL = {
  OPEN_INTEREST: 300,    // 5 min — changes frequently
  FUNDING_RATE: 300,     // 5 min
  LIQUIDATION: 600,      // 10 min
  OI_HISTORY: 3600,      // 1 hour — historical
} as const;

let lastRequestTime = 0;
let requestQueue: Promise<void> = Promise.resolve();

async function rateLimitedFetch(url: string, retries = 0): Promise<Response> {
  const ticket = requestQueue;
  let resolve: () => void;
  requestQueue = new Promise<void>((r) => { resolve = r; });

  await ticket;

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
  resolve!();

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "coinglassSecret": API_KEY,
  };

  const res = await fetch(url, { headers, next: { revalidate: 0 } });

  if (res.status === 429 && retries < MAX_RETRIES) {
    const backoff = Math.pow(2, retries + 1) * 1000;
    logger.warn({ url, retries, backoff }, "CoinGlass rate limited, backing off");
    await new Promise((r) => setTimeout(r, backoff));
    return rateLimitedFetch(url, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CoinGlass API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface OpenInterestData {
  symbol: string;           // e.g. "BTC"
  openInterest: number;     // in USD
  openInterestChange24h: number | null;  // percentage
  volume: number | null;
  lastUpdated: string;
}

export interface FundingRateData {
  symbol: string;
  fundingRate: number;      // e.g. 0.0001 = 0.01%
  fundingRateNext: number | null;
  annualizedRate: number | null;
  lastUpdated: string;
}

export interface LiquidationData {
  symbol: string;
  longLiquidation24h: number | null;
  shortLiquidation24h: number | null;
  totalLiquidation24h: number | null;
  lastUpdated: string;
}

export interface CoinGlassDerivativesSummary {
  openInterest: OpenInterestData | null;
  fundingRate: FundingRateData | null;
  liquidation: LiquidationData | null;
}

// ─── Service ────────────────────────────────────────────────────────

export class CoinGlassService {
  /**
   * Get open interest for all symbols.
   * GET /open-interest?time_type=h24
   */
  static async getOpenInterest(): Promise<OpenInterestData[]> {
    if (!API_KEY) {
      logger.debug("COINGLASS_API_KEY not set — skipping open interest fetch");
      return [];
    }

    const cacheKey = "cglass:oi:all";
    const cached = await getCache<OpenInterestData[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/open-interest?time_type=h24&symbol=BTC`);
      const json = await res.json();
      const data = json.data as Array<Record<string, unknown>>;

      const results: OpenInterestData[] = (data || []).map((item) => ({
        symbol: String(item.symbol || ""),
        openInterest: Number(item.openInterest || 0),
        openInterestChange24h: item.change != null ? Number(item.change) : null,
        volume: item.volume != null ? Number(item.volume) : null,
        lastUpdated: new Date().toISOString(),
      }));

      await setCache(cacheKey, results, CACHE_TTL.OPEN_INTEREST);
      logger.info({ count: results.length }, "Fetched CoinGlass open interest");
      return results;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getOpenInterest failed");
      return [];
    }
  }

  /**
   * Get funding rates for all symbols.
   * GET /funding-rate/v2/home
   */
  static async getFundingRates(): Promise<FundingRateData[]> {
    if (!API_KEY) {
      logger.debug("COINGLASS_API_KEY not set — skipping funding rate fetch");
      return [];
    }

    const cacheKey = "cglass:funding:all";
    const cached = await getCache<FundingRateData[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/funding-rate/v2/home`);
      const json = await res.json();
      const data = json.data as Array<Record<string, unknown>>;

      const results: FundingRateData[] = (data || []).map((item) => ({
        symbol: String(item.symbol || ""),
        fundingRate: Number(item.rate || 0),
        fundingRateNext: item.nextRate != null ? Number(item.nextRate) : null,
        annualizedRate: item.annualizedRate != null ? Number(item.annualizedRate) : null,
        lastUpdated: new Date().toISOString(),
      }));

      await setCache(cacheKey, results, CACHE_TTL.FUNDING_RATE);
      logger.info({ count: results.length }, "Fetched CoinGlass funding rates");
      return results;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getFundingRates failed");
      return [];
    }
  }

  /**
   * Get liquidation data for all symbols.
   * GET /liquidation/home
   */
  static async getLiquidations(): Promise<LiquidationData[]> {
    if (!API_KEY) {
      logger.debug("COINGLASS_API_KEY not set — skipping liquidation fetch");
      return [];
    }

    const cacheKey = "cglass:liq:all";
    const cached = await getCache<LiquidationData[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/liquidation/home`);
      const json = await res.json();
      const data = json.data as Array<Record<string, unknown>>;

      const results: LiquidationData[] = (data || []).map((item) => ({
        symbol: String(item.symbol || ""),
        longLiquidation24h: item.longLiq24h != null ? Number(item.longLiq24h) : null,
        shortLiquidation24h: item.shortLiq24h != null ? Number(item.shortLiq24h) : null,
        totalLiquidation24h: item.totalLiq24h != null ? Number(item.totalLiq24h) : null,
        lastUpdated: new Date().toISOString(),
      }));

      await setCache(cacheKey, results, CACHE_TTL.LIQUIDATION);
      logger.info({ count: results.length }, "Fetched CoinGlass liquidations");
      return results;
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "getLiquidations failed");
      return [];
    }
  }

  /**
   * Get a combined derivatives summary for a specific symbol.
   * Maps our symbol format (BTC-USD) to CoinGlass format (BTC).
   */
  static async getDerivativesSummary(symbol: string): Promise<CoinGlassDerivativesSummary> {
    const cgSymbol = symbol.replace("-USD", "").replace("-USDT", "");

    const [oiList, frList, liqList] = await Promise.all([
      this.getOpenInterest(),
      this.getFundingRates(),
      this.getLiquidations(),
    ]);

    const oi = oiList.find((d) => d.symbol === cgSymbol) || null;
    const fr = frList.find((d) => d.symbol === cgSymbol) || null;
    const liq = liqList.find((d) => d.symbol === cgSymbol) || null;

    return { openInterest: oi, fundingRate: fr, liquidation: liq };
  }
}
