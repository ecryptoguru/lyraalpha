/**
 * @vitest-environment node
 *
 * Monte Carlo Engine — deep accuracy & statistical correctness tests.
 * Uses large path counts for statistical stability.
 */
import { describe, it, expect } from "vitest";
import {
  runMonteCarloSimulation,
  type MCSimulationInput,
} from "../portfolio-monte-carlo";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeHolding = (
  symbol: string,
  quantity: number,
  avgPrice: number,
  volScore = 50,
  liqScore = 60,
  compatScore = 55,
) => ({
  symbol,
  quantity,
  avgPrice,
  asset: {
    avgVolatilityScore: volScore,
    avgLiquidityScore: liqScore,
    compatibilityScore: compatScore,
    factorAlignment: null,
    correlationData: null,
  },
});

const BASE: MCSimulationInput = {
  holdings: [
    makeHolding("AAPL", 10, 180),
    makeHolding("SPY", 5, 450),
    makeHolding("GLD", 8, 190),
  ],
  mode: "A",
  horizon: 30,
  paths: 500,
  region: "US",
  currentRegime: "NEUTRAL",
};

// ─── Result Structure ─────────────────────────────────────────────────────────

describe("Monte Carlo — result structure", () => {
  it("all required fields are present", async () => {
    const r = await runMonteCarloSimulation(BASE);
    expect(r).toHaveProperty("expectedReturn");
    expect(r).toHaveProperty("medianReturn");
    expect(r).toHaveProperty("p25Return");
    expect(r).toHaveProperty("p75Return");
    expect(r).toHaveProperty("var5");
    expect(r).toHaveProperty("es5");
    expect(r).toHaveProperty("maxDrawdownMean");
    expect(r).toHaveProperty("maxDrawdownP95");
    expect(r).toHaveProperty("regimeForecast");
    expect(r).toHaveProperty("fragilityMean");
    expect(r).toHaveProperty("fragilityP95");
    expect(r).toHaveProperty("pathCount");
    expect(r).toHaveProperty("horizon");
    expect(r).toHaveProperty("mode");
  });

  it("pathCount and horizon echo input values", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 200, horizon: 45 });
    expect(r.pathCount).toBe(200);
    expect(r.horizon).toBe(45);
  });

  it("mode echoes input mode", async () => {
    for (const mode of ["A", "B", "C", "D"] as const) {
      const r = await runMonteCarloSimulation({ ...BASE, mode });
      expect(r.mode).toBe(mode);
    }
  });

  it("throws for empty holdings", async () => {
    await expect(
      runMonteCarloSimulation({ ...BASE, holdings: [] }),
    ).rejects.toThrow("No holdings provided");
  });
});

// ─── Statistical Ordering ─────────────────────────────────────────────────────

describe("Monte Carlo — statistical ordering invariants", () => {
  it("ES5 ≤ VaR5 ≤ p25 ≤ median ≤ p75 (with large path count)", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 1000, horizon: 60 });
    expect(r.es5).toBeLessThanOrEqual(r.var5 + 1e-9);
    expect(r.var5).toBeLessThanOrEqual(r.p25Return + 1e-9);
    expect(r.p25Return).toBeLessThanOrEqual(r.medianReturn + 1e-9);
    expect(r.medianReturn).toBeLessThanOrEqual(r.p75Return + 1e-9);
  });

  it("maxDrawdownP95 ≥ maxDrawdownMean (tail is worse than mean)", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 500 });
    expect(r.maxDrawdownP95).toBeGreaterThanOrEqual(r.maxDrawdownMean - 1e-9);
  });

  it("fragilityP95 ≥ fragilityMean", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 500 });
    expect(r.fragilityP95).toBeGreaterThanOrEqual(r.fragilityMean - 1e-9);
  });

  it("maxDrawdownMean is non-negative (drawdown is a loss magnitude)", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 500 });
    expect(r.maxDrawdownMean).toBeGreaterThanOrEqual(0);
  });

  it("fragilityMean is within [0, 100]", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 500 });
    expect(r.fragilityMean).toBeGreaterThanOrEqual(0);
    expect(r.fragilityMean).toBeLessThanOrEqual(100);
  });

  it("fragilityP95 is within [0, 100]", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 500 });
    expect(r.fragilityP95).toBeGreaterThanOrEqual(0);
    expect(r.fragilityP95).toBeLessThanOrEqual(100);
  });
});

