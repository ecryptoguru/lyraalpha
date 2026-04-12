/**
 * Messari API Service
 * Provides research-grade crypto fundamentals: protocol revenue, P/S ratios,
 * tokenomics, sector classification, and governance data.
 *
 * Free tier (no API key): 20 req/min, 1000 req/day
 * Free account (with API key): 30 req/min, 2000 req/day
 * Pro: 60 req/min, 4000 req/day
 *
 * Docs: https://docs.messari.io
 * Pricing: https://messari.io/pricing
 */

import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "messari" });

const BASE_URL = "https://data.messari.io/api/v2";
const API_KEY = process.env.MESSARI_API_KEY || "";

// Free account (with API key): 30 req/min → 2200ms delay
// Free tier (no key): 20 req/min → 3200ms delay
// Using 3200ms to be safe regardless of key presence
const RATE_LIMIT_DELAY_MS = 3200;
const MAX_RETRIES = 3;

const CACHE_TTL = {
  ASSET_PROFILE: 86400,    // 24 hours — changes rarely
  METRICS: 3600,            // 1 hour — financial metrics
  SECTOR: 86400,            // 24 hours
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
  };
  if (API_KEY) {
    headers["x-messari-api-key"] = API_KEY;
  }

  const res = await fetch(url, { headers, next: { revalidate: 0 } });

  if (res.status === 429 && retries < MAX_RETRIES) {
    const backoff = Math.pow(2, retries + 1) * 2000;
    logger.warn({ url, retries, backoff }, "Messari rate limited, backing off");
    await new Promise((r) => setTimeout(r, backoff));
    return rateLimitedFetch(url, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Messari API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface MessariFinancials {
  revenue: number | null;           // Protocol revenue (annualized, USD)
  revenueChangeYtd: number | null;  // YoY revenue change %
  psRatio: number | null;           // Price-to-sales ratio
  peRatio: number | null;           // Price-to-earnings ratio
  marketCap: number | null;
  realVolume24h: number | null;
  yield: number | null;             // Staking/yield %
  sector: string | null;
  category: string | null;
  tokenCirculating: number | null;
  tokenTotal: number | null;
  tokenMax: number | null;
  inflationRate: number | null;     // Annual token inflation %
  unlockSchedule: string | null;    // Summary of upcoming unlocks
  governanceType: string | null;   // e.g. "DAO", "Foundation", "On-chain"
  lastUpdated: string;
}

export interface MessariAssetProfile {
  sector: string | null;
  category: string | null;
  tags: string[];
  governanceType: string | null;
  orgStructure: string | null;
  tokenUseCases: string[];
  consensusMechanism: string | null;
}

// ─── Service ────────────────────────────────────────────────────────

export class MessariService {
  /**
   * Get financial metrics for a specific asset.
   * GET /assets/{slug}/metrics
   * Messari uses lowercase slugs (e.g. "bitcoin", "ethereum").
   */
  static async getAssetMetrics(slug: string): Promise<MessariFinancials | null> {
    const cacheKey = `messari:metrics:${slug}`;
    const cached = await getCache<MessariFinancials>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/assets/${slug}/metrics`);
      const json = await res.json();
      const d = json.data as Record<string, unknown> | undefined;
      if (!d) return null;

      const metrics = (d.market_data as Record<string, unknown>) || {};
      const fundamentals = (d.fundamentals as Record<string, unknown>) || {};
      const profile = (d.profile as Record<string, unknown>) || {};
      const supply = (d.supply as Record<string, unknown>) || {};

      const result: MessariFinancials = {
        revenue: fundamentals.revenue_annual != null ? Number(fundamentals.revenue_annual) : null,
        revenueChangeYtd: fundamentals.revenue_change_ytd != null ? Number(fundamentals.revenue_change_ytd) : null,
        psRatio: fundamentals.ps_ratio != null ? Number(fundamentals.ps_ratio) : null,
        peRatio: fundamentals.pe_ratio != null ? Number(fundamentals.pe_ratio) : null,
        marketCap: metrics.marketcap != null ? Number(metrics.marketcap) : null,
        realVolume24h: metrics.real_volume_24h != null ? Number(metrics.real_volume_24h) : null,
        yield: fundamentals.yield != null ? Number(fundamentals.yield) : null,
        sector: (profile.sector as string) || null,
        category: (profile.category as string) || null,
        tokenCirculating: supply.circulating != null ? Number(supply.circulating) : null,
        tokenTotal: supply.total != null ? Number(supply.total) : null,
        tokenMax: supply.max != null ? Number(supply.max) : null,
        inflationRate: supply.inflation_rate != null ? Number(supply.inflation_rate) : null,
        unlockSchedule: (supply.unlock_schedule as string) || null,
        governanceType: (profile.governance_type as string) || null,
        lastUpdated: new Date().toISOString(),
      };

      await setCache(cacheKey, result, CACHE_TTL.METRICS);
      logger.debug({ slug, sector: result.sector }, "Fetched Messari metrics");
      return result;
    } catch (err) {
      logger.error({ err: sanitizeError(err), slug }, "getAssetMetrics failed");
      return null;
    }
  }

  /**
   * Get asset profile (sector, governance, token use cases, etc.)
   * GET /assets/{slug}/profile
   */
  static async getAssetProfile(slug: string): Promise<MessariAssetProfile | null> {
    const cacheKey = `messari:profile:${slug}`;
    const cached = await getCache<MessariAssetProfile>(cacheKey);
    if (cached) return cached;

    try {
      const res = await rateLimitedFetch(`${BASE_URL}/assets/${slug}/profile`);
      const json = await res.json();
      const d = json.data as Record<string, unknown> | undefined;
      if (!d) return null;

      const general = (d.general as Record<string, unknown>) || {};
      const governance = (d.governance as Record<string, unknown>) || {};
      const economics = (d.economics as Record<string, unknown>) || {};

      const result: MessariAssetProfile = {
        sector: (general.sector as string) || null,
        category: (general.category as string) || null,
        tags: Array.isArray(general.tags) ? (general.tags as string[]) : [],
        governanceType: (governance.governance_type as string) || null,
        orgStructure: (governance.org_structure as string) || null,
        tokenUseCases: Array.isArray(economics.token_use_cases)
          ? (economics.token_use_cases as string[])
          : [],
        consensusMechanism: (general.consensus_mechanism as string) || null,
      };

      await setCache(cacheKey, result, CACHE_TTL.ASSET_PROFILE);
      logger.debug({ slug, sector: result.sector }, "Fetched Messari profile");
      return result;
    } catch (err) {
      logger.error({ err: sanitizeError(err), slug }, "getAssetProfile failed");
      return null;
    }
  }

  /**
   * Map our internal symbol (BTC-USD) to Messari slug (bitcoin).
   * Uses the same CoinGecko ID → symbol mapping as a fallback heuristic.
   */
  static symbolToSlug(symbol: string): string {
    return symbol
      .replace("-USD", "")
      .replace("-USDT", "")
      .toLowerCase();
  }
}
