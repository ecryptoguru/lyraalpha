import { OHLCV } from "./types";
import { cleanHistory } from "./utils";

export interface FactorProfile {
  value: number; // Value factor score (0-100)
  growth: number; // Growth factor score (0-100)
  momentum: number; // Momentum factor score (0-100)
  volatility: number; // Volatility factor score (0-100)
  lowVol?: number; // Low volatility factor (inverse of volatility, for scenario engine compatibility)
}

export function calculateFactorProfile(
  symbol: string,
  history: OHLCV[],
  financials: {
    peRatio?: number | null;
    industryPe?: number | null;
    roe?: number | null;
    marketCap?: string | null;
    oneYearChange?: number | null;
  },
): FactorProfile {
  const isCrypto = symbol.includes("-USD") || symbol.includes("-USDT");
  const cleanData = cleanHistory(history);
  
  // 1. Value Factor (Lower PE relative to industry, Higher ROE)
  // For crypto: Use price vs 52-week range as "value" proxy
  let valueScore = 50;
  if (!isCrypto && financials.peRatio && financials.industryPe) {
    const peRel = financials.industryPe / financials.peRatio;
    valueScore = Math.min(100, Math.max(0, peRel * 50));
    if (financials.roe) {
      valueScore = (valueScore + Math.min(100, financials.roe * 2)) / 2;
    }
  } else if (cleanData.length >= 20) {
    // Crypto/commodity value: how far from 52-week high (higher = more value)
    const last = cleanData[cleanData.length - 1].close;
    const prices = cleanData.slice(-252).map(h => h.close);
    const high52w = Math.max(...prices);
    const low52w = Math.min(...prices);
    const range = high52w - low52w;
    if (range > 0) {
      const positionInRange = (last - low52w) / range;
      // Invert: closer to low = higher "value"
      valueScore = Math.round((1 - positionInRange) * 70 + 15);
    }
  }

  // 2. Growth Factor (Price velocity and fundamental proxy)
  let growthScore = 50;
  if (cleanData.length >= 20) {
    // Calculate actual price growth over available period
    const startPrice = cleanData[0].close;
    const endPrice = cleanData[cleanData.length - 1].close;
    const totalGrowth = (endPrice - startPrice) / startPrice; // growth as decimal
    // More lenient: 50 base, +10 for each 10% growth
    growthScore = Math.min(95, Math.max(10, 50 + totalGrowth * 100));
  } else if (financials.oneYearChange) {
    growthScore = Math.min(95, Math.max(10, 50 + financials.oneYearChange));
  }

  // 3. Momentum Factor (Recent performance vs longer term)
  let momentumScore = 50;
  const minHistoryForMomentum = Math.min(cleanData.length, 63); // Use what's available up to 3 months
  if (cleanData.length >= 20) {
    const last1m = cleanData.slice(-21);
    const last3m = cleanData.slice(-minHistoryForMomentum);
    
    const start1m = last1m[0].close;
    const end1m = last1m[last1m.length - 1].close;
    const mom1m = (end1m - start1m) / start1m;
    
    const start3m = last3m[0].close;
    const end3m = last3m[last3m.length - 1].close;
    const mom3m = (end3m - start3m) / start3m;
    
    // Weight recent momentum higher, scale by 50 (so 50% move = 25 pts change)
    momentumScore = Math.min(95, Math.max(10, 50 + mom1m * 50 + mom3m * 25));
  }

  // 4. Volatility Factor (Inverse of realized volatility)
  let volScore = 50;
  if (cleanData.length > 20) {
    const returns = [];
    for (let i = 1; i < cleanData.length; i++) {
      returns.push(
        (cleanData[i].close - cleanData[i - 1].close) / cleanData[i - 1].close,
      );
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance) * Math.sqrt(252); // Annualized

    // Normalize: Higher score = LOWER volatility
    // Refined scaling: More conservative for outliers. 
    // If stdDev = 0.2 (20% vol, typical blue chip), score = 100 - 12 = 88.
    // If stdDev = 1.0 (100% vol, high risk), score = 100 - 60 = 40.
    // If stdDev = 2.0 (200% vol, extreme noise), score = 100 - 120 = -20 -> clamped to 10.
    volScore = Math.min(95, Math.max(10, 100 - stdDev * 60));
  }

  const normalizedVolScore = Math.round(Math.max(10, Math.min(95, volScore)));

  return {
    value: Math.round(Math.max(10, Math.min(95, valueScore))),
    growth: Math.round(Math.max(10, Math.min(95, growthScore))),
    momentum: Math.round(Math.max(10, Math.min(95, momentumScore))),
    volatility: normalizedVolScore,
    lowVol: normalizedVolScore, // Same as volatility (higher = lower vol = more defensive)
  };
}