// ─── Regime Forecast ──────────────────────────────────────────────────────────

describe("Monte Carlo — regime forecast", () => {
  it("regime forecast probabilities sum to 1.0 (±0.01)", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, mode: "B", paths: 500 });
    const total = Object.values(r.regimeForecast).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });

  it("all regime probabilities are in [0, 1]", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, mode: "B", paths: 500 });
    for (const [, prob] of Object.entries(r.regimeForecast)) {
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
  });

  it("mode A (deterministic): final regime = initial regime (NEUTRAL)", async () => {
    // Mode A never transitions → all paths end in NEUTRAL
    const r = await runMonteCarloSimulation({
      ...BASE,
      mode: "A",
      currentRegime: "NEUTRAL",
      paths: 200,
    });
    expect(r.regimeForecast.NEUTRAL).toBeCloseTo(1.0, 1);
    expect(r.regimeForecast.RISK_OFF).toBeCloseTo(0, 1);
  });

  it("mode A with RISK_OFF regime: all paths stay in RISK_OFF", async () => {
    const r = await runMonteCarloSimulation({
      ...BASE,
      mode: "A",
      currentRegime: "RISK_OFF",
      paths: 200,
    });
    expect(r.regimeForecast.RISK_OFF).toBeCloseTo(1.0, 1);
  });

  it("mode C (stress inject): RISK_OFF probability is 1.0 after stress step", async () => {
    // Mode C locks to RISK_OFF at stressInjectStep and stays there
    const r = await runMonteCarloSimulation({
      ...BASE,
      mode: "C",
      currentRegime: "NEUTRAL",
      horizon: 20,
      stressInjectStep: 5,
      paths: 200,
    });
    // After step 5 all paths are RISK_OFF and mode C doesn't transition further
    expect(r.regimeForecast.RISK_OFF).toBeCloseTo(1.0, 1);
  });

  it("mode D (factor shock): DEFENSIVE probability is 1.0 after shock step", async () => {
    const r = await runMonteCarloSimulation({
      ...BASE,
      mode: "D",
      currentRegime: "NEUTRAL",
      horizon: 20,
      stressInjectStep: 5,
      paths: 200,
    });
    expect(r.regimeForecast.DEFENSIVE).toBeCloseTo(1.0, 1);
  });

  it("mode B (Markov): regime distribution is spread across states", async () => {
    const r = await runMonteCarloSimulation({
      ...BASE,
      mode: "B",
      currentRegime: "NEUTRAL",
      paths: 2000,
      horizon: 100,
    });
    // With many steps, Markov chain should visit multiple states
    const nonZeroStates = Object.values(r.regimeForecast).filter((p) => p > 0.01).length;
    expect(nonZeroStates).toBeGreaterThanOrEqual(2);
  });
});

// ─── Regime Impact on Returns ─────────────────────────────────────────────────

