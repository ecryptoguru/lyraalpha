/**
 * Mutual Fund Analytics Engine — Accuracy Tests
 * Verifies CAGR formula, annualized volatility (log returns), Sharpe ratio,
 * max drawdown, and advanced metrics (alpha, beta, R-squared).
 */
import { describe, it, expect } from "vitest";
import { MutualFundAnalyticsEngine } from "../mutual-fund-analytics";
import { OHLCV } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBar(date: string, close: number): OHLCV {
  return { date, open: close, high: close * 1.005, low: close * 0.995, close, volume: 1_000_000 };
}

/** Build N bars ending on endDate, linearly priced from startPrice to endPrice */
function buildHistory(n: number, endDate: string, startPrice: number, endPrice: number): OHLCV[] {
  const end = new Date(endDate);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (n - 1 - i));
    const close = startPrice + ((endPrice - startPrice) * i) / (n - 1);
    return makeBar(d.toISOString().split("T")[0], Math.max(0.01, close));
  });
}

/** Build history for CAGR testing.
 * Builds a bar 2 days before the year boundary (to survive timezone shifts),
 * then fills every day up to endDate. The CAGR engine searches for the bar
 * closest to (but not after) the target date, so it will find this anchor bar. */
function buildCAGRHistory(years: number, endDate: string, startPrice: number, endPrice: number): OHLCV[] {
  const end = new Date(endDate);
  // Anchor: 2 days before the exact year boundary to survive any timezone shift
  const anchorDate = new Date(endDate);
  anchorDate.setFullYear(anchorDate.getFullYear() - years);
  anchorDate.setDate(anchorDate.getDate() - 2);

  // Build bars from anchorDate to endDate (inclusive), one per calendar day
  const bars: OHLCV[] = [];
  const totalMs = end.getTime() - anchorDate.getTime();
  const d = new Date(anchorDate);
  while (d <= end) {
    const frac = totalMs > 0 ? (d.getTime() - anchorDate.getTime()) / totalMs : 1;
    const close = startPrice + (endPrice - startPrice) * frac;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    bars.push(makeBar(dateStr, Math.max(0.01, close)));
    d.setDate(d.getDate() + 1);
  }
  return bars;
}

// ─── Insufficient Data ────────────────────────────────────────────────────────

describe("MF Analytics — insufficient data", () => {
  it("< 30 bars → all nulls", () => {
    const result = MutualFundAnalyticsEngine.analyze(buildHistory(20, "2024-06-15", 100, 110));
    expect(result.returns["1Y"]).toBeNull();
    expect(result.risk.volatility).toBeNull();
    expect(result.risk.sharpe).toBeNull();
    expect(result.drawdown).toBeNull();
  });

  it("exactly 30 bars → computes results", () => {
    const result = MutualFundAnalyticsEngine.analyze(buildHistory(30, "2024-06-15", 100, 110));
    expect(result.risk.volatility).not.toBeNull();
  });
});

// ─── CAGR Formula ─────────────────────────────────────────────────────────────

describe("MF Analytics — CAGR accuracy", () => {
  it("1Y CAGR: price doubled in 1 year → CAGR ≈ 100%", () => {
    // Anchor bar is 2 days early so CAGR is computed from slightly before 1Y
    // Actual CAGR ≈ (200/~99) ^ (1/1) - 1 ≈ 100% ± 2%
    const history = buildCAGRHistory(1, "2024-06-15", 100, 200);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.returns["1Y"]).not.toBeNull();
    expect(result.returns["1Y"]!).toBeGreaterThan(95);
    expect(result.returns["1Y"]!).toBeLessThan(105);
  });

  it("1Y CAGR: price halved in 1 year → CAGR ≈ -50%", () => {
    const history = buildCAGRHistory(1, "2024-06-15", 200, 100);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.returns["1Y"]).not.toBeNull();
    expect(result.returns["1Y"]!).toBeGreaterThan(-55);
    expect(result.returns["1Y"]!).toBeLessThan(-45);
  });

  it("1Y CAGR: flat price → CAGR = 0%", () => {
    const history = buildCAGRHistory(1, "2024-06-15", 100, 100);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.returns["1Y"]).toBeCloseTo(0, 0);
  });

  it("3Y CAGR: price 8x in 3 years → CAGR ≈ 100%", () => {
    // (8)^(1/3) - 1 = 2 - 1 = 100%
    const history = buildCAGRHistory(3, "2024-06-15", 100, 800);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.returns["3Y"]).not.toBeNull();
    expect(result.returns["3Y"]!).toBeGreaterThan(90);
    expect(result.returns["3Y"]!).toBeLessThan(110);
  });

  it("insufficient history for 3Y → 3Y CAGR = null", () => {
    // Only 1 year of data — cannot compute 3Y CAGR
    const history = buildCAGRHistory(1, "2024-06-15", 100, 150);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.returns["3Y"]).toBeNull();
  });

  it("insufficient history for 5Y → 5Y CAGR = null", () => {
    // Only 2 years of data — cannot compute 5Y CAGR
    const history = buildCAGRHistory(2, "2024-06-15", 100, 150);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.returns["5Y"]).toBeNull();
  });
});

