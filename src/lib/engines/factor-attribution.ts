import { OHLCV } from "./types";
import { cleanHistory, dailyReturns, stdDev } from "./utils";

export interface FactorProfile {
  value: number; // Value factor score (0-100)
  growth: number; // Growth factor score (0-100)
  momentum: number; // Momentum factor score (0-100)
  volatility: number; // Volatility factor score (0-100)
  lowVol: number; // Low volatility factor (inverse of volatility, for scenario engine compatibility)
}

export function calculateFactorProfile(
  _symbol: string,
  history: OHLCV[],
  financials: {
    oneYearChange?: number | null;
  },
): FactorProfile {
  const cleanData = cleanHistory(history);

  // 1. Value Factor — crypto: distance from 52-week high as value proxy
  let valueScore = 50;
  if (cleanData.length >= 20) {
    const last = cleanData[cleanData.length - 1].close;
    const prices = cleanData.slice(-252).map(h => h.close);
    const high52w = Math.max(...prices);
    const low52w = Math.min(...prices);
    const range = high52w - low52w;
    if (range > 0) {
      const positionInRange = (last - low52w) / range;
      // Invert: closer to low = higher "value"
      valueScore = (1 - positionInRange) * 70 + 15;
    }
  }

  // 2. Growth Factor (Price velocity and fundamental proxy)
  let growthScore = 50;
  if (cleanData.length >= 20) {
    // Calculate annualized price growth so that history length doesn't conflate with growth rate
    const startPrice = cleanData[0].close;
    const endPrice = cleanData[cleanData.length - 1].close;
    const totalGrowth = (endPrice - startPrice) / startPrice; // growth as decimal
    const tradingDays = cleanData.length - 1;
    const annualizedGrowth = totalGrowth * (252 / tradingDays); // normalize to 1-year equivalent
    // More lenient: 50 base, +10 for each 10% annualized growth
    growthScore = Math.min(95, Math.max(10, 50 + annualizedGrowth * 100));
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
    const returns = dailyReturns(cleanData.map(h => h.close));
    const annualizedVol = stdDev(returns) * Math.sqrt(252); // Annualized

    // Normalize: Higher score = LOWER volatility
    // Refined scaling: More conservative for outliers. 
    // If annualizedVol = 0.2 (20% vol, typical blue chip), score = 100 - 12 = 88.
    // If annualizedVol = 1.0 (100% vol, high risk), score = 100 - 60 = 40.
    // If annualizedVol = 2.0 (200% vol, extreme noise), score = 100 - 120 = -20 -> clamped to 10.
    volScore = Math.min(95, Math.max(10, 100 - annualizedVol * 60));
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
