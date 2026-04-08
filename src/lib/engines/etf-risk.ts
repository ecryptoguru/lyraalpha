import { dailyReturns, pearsonCorrelation, stdDev } from "./utils";
import type { ConcentrationMetrics, ETFLookthroughResult } from "./etf-lookthrough";
import type { OHLCV } from "./types";

// ─── Types ──────────────────────────────────────────────────────────

export type RiskLevel = "low" | "moderate" | "elevated";

export interface TrackingMetrics {
  correlation: number | null;
  trackingError: number | null;
  level: RiskLevel;
}

export interface LiquidityMismatch {
  etfAvgVolume: number;
  constituentAvgVolume: number | null;
  ratio: number | null;
  level: RiskLevel;
}

export interface ExpenseDrag {
  expenseRatio: number | null;
  annualImpactBps: number | null;
  level: RiskLevel;
}

export interface ETFRiskResult {
  level: RiskLevel;
  factors: string[];
  concentration: {
    hhi: number;
    top5Weight: number;
    level: RiskLevel;
  };
  tracking: TrackingMetrics;
  liquidity: LiquidityMismatch;
  expense: ExpenseDrag;
  computedAt: string;
}

// ─── Engine ─────────────────────────────────────────────────────────

export class ETFRiskEngine {
  /**
   * Compute risk assessment for an ETF.
   * Uses lookthrough data + price history for tracking error.
   */
  static compute(opts: {
    lookthrough: ETFLookthroughResult;
    etfHistory?: OHLCV[];
    benchmarkHistory?: OHLCV[];
    etfAvgVolume?: number | null;
    constituentAvgVolumes?: number[];
    expenseRatio?: number | null;
  }): ETFRiskResult {
    const { lookthrough, etfHistory, benchmarkHistory, etfAvgVolume, constituentAvgVolumes, expenseRatio } = opts;

    // 1. Concentration risk (from lookthrough)
    const concentrationRisk = this.assessConcentration(lookthrough.concentration);

    // 2. Tracking error (ETF vs benchmark price correlation)
    const tracking = this.computeTrackingError(etfHistory, benchmarkHistory);

    // 3. Liquidity mismatch
    const liquidity = this.assessLiquidity(etfAvgVolume, constituentAvgVolumes);

    // 4. Expense drag
    const expense = this.assessExpense(expenseRatio);

    // Aggregate risk factors
    const factors: string[] = [];
    if (concentrationRisk.level !== "low") {
      factors.push(
        concentrationRisk.level === "elevated"
          ? `High concentration: Top-5 holdings = ${lookthrough.concentration.top5Weight.toFixed(1)}%`
          : `Moderate concentration: HHI = ${lookthrough.concentration.hhi.toFixed(4)}`,
      );
    }
    if (tracking.level !== "low") {
      factors.push(
        tracking.trackingError != null
          ? `Tracking error: ${(tracking.trackingError * 100).toFixed(2)}% annualized`
          : "Tracking error could not be measured",
      );
    }
    if (liquidity.level !== "low") {
      factors.push(
        liquidity.ratio != null
          ? `Liquidity mismatch: ETF volume is ${liquidity.ratio.toFixed(1)}x constituent average`
          : "Constituent liquidity data unavailable",
      );
    }
    if (expense.level !== "low") {
      factors.push(
        expense.expenseRatio != null
          ? `Expense ratio: ${(expense.expenseRatio * 100).toFixed(2)}% (${expense.annualImpactBps} bps annual drag)`
          : "Expense ratio data unavailable",
      );
    }

    // Overall risk level: worst of any sub-risk
    const subLevels = [concentrationRisk.level, tracking.level, liquidity.level, expense.level];
    let level: RiskLevel = "low";
    if (subLevels.includes("elevated")) level = "elevated";
    else if (subLevels.includes("moderate")) level = "moderate";

    return {
      level,
      factors,
      concentration: {
        hhi: lookthrough.concentration.hhi,
        top5Weight: lookthrough.concentration.top5Weight,
        level: concentrationRisk.level,
      },
      tracking,
      liquidity,
      expense,
      computedAt: new Date().toISOString(),
    };
  }

