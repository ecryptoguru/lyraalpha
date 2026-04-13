import { AssetSignals, CompatibilityResult } from "@/lib/engines/compatibility";
import { GroupingResult } from "@/lib/engines/grouping";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { SignalStrengthResult } from "@/lib/engines/signal-strength";

export interface ScoreDynamics {
  momentum: number;
  acceleration: number;
  volatility: number;
  trend: "IMPROVING" | "STABLE" | "DETERIORATING";
  percentileRank: number;
  sectorPercentile: number;
}

export interface EventImpact {
  adjustedScore: number;
  impactMagnitude: number;
  recentEvents: number;
  maxSeverity?: "MEDIUM" | "HIGH" | "LOW";
}

export interface AssetAnalyticsResponse {
  symbol: string;
  name: string;
  type: string;
  price: number;
  changePercent: number;
  lastUpdated: Date | string | null;
  signals: AssetSignals;
  compatibility: CompatibilityResult;
  grouping: GroupingResult;
  marketContext: MarketContextSnapshot;
  scoreDynamics: Record<string, ScoreDynamics>;
  eventAdjustedScores: Record<string, EventImpact>;
  correlationRegime: {
    avgCorrelation: number;
    dispersion: number;
    trend: string;
    regime: string;
    confidence: string;
    implications: string;
  };
  factorAlignment: {
    score: number;
    dominantFactor: string;
    regimeFit: "STRONG" | "MODERATE" | "WEAK";
    breakdown: Record<string, number>;
    explanation: string;
  } | null;
  factorData: Record<string, number> | null;
  correlationData: Record<string, number> | null;
  events: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    severity: string;
    date: string;
    metadata: Record<string, unknown> | null;
  }[];
  technicalMetrics: {
    marketCap: number | null;
    peRatio: number | null;
    volume?: number | null;
    avgVolume?: number | null;
    dividendYield: number | null;
    industryPe: number | null;
    oneYearChange?: number | null;
    eps: number | null;
    roe: number | null;
    roce: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    shortRatio: number | null;
    nav: number | null;
    yield: number | null;
    morningstarRating: string | null;
    category: string | null;
    openInterest: number | null;
    distanceFrom52WHigh: number | null;
    distanceFrom52WLow: number | null;
    [key: string]: unknown;
  };
  performance: {
    returns: Record<string, number | null>;
    range52W: {
      high: number | null;
      low: number | null;
      currentPosition: number | null;
      distanceFromHigh: number | null;
      distanceFromLow: number | null;
    };
  };
  signalStrength: SignalStrengthResult | null;
  metadata: Record<string, unknown> | null;
}

export interface ChartMarker {
  time: string | number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "circle" | "arrowUp" | "arrowDown" | "square";
  text?: string;
  size?: number;
}
