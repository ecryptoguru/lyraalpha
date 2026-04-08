import type { ConcentrationMetrics, StyleAnalysis, MFLookthroughResult } from "./mf-lookthrough";

// ─── Types ──────────────────────────────────────────────────────────

export type RiskLevel = "low" | "moderate" | "elevated";

export interface StyleDriftRisk {
  detected: boolean;
  description: string | null;
  level: RiskLevel;
}

export interface AUMRisk {
  aum: number | null;
  level: RiskLevel;
  description: string | null;
}

export interface ExpenseDrag {
  expenseRatio: number | null;
  annualImpactBps: number | null;
  level: RiskLevel;
}

export interface DrawdownRisk {
  maxDrawdown: number | null;
  level: RiskLevel;
}

export interface BenchmarkTracking {
  rSquared: number | null;
  alpha: number | null;
  isClosetIndexer: boolean;
  level: RiskLevel;
}

export interface MFRiskResult {
  level: RiskLevel;
  factors: string[];
  concentration: {
    hhi: number;
    top5Weight: number;
    level: RiskLevel;
  };
  styleDrift: StyleDriftRisk;
  aum: AUMRisk;
  expense: ExpenseDrag;
  drawdown: DrawdownRisk;
  benchmarkTracking: BenchmarkTracking;
  computedAt: string;
}

// ─── Engine ─────────────────────────────────────────────────────────

export class MFRiskEngine {
  static compute(opts: {
    lookthrough: MFLookthroughResult;
    expenseRatio?: number | null;
    aum?: number | null;
    maxDrawdown?: number | null;
    rSquared?: number | null;
    alpha?: number | null;
  }): MFRiskResult {
    const { lookthrough, expenseRatio, aum, maxDrawdown, rSquared, alpha } = opts;

    // 1. Concentration risk
    const concentrationRisk = this.assessConcentration(lookthrough.concentration);

    // 2. Style drift
    const styleDrift = this.assessStyleDrift(lookthrough.styleAnalysis);

    // 3. AUM risk
    const aumRisk = this.assessAUM(aum);

    // 4. Expense drag
    const expense = this.assessExpense(expenseRatio);

    // 5. Drawdown severity
    const drawdown = this.assessDrawdown(maxDrawdown);

    // 6. Benchmark tracking (closet indexer detection)
    const benchmarkTracking = this.assessBenchmarkTracking(rSquared, alpha, expenseRatio);

    // Aggregate risk factors
    const factors: string[] = [];
    if (concentrationRisk.level !== "low") {
      factors.push(
        `Concentration: Top-5 holdings = ${lookthrough.concentration.top5Weight.toFixed(1)}% (HHI: ${lookthrough.concentration.hhi.toFixed(3)})`,
      );
    }
    if (styleDrift.detected) {
      factors.push(styleDrift.description || "Style drift detected vs declared category");
    }
    if (aumRisk.level !== "low" && aumRisk.description) {
      factors.push(aumRisk.description);
    }
    if (expense.level !== "low" && expense.annualImpactBps != null) {
      factors.push(`Expense ratio: ${(expense.expenseRatio! * 100).toFixed(2)}% (${expense.annualImpactBps} bps annual drag)`);
    }
    if (drawdown.level !== "low" && drawdown.maxDrawdown != null) {
      factors.push(`Max drawdown: ${drawdown.maxDrawdown.toFixed(1)}%`);
    }
    if (benchmarkTracking.isClosetIndexer) {
      factors.push("Closet indexer: high benchmark correlation with negligible alpha — consider a low-cost index fund");
    }

    // Overall risk level
    const subLevels = [concentrationRisk.level, styleDrift.level, aumRisk.level, expense.level, drawdown.level, benchmarkTracking.level];
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
      styleDrift,
      aum: aumRisk,
      expense,
      drawdown,
      benchmarkTracking,
      computedAt: new Date().toISOString(),
    };
  }

  // ─── Sub-assessments ────────────────────────────────────────────

  private static assessConcentration(c: ConcentrationMetrics): { level: RiskLevel } {
    if (c.hhi > 0.12 || c.top5Weight > 50) return { level: "elevated" };
    if (c.hhi > 0.05 || c.top5Weight > 35) return { level: "moderate" };
    return { level: "low" };
  }

  private static assessStyleDrift(style: StyleAnalysis): StyleDriftRisk {
    if (style.styleDriftDetected) {
      return { detected: true, description: style.driftDescription, level: "moderate" };
    }
    return { detected: false, description: null, level: "low" };
  }

  private static assessAUM(aum?: number | null): AUMRisk {
    if (aum == null) return { aum: null, level: "low", description: null };

    // Convert to crores for Indian context (aum is in raw currency units)
    const aumCr = aum / 10_000_000; // 1 Cr = 10M

    if (aumCr < 500) {
      return { aum, level: "elevated", description: `Small AUM: ₹${aumCr.toFixed(0)} Cr — potential liquidity and redemption pressure risk` };
    }
    if (aumCr > 50_000) {
      return { aum, level: "moderate", description: `Very large AUM: ₹${Math.round(aumCr / 1000)}K Cr — potential alpha capacity constraints` };
    }
    return { aum, level: "low", description: null };
  }

  private static assessExpense(expenseRatio?: number | null): ExpenseDrag {
    if (expenseRatio == null || expenseRatio <= 0) {
      return { expenseRatio: null, annualImpactBps: null, level: "low" };
    }

    const bps = Math.round(expenseRatio * 10000);

    let level: RiskLevel = "low";
    if (bps > 200) level = "elevated"; // >2% is very high for direct plans
    else if (bps > 100) level = "moderate";

    return { expenseRatio, annualImpactBps: bps, level };
  }

  private static assessDrawdown(maxDrawdown?: number | null): DrawdownRisk {
    if (maxDrawdown == null) return { maxDrawdown: null, level: "low" };

    const dd = Math.abs(maxDrawdown);
    let level: RiskLevel = "low";
    if (dd > 30) level = "elevated";
    else if (dd > 15) level = "moderate";

    return { maxDrawdown: dd, level };
  }

  private static assessBenchmarkTracking(
    rSquared?: number | null,
    alpha?: number | null,
    expenseRatio?: number | null,
  ): BenchmarkTracking {
    if (rSquared == null) return { rSquared: null, alpha: null, isClosetIndexer: false, level: "low" };

    // Closet indexer: R² > 0.92, alpha near zero, and expense > 0.5%
    const isClosetIndexer = rSquared > 0.92
      && (alpha == null || Math.abs(alpha) < 1)
      && (expenseRatio != null && expenseRatio > 0.005);

    let level: RiskLevel = "low";
    if (isClosetIndexer) level = "elevated";
    else if (rSquared > 0.95) level = "moderate"; // Very high tracking but might still add value

    return { rSquared, alpha: alpha ?? null, isClosetIndexer, level };
  }
}
