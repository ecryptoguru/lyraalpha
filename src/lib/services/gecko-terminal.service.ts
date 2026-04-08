import { createLogger } from "@/lib/logger";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "gecko-terminal" });

const BASE_URL = "https://api.geckoterminal.com/api/v2";

// Rate limit: 30 calls/min (free tier, no API key)
const RATE_LIMIT_DELAY_MS = 2200; // ~27 req/min with safety margin
let lastRequestTime = 0;

const CACHE_TTL = {
  TOKEN_POOLS: 1800,   // 30 min — pool data changes frequently
  TOKEN_INFO: 3600,    // 1 hour — token metadata
  TRENDING: 600,       // 10 min
} as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface GeckoTerminalPool {
  id: string;
  type: string;
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string | null;
    quote_token_price_usd: string | null;
    reserve_in_usd: string | null;
    pool_created_at: string | null;
    fdv_usd: string | null;
    market_cap_usd: string | null;
    price_change_percentage: {
      h1?: string;
      h6?: string;
      h24?: string;
    };
    transactions: {
      h1?: { buys: number; sells: number; buyers: number; sellers: number };
      h6?: { buys: number; sells: number; buyers: number; sellers: number };
      h24?: { buys: number; sells: number; buyers: number; sellers: number };
    };
    volume_usd: {
      h1?: string;
      h6?: string;
      h24?: string;
    };
  };
  relationships?: {
    dex?: { data: { id: string; type: string } };
    base_token?: { data: { id: string; type: string } };
    quote_token?: { data: { id: string; type: string } };
  };
}

export interface GeckoTerminalTokenInfo {
  id: string;
  type: string;
  attributes: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    coingecko_coin_id: string | null;
    image_url: string | null;
    websites: string[];
    gt_score: number | null;
    market_cap_usd: string | null;
    fdv_usd: string | null;
    total_reserve_in_usd: string | null;
    volume_usd: { h24: string | null };
    price_usd: string | null;
  };
}

export interface PoolLiquiditySummary {
  totalPools: number;
  totalReserveUsd: number;
  totalVolume24h: number;
  totalBuys24h: number;
  totalSells24h: number;
  totalBuyers24h: number;
  totalSellers24h: number;
  topPoolReserve: number;
  topPoolName: string;
  top3PoolConcentration: number; // % of total reserve in top 3 pools
  avgPoolReserve: number;
  dexCount: number;
  buyToSellRatio: number; // >1 = more buying pressure
}

// ─── CoinGecko ID → Contract Address Mapping ───────────────────────
// Primary chain contract addresses for our top 50 crypto universe.
// GeckoTerminal needs network + contract address to look up pools.

interface TokenContract {
  network: string;      // GeckoTerminal network slug
  address: string;      // Contract address on that network
}

