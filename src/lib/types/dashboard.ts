import { RegimeState, MarketContextSnapshot } from "@/lib/engines/market-regime";

export interface DashboardEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  date: Date;
  severity: string;
}

export interface FeaturedAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  type: "STOCK" | "MUTUAL_FUND" | "ETF";
}

export interface TopMover {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  type: "STOCK" | "ETF" | "CRYPTO" | "COMMODITY" | "MUTUAL_FUND";
}

export interface CrossSectorCorrelation {
  avgCorrelation: number;
  regime: "MACRO_DRIVEN" | "SECTOR_SPECIFIC" | "TRANSITIONING";
  trend: "RISING" | "STABLE" | "FALLING";
  sectorDispersionIndex: number;
  guidance: string;
}

export interface DashboardData {
  regime: {
    state: RegimeState;
    breadth: number;
    volatility: number;
    context: string;
    crossSectorCorrelation?: CrossSectorCorrelation;
  };
  multiHorizon: {
    current: MarketContextSnapshot;
    timeframes: {
      shortTerm: MarketContextSnapshot;
      mediumTerm: MarketContextSnapshot;
      longTerm: MarketContextSnapshot;
    };
    transition: {
      probability: number;
      direction: string;
      leadingIndicators: string[];
    };
    interpretation: {
      summary: string;
      alignment: string;
      transitionRisk: string;
    };
  } | null;
  events: DashboardEvent[];
  featuredAssets?: FeaturedAsset[];
  topGainers?: TopMover[];
  topLosers?: TopMover[];
  marketStats?: {
    totalAssets: number;
    advancers: number;
    decliners: number;
    avgChange: number;
  };
}