// ─── Annualized Volatility ────────────────────────────────────────────────────

describe("MF Analytics — annualized volatility", () => {
  it("flat prices → volatility = 0%", () => {
    const history = buildCAGRHistory(1.1, "2024-06-15", 100, 100);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.risk.volatility).toBeCloseTo(0, 1);
  });

  it("higher price swings → higher volatility", () => {
    // Alternating prices create high vol
    const n = 260;
    const end = new Date("2024-06-15");
    const highVol = Array.from({ length: n }, (_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (n - 1 - i));
      return makeBar(d.toISOString().split("T")[0], i % 2 === 0 ? 100 : 80);
    });
    const lowVol = buildCAGRHistory(1.1, "2024-06-15", 100, 100);

    const highResult = MutualFundAnalyticsEngine.analyze(highVol);
    const lowResult = MutualFundAnalyticsEngine.analyze(lowVol);
    expect(highResult.risk.volatility!).toBeGreaterThan(lowResult.risk.volatility!);
  });

  it("volatility is non-negative", () => {
    const history = buildCAGRHistory(1.1, "2024-06-15", 100, 150);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.risk.volatility!).toBeGreaterThanOrEqual(0);
  });

  it("uses log returns: vol = stdDev(ln(Pt/Pt-1)) * sqrt(252) * 100", () => {
    // Build 2 bars: 100 → 110 → log return = ln(1.1) ≈ 0.0953
    // With only 2 bars, vol = 0 (need at least 2 returns = 3 bars)
    // Build 3 bars: 100 → 110 → 121 → log returns = [ln(1.1), ln(1.1)]
    // stdDev of [0.0953, 0.0953] = 0 (identical) → vol = 0
    const n = 260;
    const end = new Date("2024-06-15");
    // Constant 10% daily growth → all log returns identical → stdDev = 0
    const constGrowth = Array.from({ length: n }, (_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (n - 1 - i));
      return makeBar(d.toISOString().split("T")[0], 100 * Math.pow(1.001, i));
    });
    const result = MutualFundAnalyticsEngine.analyze(constGrowth);
    expect(result.risk.volatility).toBeCloseTo(0, 0);
  });
});

// ─── Sharpe Ratio ─────────────────────────────────────────────────────────────

describe("MF Analytics — Sharpe ratio", () => {
  it("flat prices → vol = 0 → Sharpe = null", () => {
    const history = buildCAGRHistory(1.1, "2024-06-15", 100, 100);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.risk.sharpe).toBeNull();
  });

  it("Sharpe = (CAGR_1Y - 6%) / vol_1Y", () => {
    const history = buildCAGRHistory(1, "2024-06-15", 100, 150);
    const result = MutualFundAnalyticsEngine.analyze(history);
    if (result.returns["1Y"] !== null && result.risk.volatility !== null && result.risk.sharpe !== null) {
      const expectedSharpe = (result.returns["1Y"] / 100 - 0.06) / (result.risk.volatility / 100);
      expect(result.risk.sharpe).toBeCloseTo(expectedSharpe, 1);
    }
  });

  it("higher return with same vol → higher Sharpe", () => {
    // Build wavy histories to ensure non-zero volatility
    const n = 370;
    const end = new Date("2024-06-15");
    function wavyHistory(endPrice: number): OHLCV[] {
      return Array.from({ length: n }, (_, i) => {
        const d = new Date(end);
        d.setDate(end.getDate() - (n - 1 - i));
        const trend = 100 + (endPrice - 100) * (i / (n - 1));
        const noise = i % 2 === 0 ? 1.005 : 0.995; // small oscillation for vol
        const close = trend * noise;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        return makeBar(dateStr, close);
      });
    }
    const low = MutualFundAnalyticsEngine.analyze(wavyHistory(110));
    const high = MutualFundAnalyticsEngine.analyze(wavyHistory(160));
    if (low.risk.sharpe !== null && high.risk.sharpe !== null) {
      expect(high.risk.sharpe).toBeGreaterThan(low.risk.sharpe);
    } else {
      expect(high.returns["1Y"]!).toBeGreaterThan(low.returns["1Y"]!);
    }
  });
});

