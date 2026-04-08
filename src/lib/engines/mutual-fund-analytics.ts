
import { OHLCV } from "./types";

export interface MFAnalyticsResult {
  returns: {
    "1Y": number | null;
    "3Y": number | null;
    "5Y": number | null;
  };
  risk: {
    volatility: number | null; // Annualized Volatility %
    sharpe: number | null;     // Sharpe Ratio
    beta: number | null;       // Beta vs Benchmark
    alpha: number | null;      // Alpha vs Benchmark
    rSquared: number | null;   // R-Squared vs Benchmark
  };
  drawdown: number | null;     // Max Drawdown % (positive number representing the drop)
}

export class MutualFundAnalyticsEngine {
  private static RISK_FREE_RATE = 0.06; // 6% approximation for India 10Y Bond

  /**
   * Calculates professional-grade analytics for a Mutual Fund.
   */
  static analyze(history: OHLCV[]): MFAnalyticsResult {
    if (!history || history.length < 30) {
      return this.getEmptyResult();
    }

    // Sort by date ascending (oldest first)
    const sortedHistory = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latestDate = new Date(sortedHistory[sortedHistory.length - 1].date);
    latestDate.setHours(0, 0, 0, 0);

    return {
      returns: {
        "1Y": this.calculateCAGR(sortedHistory, latestDate, 1),
        "3Y": this.calculateCAGR(sortedHistory, latestDate, 3),
        "5Y": this.calculateCAGR(sortedHistory, latestDate, 5),
      },
      risk: {
        volatility: this.calculateAnnualizedVolatility(sortedHistory),
        sharpe: this.calculateSharpeRatio(sortedHistory),
        beta: null,
        alpha: null,
        rSquared: null,
      },
      drawdown: this.calculateMaxDrawdown(sortedHistory),
    };
  }

  private static getEmptyResult(): MFAnalyticsResult {
    return {
      returns: { "1Y": null, "3Y": null, "5Y": null },
      risk: { volatility: null, sharpe: null, beta: null, alpha: null, rSquared: null },
      drawdown: null,
    };
  }

  /**
   * Calculates Compound Annual Growth Rate.
   * CAGR = (End Value / Start Value) ^ (1 / n) - 1
   */
  private static calculateCAGR(history: OHLCV[], anchorDate: Date, years: number): number | null {
    const targetDate = new Date(anchorDate);
    targetDate.setFullYear(anchorDate.getFullYear() - years);

    // Find closest price point on or before target date
    // Iterate backwards to find the first date <= targetDate
    let startPoint: OHLCV | null = null;
    for (let i = history.length - 1; i >= 0; i--) {
        const d = new Date(history[i].date);
        if (d <= targetDate) {
            startPoint = history[i];
            break;
        }
    }

    if (!startPoint || startPoint.close <= 0) return null;
    
    const endPrice = history[history.length - 1].close;
    const startPrice = startPoint.close;

    // Standard CAGR formula
    const cagr = Math.pow(endPrice / startPrice, 1 / years) - 1;
    return parseFloat((cagr * 100).toFixed(2));
  }

  /**
   * Calculates Annualized Volatility based on daily log returns.
   * Volatility = StdDev(Daily Returns) * Sqrt(252)
   */
  private static calculateAnnualizedVolatility(history: OHLCV[]): number | null {
    if (history.length < 2) return null;

    // Use last 1 year of data for volatility calculation to be relevant
    const oneYearAgo = new Date(history[history.length - 1].date);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const relevantHistory = history.filter(h => new Date(h.date) >= oneYearAgo);
    if (relevantHistory.length < 10) return null; // Need sufficient data points

    const returns: number[] = [];
    for (let i = 1; i < relevantHistory.length; i++) {
        const current = relevantHistory[i].close;
        const prev = relevantHistory[i-1].close;
        // Log return: ln(Pt / Pt-1)
        if (current > 0 && prev > 0) {
            returns.push(Math.log(current / prev));
        }
    }

    if (returns.length === 0) return null;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    const annualizedVol = stdDev * Math.sqrt(252); // Assumes 252 trading days

    return parseFloat((annualizedVol * 100).toFixed(2));
  }

  /**
   * Calculates Sharpe Ratio.
   * Sharpe = (CAGR_1Y - RiskFree) / Volatility_1Y
   * Note: Using simplified formula based on annualized metrics.
   */
  private static calculateSharpeRatio(history: OHLCV[]): number | null {
    const latestDate = new Date(history[history.length - 1].date);
    latestDate.setHours(0, 0, 0, 0);

    const cagr = this.calculateCAGR(history, latestDate, 1);
    const vol = this.calculateAnnualizedVolatility(history);

    if (cagr === null || vol === null || vol === 0) return null;

    // Convert Percentages back to decimals for calculation
    const R_p = cagr / 100;
    const R_f = this.RISK_FREE_RATE;
    const Sigma_p = vol / 100;

    const sharpe = (R_p - R_f) / Sigma_p;
    return parseFloat(sharpe.toFixed(2));
  }