describe("Monte Carlo — regime impact on returns", () => {
  it("RISK_OFF regime produces lower expected return than STRONG_RISK_ON", async () => {
    const riskOn = await runMonteCarloSimulation({
      ...BASE,
      mode: "A",
      currentRegime: "STRONG_RISK_ON",
      paths: 1000,
      horizon: 60,
    });
    const riskOff = await runMonteCarloSimulation({
      ...BASE,
      mode: "A",
      currentRegime: "RISK_OFF",
      paths: 1000,
      horizon: 60,
    });
    expect(riskOn.expectedReturn).toBeGreaterThan(riskOff.expectedReturn);
  });

  it("RISK_OFF regime produces higher or equal fragility than STRONG_RISK_ON", async () => {
    // Use low-vol, liquid holdings so fragility doesn't saturate at 100
    const lowFragilityHoldings = [
      makeHolding("A", 10, 100, 10, 90, 90),
      makeHolding("B", 10, 100, 10, 90, 90),
    ];
    const riskOn = await runMonteCarloSimulation({
      ...BASE,
      holdings: lowFragilityHoldings,
      mode: "A",
      currentRegime: "STRONG_RISK_ON",
      paths: 500,
    });
    const riskOff = await runMonteCarloSimulation({
      ...BASE,
      holdings: lowFragilityHoldings,
      mode: "A",
      currentRegime: "RISK_OFF",
      paths: 500,
    });
    // RISK_OFF applies higher vol multiplier → higher fragility score
    expect(riskOff.fragilityMean).toBeGreaterThanOrEqual(riskOn.fragilityMean);
  });

  it("stress injection (mode C) produces worse VaR than deterministic (mode A)", async () => {
    const modeA = await runMonteCarloSimulation({
      ...BASE,
      mode: "A",
      currentRegime: "NEUTRAL",
      paths: 1000,
      horizon: 40,
    });
    const modeC = await runMonteCarloSimulation({
      ...BASE,
      mode: "C",
      currentRegime: "NEUTRAL",
      paths: 1000,
      horizon: 40,
      stressInjectStep: 10,
    });
    // Mode C injects RISK_OFF → worse tail risk
    expect(modeC.var5).toBeLessThan(modeA.var5);
  });
});

// ─── Volatility Impact ────────────────────────────────────────────────────────

describe("Monte Carlo — volatility score impact", () => {
  it("high-volatility holdings produce wider return distribution", async () => {
    const lowVol = await runMonteCarloSimulation({
      ...BASE,
      holdings: [
        makeHolding("A", 10, 100, 10, 80, 80),
        makeHolding("B", 10, 100, 10, 80, 80),
      ],
      paths: 1000,
      horizon: 60,
    });
    const highVol = await runMonteCarloSimulation({
      ...BASE,
      holdings: [
        makeHolding("A", 10, 100, 90, 80, 80),
        makeHolding("B", 10, 100, 90, 80, 80),
      ],
      paths: 1000,
      horizon: 60,
    });
    const lowSpread = lowVol.p75Return - lowVol.p25Return;
    const highSpread = highVol.p75Return - highVol.p25Return;
    expect(highSpread).toBeGreaterThan(lowSpread);
  });

  it("high-volatility holdings produce higher max drawdown", async () => {
    const lowVol = await runMonteCarloSimulation({
      ...BASE,
      holdings: [makeHolding("A", 10, 100, 5, 80, 80), makeHolding("B", 10, 100, 5, 80, 80)],
      paths: 5000,
      horizon: 60,
    });
    const highVol = await runMonteCarloSimulation({
      ...BASE,
      holdings: [makeHolding("A", 10, 100, 95, 80, 80), makeHolding("B", 10, 100, 95, 80, 80)],
      paths: 5000,
      horizon: 60,
    });
    expect(highVol.maxDrawdownMean).toBeGreaterThan(lowVol.maxDrawdownMean);
  });
});

// ─── Liquidity Impact ─────────────────────────────────────────────────────────

describe("Monte Carlo — liquidity impact", () => {
  it("illiquid holdings produce higher fragility than liquid holdings", async () => {
    // Use low vol + high compatibility to keep fragility below ceiling
    const liquid = await runMonteCarloSimulation({
      ...BASE,
      holdings: [makeHolding("A", 10, 100, 5, 95, 95), makeHolding("B", 10, 100, 5, 95, 95)],
      paths: 500,
    });
    const illiquid = await runMonteCarloSimulation({
      ...BASE,
      holdings: [makeHolding("A", 10, 100, 5, 5, 95), makeHolding("B", 10, 100, 5, 5, 95)],
      paths: 500,
    });
    expect(illiquid.fragilityMean).toBeGreaterThanOrEqual(liquid.fragilityMean);
  });
});