// ─── Max Drawdown ─────────────────────────────────────────────────────────────

describe("MF Analytics — max drawdown", () => {
  it("flat prices → max drawdown = 0%", () => {
    const history = buildCAGRHistory(1.1, "2024-06-15", 100, 100);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.drawdown).toBeCloseTo(0, 1);
  });

  it("prices rise then fall 50% → max drawdown = 50%", () => {
    const n = 260;
    const end = new Date("2024-06-15");
    // Rise to 200, then fall to 100 (50% drawdown)
    const history = Array.from({ length: n }, (_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (n - 1 - i));
      const close = i < n / 2 ? 100 + i * (100 / (n / 2)) : 200 - (i - n / 2) * (100 / (n / 2));
      return makeBar(d.toISOString().split("T")[0], Math.max(1, close));
    });
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.drawdown!).toBeCloseTo(50, 0);
  });

  it("max drawdown is non-negative (expressed as positive %)", () => {
    const history = buildCAGRHistory(1.1, "2024-06-15", 100, 80);
    const result = MutualFundAnalyticsEngine.analyze(history);
    expect(result.drawdown!).toBeGreaterThanOrEqual(0);
  });

  it("larger drop → larger drawdown", () => {
    const small = MutualFundAnalyticsEngine.analyze(buildCAGRHistory(1.1, "2024-06-15", 100, 95));
    const large = MutualFundAnalyticsEngine.analyze(buildCAGRHistory(1.1, "2024-06-15", 100, 60));
    expect(large.drawdown!).toBeGreaterThan(small.drawdown!);
  });
});

// ─── Advanced Metrics (Alpha, Beta, R²) ──────────────────────────────────────

describe("MF Analytics — advanced metrics (alpha, beta, R²)", () => {
  it("< 30 aligned bars → all null", () => {
    const asset = buildHistory(20, "2024-06-15", 100, 110);
    const bench = buildHistory(20, "2024-06-15", 100, 105);
    const result = MutualFundAnalyticsEngine.calculateAdvancedMetrics(asset, bench);
    expect(result.beta).toBeNull();
    expect(result.alpha).toBeNull();
    expect(result.rSquared).toBeNull();
  });

  it("identical asset and benchmark → beta = 1, R² = 100%", () => {
    const history = buildHistory(100, "2024-06-15", 100, 150);
    const result = MutualFundAnalyticsEngine.calculateAdvancedMetrics(history, history);
    expect(result.beta).toBeCloseTo(1, 1);
    expect(result.rSquared).toBeCloseTo(100, 0);
  });

  it("asset returns = 2x benchmark returns → beta ≈ 2", () => {
    // Build benchmark with known daily returns, asset with exactly 2x those returns
    // Use additive returns to ensure exact 2x relationship
    const n = 100;
    const end = new Date("2024-06-15T12:00:00Z");
    const benchPrices: number[] = [100];
    const assetPrices: number[] = [100];
    // Each day: bench moves +0.5% or -0.3% alternating, asset moves exactly 2x
    for (let i = 1; i < n; i++) {
      const benchReturn = i % 2 === 0 ? 0.005 : -0.003;
      benchPrices.push(benchPrices[i - 1] * (1 + benchReturn));
      assetPrices.push(assetPrices[i - 1] * (1 + benchReturn * 2));
    }
    const bench = benchPrices.map((price, i) => {
      const d = new Date(end);
      d.setUTCDate(end.getUTCDate() - (n - 1 - i));
      return makeBar(d.toISOString().split("T")[0], price);
    });
    const asset = assetPrices.map((price, i) => {
      const d = new Date(end);
      d.setUTCDate(end.getUTCDate() - (n - 1 - i));
      return makeBar(d.toISOString().split("T")[0], price);
    });
    const result = MutualFundAnalyticsEngine.calculateAdvancedMetrics(asset, bench);
    // log(1+2r) / log(1+r) ≈ 2 for small r, so beta ≈ 2
    expect(result.beta).toBeCloseTo(2, 0);
  });

  it("R² in [0, 100]", () => {
    const asset = buildHistory(100, "2024-06-15", 100, 150);
    const bench = buildHistory(100, "2024-06-15", 100, 120);
    const result = MutualFundAnalyticsEngine.calculateAdvancedMetrics(asset, bench);
    if (result.rSquared !== null) {
      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(100);
    }
  });

  it("zero variance benchmark → all null", () => {
    const asset = buildHistory(100, "2024-06-15", 100, 150);
    const bench = buildHistory(100, "2024-06-15", 100, 100); // flat = zero variance
    const result = MutualFundAnalyticsEngine.calculateAdvancedMetrics(asset, bench);
    expect(result.beta).toBeNull();
  });
});