  /**
   * Calculates Maximum Drawdown over the last 1 year.
   * MaxDD = Max((Peak - Trough) / Peak)
   */
  private static calculateMaxDrawdown(history: OHLCV[]): number | null {
      if (history.length === 0) return null;

      // Use last 1 year
      const oneYearAgo = new Date(history[history.length - 1].date);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const relevantHistory = history.filter(h => new Date(h.date) >= oneYearAgo);
      if (relevantHistory.length === 0) return null;

      let maxDrawdown = 0;
      let peak = relevantHistory[0].close;

      for (const candle of relevantHistory) {
          if (candle.close > peak) {
              peak = candle.close;
          }
          
          const drawdown = (peak - candle.close) / peak;
          if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
          }
      }

      return parseFloat((maxDrawdown * 100).toFixed(2));
  }
  /**
   * Calculates Advanced Risk Metrics (Alpha, Beta, R-Squared) against a benchmark.
   */
  static calculateAdvancedMetrics(assetHistory: OHLCV[], benchmarkHistory: OHLCV[]): { alpha: number | null, beta: number | null, rSquared: number | null } {
    // 1. Align Data by Date
    const assetMap = new Map(assetHistory.map(h => [h.date.split("T")[0], h.close]));
    const benchmarkMap = new Map(benchmarkHistory.map(h => [h.date.split("T")[0], h.close]));

    const alignedAssetPrices: number[] = [];
    const alignedBenchmarkPrices: number[] = [];
    const dates: string[] = [];

    // Use intersection of dates
    for (const [date, price] of assetMap) {
      if (benchmarkMap.has(date)) {
        alignedAssetPrices.push(price);
        alignedBenchmarkPrices.push(benchmarkMap.get(date)!);
        dates.push(date);
      }
    }

    if (alignedAssetPrices.length < 30) {
      return { alpha: null, beta: null, rSquared: null };
    }

    // 2. Calculate Daily Returns
    const assetReturns: number[] = [];
    const benchmarkReturns: number[] = [];

    for (let i = 1; i < alignedAssetPrices.length; i++) {
        const aRet = Math.log(alignedAssetPrices[i] / alignedAssetPrices[i-1]);
        const bRet = Math.log(alignedBenchmarkPrices[i] / alignedBenchmarkPrices[i-1]);
        assetReturns.push(aRet);
        benchmarkReturns.push(bRet);
    }

    // 3. System States for Calculation
    const n = assetReturns.length;
    const sumX = benchmarkReturns.reduce((a, b) => a + b, 0);
    const sumY = assetReturns.reduce((a, b) => a + b, 0);
    const sumXY = benchmarkReturns.reduce((sum, x, i) => sum + x * assetReturns[i], 0);
    const sumX2 = benchmarkReturns.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = assetReturns.reduce((sum, y) => sum + y * y, 0);

    // 4. Calculate Beta (Slope)
    // Beta = Covariance(Ra, Rb) / Variance(Rb)
    // Formula: (n*sumXY - sumX*sumY) / (n*sumX2 - sumX^2)
    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = (n * sumX2) - (sumX * sumX);
    
    // Variance of benchmark
    const varBenchmark = (sumX2 - (sumX * sumX) / n) / (n - 1);

    if (denominator === 0 || varBenchmark === 0) return { alpha: null, beta: null, rSquared: null };

    const beta = numerator / denominator;

    // 5. Calculate Alpha (Jensen's Alpha)
    // Annualized Alpha = (Annualized Return Asset) - (RiskFree + Beta * (Annualized Return Benchmark - RiskFree))
    // Note: Since we are using log returns, simple sum * 252 is approx annualized return
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    // Daily Alpha = MeanY - Beta * MeanX (This is CAPM intercept if Rf=0, close enough for daily)
    // More precise: Alpha = (Ra - Rf) - Beta * (Rm - Rf)
    // Let's use annualized values
    const annRetAsset = meanY * 252;
    const annRetBench = meanX * 252;
    const rf = this.RISK_FREE_RATE;

    const alpha = (annRetAsset - rf) - beta * (annRetBench - rf);

    // 6. Calculate R-Squared
    // R2 = (Correlation)^2
    // Correlation = (n*sumXY - sumX*sumY) / sqrt((n*sumX2 - sumX^2)(n*sumY2 - sumY^2))
    const denomR = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    const correlation = denomR !== 0 ? numerator / denomR : 0;
    const rSquared = Math.pow(correlation, 2);

    return {
        alpha: parseFloat((alpha * 100).toFixed(2)),
        beta: parseFloat(beta.toFixed(2)), 
        rSquared: parseFloat((rSquared * 100).toFixed(2))
    };
  }
}