const COINGECKO_TO_CONTRACT: Record<string, TokenContract> = {
  // Native chain tokens — use wrapped versions for DEX lookups
  ethereum:        { network: "eth",       address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" }, // WETH
  solana:          { network: "solana",    address: "So11111111111111111111111111111111111111112" },  // Wrapped SOL
  "avalanche-2":   { network: "avax",      address: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7" }, // WAVAX
  binancecoin:     { network: "bsc",       address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" }, // WBNB
  // ERC-20 tokens on Ethereum
  chainlink:       { network: "eth",       address: "0x514910771af9ca656af840dff83e8264ecf986ca" },
  uniswap:         { network: "eth",       address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984" },
  aave:            { network: "eth",       address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9" },
  maker:           { network: "eth",       address: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2" },
  "lido-dao":      { network: "eth",       address: "0x5a98fcbea516cf06857215779fd812ca3bef1b32" },
  "the-graph":     { network: "eth",       address: "0xc944e90c64b2c07662a292be6244bdf05cda44a7" },
  "curve-dao-token": { network: "eth",     address: "0xd533a949740bb3306d119cc777fa900ba034cd52" },
  "shiba-inu":     { network: "eth",       address: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce" },
  pepe:            { network: "eth",       address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
  "render-token":  { network: "eth",       address: "0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24" },
  "fetch-ai":      { network: "eth",       address: "0xaea46a60368a7bd060eec7df8cba43b7ef41ad85" },
  "immutable-x":   { network: "eth",       address: "0xf57e7e7c23978c3caec3c3548e3d615c346e79ff" },
  "axie-infinity": { network: "eth",       address: "0xbb0e17ef65f82ab018d8edd776e8dd940327b28b" },
  "the-sandbox":   { network: "eth",       address: "0x3845badade8e6dff049820680d1f14bd3903a5d0" },
  decentraland:    { network: "eth",       address: "0x0f5d2fb29fb7d3cfee444a200298f468908cc942" },
  // Multi-chain tokens
  arbitrum:        { network: "arbitrum",  address: "0x912ce59144191c1204e64559fe8253a0e49e6548" },
  optimism:        { network: "optimism",  address: "0x4200000000000000000000000000000000000042" },
  // Cosmos ecosystem — no DEX pool data on GeckoTerminal
  // cosmos, polkadot, cardano, stellar, etc. — skip
};

// ─── Rate-limited Fetch ─────────────────────────────────────────────

const MAX_RETRIES = 3;

async function rateLimitedFetch(url: string, attempt = 0): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`GeckoTerminal 429: rate limited after ${MAX_RETRIES} retries`);
    }
    const backoff = 5000 * (attempt + 1); // 5s, 10s, 15s
    logger.warn({ url, attempt, backoff }, "GeckoTerminal rate limited — backing off");
    await new Promise((r) => setTimeout(r, backoff));
    return rateLimitedFetch(url, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GeckoTerminal ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}

// ─── Service ────────────────────────────────────────────────────────

export class GeckoTerminalService {
  /**
   * Get top pools for a token on a specific network.
   * GET /networks/{network}/tokens/{address}/pools
   * Returns up to 20 pools ranked by liquidity + volume.
   */
  static async getTokenPools(
    network: string,
    tokenAddress: string,
  ): Promise<GeckoTerminalPool[]> {
    const cacheKey = `gt:pools:${network}:${tokenAddress.slice(0, 12)}`;
    const cached = await getCache<GeckoTerminalPool[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/networks/${network}/tokens/${tokenAddress}/pools?page=1`;
      const res = await rateLimitedFetch(url);
      const json = await res.json();
      const pools: GeckoTerminalPool[] = json.data || [];
      await setCache(cacheKey, pools, CACHE_TTL.TOKEN_POOLS);
      logger.debug({ network, pools: pools.length }, "Fetched GeckoTerminal pools");
      return pools;
    } catch (err) {
      logger.error({ err: String(err), network, tokenAddress }, "getTokenPools failed");
      return [];
    }
  }

  /**
   * Get token info by address on a network.
   * GET /networks/{network}/tokens/{address}
   */
  static async getTokenInfo(
    network: string,
    tokenAddress: string,
  ): Promise<GeckoTerminalTokenInfo | null> {
    const cacheKey = `gt:token:${network}:${tokenAddress.slice(0, 12)}`;
    const cached = await getCache<GeckoTerminalTokenInfo>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/networks/${network}/tokens/${tokenAddress}`;
      const res = await rateLimitedFetch(url);
      const json = await res.json();
      const token: GeckoTerminalTokenInfo = json.data;
      if (token) await setCache(cacheKey, token, CACHE_TTL.TOKEN_INFO);
      return token || null;
    } catch (err) {
      logger.error({ err: String(err), network, tokenAddress }, "getTokenInfo failed");
      return null;
    }
  }

  /**
   * Get the contract mapping for a CoinGecko ID.
   */
  static getContractForCoinGeckoId(coingeckoId: string): TokenContract | null {
    return COINGECKO_TO_CONTRACT[coingeckoId] ?? null;
  }

  /**
   * Compute a liquidity summary from pool data for a token.
   * This is the core data that feeds into the Liquidity Risk Score.
   */
  static computePoolLiquiditySummary(pools: GeckoTerminalPool[]): PoolLiquiditySummary | null {
    if (pools.length === 0) return null;

    let totalReserve = 0;
    let totalVolume = 0;
    let totalBuys = 0;
    let totalSells = 0;
    let totalBuyers = 0;
    let totalSellers = 0;
    const dexes = new Set<string>();
    const reserves: number[] = [];

    for (const pool of pools) {
      const attr = pool.attributes;
      const reserve = parseFloat(attr.reserve_in_usd || "0");
      const vol24h = parseFloat(attr.volume_usd?.h24 || "0");
      const txns = attr.transactions?.h24;

      totalReserve += reserve;
      totalVolume += vol24h;
      reserves.push(reserve);

      if (txns) {
        totalBuys += txns.buys;
        totalSells += txns.sells;
        totalBuyers += txns.buyers;
        totalSellers += txns.sellers;
      }

      const dexId = pool.relationships?.dex?.data?.id;
      if (dexId) dexes.add(dexId);
    }

    reserves.sort((a, b) => b - a);
    const top3Reserve = reserves.slice(0, 3).reduce((s, v) => s + v, 0);
    const top3Concentration = totalReserve > 0 ? (top3Reserve / totalReserve) * 100 : 100;

    return {
      totalPools: pools.length,
      totalReserveUsd: Math.round(totalReserve),
      totalVolume24h: Math.round(totalVolume),
      totalBuys24h: totalBuys,
      totalSells24h: totalSells,
      totalBuyers24h: totalBuyers,
      totalSellers24h: totalSellers,
      topPoolReserve: Math.round(reserves[0] || 0),
      topPoolName: pools[0]?.attributes?.name || "Unknown",
      top3PoolConcentration: Math.round(top3Concentration * 100) / 100,
      avgPoolReserve: pools.length > 0 ? Math.round(totalReserve / pools.length) : 0,
      dexCount: dexes.size,
      buyToSellRatio: totalSells > 0 ? Math.round((totalBuys / totalSells) * 100) / 100 : 1,
    };
  }

  /**
   * Full pipeline: get pool liquidity summary for a CoinGecko ID.
   * Returns null if the token doesn't have a known contract mapping.
   */
  static async getPoolSummaryForCoinGeckoId(
    coingeckoId: string,
  ): Promise<PoolLiquiditySummary | null> {
    const contract = this.getContractForCoinGeckoId(coingeckoId);
    if (!contract) return null;

    const pools = await this.getTokenPools(contract.network, contract.address);
    return this.computePoolLiquiditySummary(pools);
  }
}
