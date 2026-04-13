export interface CryptoCardData {
  symbol: string;
  name: string;
  type?: string;

  // UI Scores
  eligibilityScore: number;
  confidence: number;

  // Key Metrics
  marketCap: string;
  oneYearChange: {
    value: string;
    isPositive: boolean;
  };

  // Ratings
  technicalRating: string;
  analystRating: string;

  // Evidence and ID
  evidenceCount: number;
  assetId: string;
  sectorId: string;

  // Institutional Signals (Optional)
  signals?: {
    trend: number;
    momentum: number;
    volatility: number;
    liquidity: number;
    sentiment: number;
    trust: number;
  };
}