// ─── Horizon Scaling ──────────────────────────────────────────────────────────

describe("Monte Carlo — horizon scaling", () => {
  it("longer horizon produces more negative VaR5 (larger tail loss)", async () => {
    // More steps → more accumulated downside risk → VaR5 should be more negative
    const modVolHoldings = [
      makeHolding("A", 10, 100, 50, 50, 50),
      makeHolding("B", 10, 100, 50, 50, 50),
    ];
    const short = await runMonteCarloSimulation({ ...BASE, mode: "B", holdings: modVolHoldings, horizon: 5, paths: 5000 });
    const long = await runMonteCarloSimulation({ ...BASE, mode: "B", holdings: modVolHoldings, horizon: 252, paths: 5000 });
    // VaR5 is negative; longer horizon → more negative (worse tail)
    expect(long.var5).toBeLessThan(short.var5);
  });

  it("longer horizon produces larger max drawdown on average", async () => {
    const short = await runMonteCarloSimulation({ ...BASE, horizon: 10, paths: 1000 });
    const long = await runMonteCarloSimulation({ ...BASE, horizon: 120, paths: 1000 });
    expect(long.maxDrawdownMean).toBeGreaterThanOrEqual(short.maxDrawdownMean);
  });
});

// ─── Weight Calculation ───────────────────────────────────────────────────────

describe("Monte Carlo — weight calculation", () => {
  it("single-holding portfolio runs without error", async () => {
    const r = await runMonteCarloSimulation({
      ...BASE,
      holdings: [makeHolding("AAPL", 10, 180)],
      paths: 100,
    });
    expect(r.pathCount).toBe(100);
    expect(r.expectedReturn).toBeDefined();
  });

  it("zero avgPrice holding falls back to weight=1 (no division by zero)", async () => {
    const r = await runMonteCarloSimulation({
      ...BASE,
      holdings: [
        makeHolding("A", 10, 0),   // avgPrice=0 → fallback to 1
        makeHolding("B", 10, 100),
      ],
      paths: 100,
    });
    expect(r.pathCount).toBe(100);
    expect(Number.isFinite(r.expectedReturn)).toBe(true);
  });

  it("results are reproducible in structure (not exact values) across calls", async () => {
    const r1 = await runMonteCarloSimulation({ ...BASE, paths: 200 });
    const r2 = await runMonteCarloSimulation({ ...BASE, paths: 200 });
    // Different seeds → different exact values, but same structural properties
    expect(r1.pathCount).toBe(r2.pathCount);
    expect(r1.horizon).toBe(r2.horizon);
    expect(r1.mode).toBe(r2.mode);
    // Both should have valid ordering
    expect(r1.es5).toBeLessThanOrEqual(r1.var5 + 1e-9);
    expect(r2.es5).toBeLessThanOrEqual(r2.var5 + 1e-9);
  });
});

// ─── Rounding ─────────────────────────────────────────────────────────────────

describe("Monte Carlo — output rounding", () => {
  it("return metrics are rounded to 4 decimal places", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 100 });
    const check4dp = (v: number) => Math.round(v * 10000) / 10000 === v;
    expect(check4dp(r.expectedReturn)).toBe(true);
    expect(check4dp(r.medianReturn)).toBe(true);
    expect(check4dp(r.var5)).toBe(true);
    expect(check4dp(r.es5)).toBe(true);
  });

  it("fragility metrics are rounded to 1 decimal place", async () => {
    const r = await runMonteCarloSimulation({ ...BASE, paths: 100 });
    const check1dp = (v: number) => Math.round(v * 10) / 10 === v;
    expect(check1dp(r.fragilityMean)).toBe(true);
    expect(check1dp(r.fragilityP95)).toBe(true);
  });
});
