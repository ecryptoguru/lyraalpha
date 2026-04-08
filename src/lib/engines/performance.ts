import { OHLCV } from "./types";

export interface PerformanceMetrics {
  returns: {
    "1D": number | null;
    "1W": number | null;
    "1M": number | null;
    "3M": number | null;
    "6M": number | null;
    YTD: number | null;
    "1Y": number | null;
  };
  range52W: {
    high: number | null;
    low: number | null;
    currentPosition: number | null; // 0-100 position in 52W range
    distanceFromHigh: number | null;
    distanceFromLow: number | null;
  };
}

/**
 * Calculates multi-timeframe returns and 52-week range metrics.
 */
export function calculatePerformance(history: OHLCV[]): PerformanceMetrics {
  if (history.length === 0) {
    return {
      returns: { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, YTD: null, "1Y": null },
      range52W: { high: null, low: null, currentPosition: null, distanceFromHigh: null, distanceFromLow: null }
    };
  }

  // Ensure history is sorted by date ascending
  const baseHistory = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  
  // Normalize to Daily bars: If multiple records exist for the same day, take the latest one.
  const dailyHistoryMap = new Map<string, OHLCV>();
  baseHistory.forEach(p => {
    const dayKey = new Date(p.date).toISOString().split('T')[0];
    dailyHistoryMap.set(dayKey, p);
  });
  
  const sortedHistory = Array.from(dailyHistoryMap.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (sortedHistory.length === 0) {
    return {
      returns: { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, YTD: null, "1Y": null },
      range52W: { high: null, low: null, currentPosition: null, distanceFromHigh: null, distanceFromLow: null }
    };
  }

  const currentPrice = sortedHistory[sortedHistory.length - 1].close;
  const now = new Date(sortedHistory[sortedHistory.length - 1].date);
  now.setHours(0, 0, 0, 0); // Normalize now to start of day for comparison

  const getReturn = (daysBack: number): number | null => {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - daysBack);
    
    // Binary search would be faster, but for < 1000 points, a simple reverse find is usually fine.
    // However, we avoid slice().reverse() which creates a new array every time.
    let point = null;
    for (let i = sortedHistory.length - 1; i >= 0; i--) {
      if (new Date(sortedHistory[i].date) <= targetDate) {
        point = sortedHistory[i];
        break;
      }
    }
    
    if (!point || point.close === 0) return null;
    return ((currentPrice - point.close) / point.close) * 100;
  };

  const getYTDReturn = (): number | null => {
    const startOfYear = new Date(now.getUTCFullYear(), 0, 1);
    const point = sortedHistory.find(p => new Date(p.date) >= startOfYear);
    if (!point || point.close === 0) return null;
    return ((currentPrice - point.close) / point.close) * 100;
  };

  // 52 Week High/Low
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const yearHistory = sortedHistory.filter(p => new Date(p.date) >= oneYearAgo);
  
  const high = yearHistory.length > 0 ? Math.max(...yearHistory.map(p => p.high)) : null;
  const low = yearHistory.length > 0 ? Math.min(...yearHistory.map(p => p.low)) : null;

  let currentPosition = null;
  let distanceFromHigh = null;
  let distanceFromLow = null;

  if (high && low && high !== low) {
    currentPosition = ((currentPrice - low) / (high - low)) * 100;
    distanceFromHigh = ((currentPrice - high) / high) * 100;
    distanceFromLow = ((currentPrice - low) / low) * 100;
  }

  return {
    returns: {
      "1D": getReturn(1),
      "1W": getReturn(7),
      "1M": getReturn(30),
      "3M": getReturn(90),
      "6M": getReturn(180),
      YTD: getYTDReturn(),
      "1Y": getReturn(365),
    },
    range52W: {
      high,
      low,
      currentPosition: currentPosition ? Math.round(currentPosition * 100) / 100 : null,
      distanceFromHigh: distanceFromHigh ? Math.round(distanceFromHigh * 100) / 100 : null,
      distanceFromLow: distanceFromLow ? Math.round(distanceFromLow * 100) / 100 : null,
    },
  };
}
