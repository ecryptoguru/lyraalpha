import { MarketContextSnapshot } from "@/lib/engines/market-regime";

export interface CryptoMappingDTO {
  symbol: string;
  name: string;
  inclusionReason: string | null;
  assetId: string;
  type: string; // CRYPTO, DEFI, NFTS, LAYER1, LAYER2, etc.
  currency: string; // USD, INR, etc.
  metadata?: Record<string, unknown> | null;

  // Scoring
  scores: {
    relevance: number;
    freshness: number;
    strength: number;
    density: number;
    behavior: number;
    eligibility: number;
  };

  // Metrics
  metrics: {
    marketCap: number | null;
    oneYearChange: number | null;
    technicalRating: string | null;
    analystRating: string | null;
  };

  evidence: { sourceType: string; title: string; url: string | null; excerpt: string | null }[];
  confidence: number;
  lastValidatedAt: string | null; // ISO string

  // Institutional Signals (Optional, injected during sync)
  signals?: {
    trend: number;
    momentum: number;
    volatility: number;
    liquidity: number;
    sentiment: number;
    trust: number;
  };
}

export interface DiscoverySectorDTO {
  slug: string;
  name: string;
  description: string | null;
  rationale: string | null;
  drivers: string | null;
  sectorId: string;

  // Market context for the sector
  marketContext?: MarketContextSnapshot;

  tiers: {
    Strong: CryptoMappingDTO[];
    Moderate: CryptoMappingDTO[];
    Emerging: CryptoMappingDTO[];
    Peripheral: CryptoMappingDTO[];
  };
}
