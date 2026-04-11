import { createLogger } from "@/lib/logger";
import { getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "defillama" });

const BASE_URL = "https://api.llama.fi";

// Cache TTLs (seconds)
const CACHE_TTL = {
  PROTOCOLS: 3600,     // 1 hour — full protocol list
  PROTOCOL: 3600,      // 1 hour — single protocol detail
  CHAINS: 3600,        // 1 hour — chain TVL
  STABLECOINS: 3600,   // 1 hour
} as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  chainTvls: Record<string, number>;
  chains: string[];
  category: string;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  mcap: number | null;
  fdv: number | null;
}

export interface DefiLlamaProtocolDetail {
  id: string;
  name: string;
  symbol: string;
  tvl: { date: number; totalLiquidityUSD: number }[];
  chainTvls: Record<string, { tvl: { date: number; totalLiquidityUSD: number }[] }>;
  chains: string[];
  category: string;
  mcap: number | null;
}

export interface DefiLlamaChain {
  gecko_id: string | null;
  tvl: number;
  tokenSymbol: string;
  cmcId: string | null;
  name: string;
  chainId: number | null;
}

// ─── Mapping: CoinGecko ID → DefiLlama slug ────────────────────────

const COINGECKO_TO_DEFILLAMA: Record<string, string> = {
  ethereum: "Ethereum",
  solana: "Solana",
  "avalanche-2": "Avalanche",
  binancecoin: "BSC",
  "matic-network": "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  fantom: "Fantom",
  near: "Near",
  cosmos: "Cosmos",
  sui: "Sui",
  aptos: "Aptos",
  tron: "Tron",
  cardano: "Cardano",
  polkadot: "Polkadot",
  algorand: "Algorand",
  stellar: "Stellar",
  "internet-computer": "ICP",
  injective: "Injective",
  sei: "Sei",
  celestia: "Celestia",
  stacks: "Stacks",
  thorchain: "THORChain",
  "immutable-x": "ImmutableX",
  mantle: "Mantle",
};

// Protocol-level mapping (for DeFi tokens like UNI, AAVE, MKR, etc.)
const COINGECKO_TO_PROTOCOL: Record<string, string> = {
  uniswap: "uniswap-v3",
  aave: "aave-v3",
  maker: "makerdao",
  "curve-dao-token": "curve-dex",
  "lido-dao": "lido",
  "the-graph": "the-graph-protocol",
  chainlink: "chainlink",
  "render-token": "render-network",
  filecoin: "filecoin",
  "fetch-ai": "fetch-ai",
  "axie-infinity": "axie-infinity",
  "the-sandbox": "the-sandbox",
  decentraland: "decentraland",
  "compound-governance-token": "compound-v3",
  "havven": "synthetix",
  "1inch": "1inch-network",
  kava: "kava-lend",
  pancakeswap: "pancakeswap-amm-v3",
  "theta-fuel": "theta-network",
};

// ─── Service ────────────────────────────────────────────────────────

export class DefiLlamaService {
  /**
   * Get all protocols with TVL data.
   * GET /protocols
   */
  static async getProtocols(): Promise<DefiLlamaProtocol[]> {
    const cacheKey = "dl:protocols";
    const cached = await getCache<DefiLlamaProtocol[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${BASE_URL}/protocols`, { next: { revalidate: 0 } });
      if (!res.ok) throw new Error(`DefiLlama /protocols ${res.status}`);
      const data: DefiLlamaProtocol[] = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.PROTOCOLS);
      logger.debug({ count: data.length }, "Fetched DefiLlama protocols");
      return data;
    } catch (err) {
      logger.error({ err: String(err) }, "getProtocols failed");
      return [];
    }
  }

  /**
   * Get detailed TVL history for a single protocol.
   * GET /protocol/{slug}
   */
  static async getProtocolDetail(slug: string): Promise<DefiLlamaProtocolDetail | null> {
    const cacheKey = `dl:protocol:${slug}`;
    const cached = await getCache<DefiLlamaProtocolDetail>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${BASE_URL}/protocol/${slug}`, { next: { revalidate: 0 } });
      if (!res.ok) throw new Error(`DefiLlama /protocol/${slug} ${res.status}`);
      const data: DefiLlamaProtocolDetail = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.PROTOCOL);
      return data;
    } catch (err) {
      logger.error({ err: String(err), slug }, "getProtocolDetail failed");
      return null;
    }
  }

  /**
   * Get TVL for all chains.
   * GET /v2/chains
   */
  static async getChains(): Promise<DefiLlamaChain[]> {
    const cacheKey = "dl:chains";
    const cached = await getCache<DefiLlamaChain[]>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${BASE_URL}/v2/chains`, { next: { revalidate: 0 } });
      if (!res.ok) throw new Error(`DefiLlama /v2/chains ${res.status}`);
      const data: DefiLlamaChain[] = await res.json();
      await setCache(cacheKey, data, CACHE_TTL.CHAINS);
      logger.debug({ count: data.length }, "Fetched DefiLlama chains");
      return data;
    } catch (err) {
      logger.error({ err: String(err) }, "getChains failed");
      return [];
    }
  }

  /**
   * Get chain TVL for a specific chain name.
   */
  static async getChainTVL(chainName: string): Promise<number | null> {
    const chains = await this.getChains();
    const chain = chains.find(c => c.name.toLowerCase() === chainName.toLowerCase());
    return chain?.tvl ?? null;
  }

  /**
   * Find the DefiLlama chain name for a CoinGecko ID.
   */
  static getChainName(coingeckoId: string): string | null {
    return COINGECKO_TO_DEFILLAMA[coingeckoId] ?? null;
  }

  /**
   * Find the DefiLlama protocol slug for a CoinGecko ID.
   */
  static getProtocolSlug(coingeckoId: string): string | null {
    return COINGECKO_TO_PROTOCOL[coingeckoId] ?? null;
  }

  /**
   * Get TVL data for a crypto asset (chain or protocol level).
   * Returns { tvl, tvlChange7d, tvlChange30d, protocolCount, category }
   */
  static async getTVLData(coingeckoId: string): Promise<{
    tvl: number | null;
    tvlChange7d: number | null;
    tvlChange30d: number | null;
    protocolCount: number | null;
    category: string | null;
    isChain: boolean;
  } | null> {
    // Try chain-level first
    const chainName = this.getChainName(coingeckoId);
    if (chainName) {
      const chains = await this.getChains();
      const chain = chains.find(c => c.name === chainName);
      if (chain) {
        // Count protocols lazily — use cached protocol list, don't block on it
        let protocolCount: number | null = null;
        try {
          const protocols = await this.getProtocols();
          protocolCount = protocols.filter(p => p.chains.includes(chainName)).length;
        } catch (error) {
          logger.debug({ err: error, chainName }, "Failed to fetch protocols for protocol count (non-critical)");
        }
        return {
          tvl: chain.tvl,
          tvlChange7d: null,
          tvlChange30d: null,
          protocolCount,
          category: "Layer 1",
          isChain: true,
        };
      }
    }

    // Try protocol-level
    const protocolSlug = this.getProtocolSlug(coingeckoId);
    if (protocolSlug) {
      const protocols = await this.getProtocols();
      const protocol = protocols.find(p => p.slug === protocolSlug);
      if (protocol) {
        return {
          tvl: protocol.tvl,
          tvlChange7d: protocol.change_7d,
          tvlChange30d: null,
          protocolCount: null,
          category: protocol.category,
          isChain: false,
        };
      }
    }

    return null;
  }
}