  // ─── Concentration Assessment ───────────────────────────────────

  private static assessConcentration(c: ConcentrationMetrics): { level: RiskLevel } {
    if (c.hhi > 0.15 || c.top5Weight > 60) return { level: "elevated" };
    if (c.hhi > 0.06 || c.top5Weight > 40) return { level: "moderate" };
    return { level: "low" };
  }

  // ─── Tracking Error ─────────────────────────────────────────────

  static computeTrackingError(
    etfHistory?: OHLCV[],
    benchmarkHistory?: OHLCV[],
  ): TrackingMetrics {
    if (!etfHistory || !benchmarkHistory || etfHistory.length < 30 || benchmarkHistory.length < 30) {
      return { correlation: null, trackingError: null, level: "low" };
    }

    // Align dates
    const etfMap = new Map(etfHistory.map((h) => [h.date.slice(0, 10), h.close]));
    const benchMap = new Map(benchmarkHistory.map((h) => [h.date.slice(0, 10), h.close]));

    const commonDates = [...etfMap.keys()].filter((d) => benchMap.has(d)).sort();
    if (commonDates.length < 30) {
      return { correlation: null, trackingError: null, level: "low" };
    }

    // Use last 90 days
    const recentDates = commonDates.slice(-90);
    const etfPrices = recentDates.map((d) => etfMap.get(d)!);
    const benchPrices = recentDates.map((d) => benchMap.get(d)!);

    const etfReturns = dailyReturns(etfPrices);
    const benchReturns = dailyReturns(benchPrices);

    if (etfReturns.length < 20) {
      return { correlation: null, trackingError: null, level: "low" };
    }

    const correlation = pearsonCorrelation(etfReturns, benchReturns);

    // Tracking error = std deviation of return differences
    const returnDiffs = etfReturns.map((r, i) => r - benchReturns[i]);
    const dailyTE = stdDev(returnDiffs);
    const annualizedTE = dailyTE * Math.sqrt(252);

    let level: RiskLevel = "low";
    if (annualizedTE > 0.05 || correlation < 0.9) level = "elevated";
    else if (annualizedTE > 0.02 || correlation < 0.95) level = "moderate";

    return {
      correlation,
      trackingError: Math.round(annualizedTE * 10000) / 10000,
      level,
    };
  }

  // ─── Liquidity Mismatch ─────────────────────────────────────────

  private static assessLiquidity(
    etfAvgVolume?: number | null,
    constituentAvgVolumes?: number[],
  ): LiquidityMismatch {
    if (!etfAvgVolume || !constituentAvgVolumes || constituentAvgVolumes.length === 0) {
      return { etfAvgVolume: etfAvgVolume || 0, constituentAvgVolume: null, ratio: null, level: "low" };
    }

    const avgConstituentVol = constituentAvgVolumes.reduce((s, v) => s + v, 0) / constituentAvgVolumes.length;
    const ratio = avgConstituentVol > 0 ? etfAvgVolume / avgConstituentVol : null;

    let level: RiskLevel = "low";
    if (ratio != null) {
      if (ratio < 0.1) level = "elevated";
      else if (ratio < 0.5) level = "moderate";
    }

    return {
      etfAvgVolume,
      constituentAvgVolume: Math.round(avgConstituentVol),
      ratio: ratio != null ? Math.round(ratio * 100) / 100 : null,
      level,
    };
  }

  // ─── Expense Assessment ─────────────────────────────────────────

  private static assessExpense(expenseRatio?: number | null): ExpenseDrag {
    if (expenseRatio == null || expenseRatio <= 0) {
      return { expenseRatio: null, annualImpactBps: null, level: "low" };
    }

    const bps = Math.round(expenseRatio * 10000);

    let level: RiskLevel = "low";
    if (bps > 100) level = "elevated";
    else if (bps > 50) level = "moderate";

    return {
      expenseRatio,
      annualImpactBps: bps,
      level,
    };
  }
}
