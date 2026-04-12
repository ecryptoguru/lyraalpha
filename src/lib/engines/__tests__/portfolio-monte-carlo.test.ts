/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { runMonteCarloSimulation, type MCSimulationInput } from "../portfolio-monte-carlo";

const makeHolding = (symbol: string, quantity: number, avgPrice: number) => ({
  symbol,
  quantity,
  avgPrice,
  asset: {
    avgVolatilityScore: 50,
    avgLiquidityScore: 60,
    compatibilityScore: 55,
    factorAlignment: null,
    correlationData: null,
  },
});

const baseInput: MCSimulationInput = {
  holdings: [
    makeHolding("BTC-USD", 10, 65000),
    makeHolding("ETH-USD", 5, 3400),
    makeHolding("SOL-USD", 8, 180),
  ],
  mode: "B",
  horizon: 20,
  paths: 100,
  region: "US",
};

describe("Monte Carlo Simulation Engine", () => {
  it("returns defined result for valid input", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result).toBeDefined();
    expect(result.pathCount).toBe(100);
    expect(result.horizon).toBe(20);
    expect(result.mode).toBe("B");
  });

  it("VaR5 is less than or equal to median return", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result.var5).toBeLessThanOrEqual(result.medianReturn);
  });

  it("ES5 is less than or equal to VaR5", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result.es5).toBeLessThanOrEqual(result.var5);
  });

  it("p25 return is less than or equal to median", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result.p25Return).toBeLessThanOrEqual(result.medianReturn);
  });

  it("p75 return is greater than or equal to median", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result.p75Return).toBeGreaterThanOrEqual(result.medianReturn);
  });

  it("regime forecast probabilities sum to approximately 1", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    const total = Object.values(result.regimeForecast).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });

  it("max drawdown mean is non-negative", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result.maxDrawdownMean).toBeGreaterThanOrEqual(0);
  });

  it("fragility mean is within 0-100 range", async () => {
    const result = await runMonteCarloSimulation(baseInput);
    expect(result.fragilityMean).toBeGreaterThanOrEqual(0);
    expect(result.fragilityMean).toBeLessThanOrEqual(100);
  });

  it("mode A (deterministic) produces a result", async () => {
    const result = await runMonteCarloSimulation({ ...baseInput, mode: "A" });
    expect(result.mode).toBe("A");
    expect(result.pathCount).toBe(100);
  });

  it("mode C (stress injection) produces higher fragility than mode A", async () => {
    const [modeA, modeC] = await Promise.all([
      runMonteCarloSimulation({ ...baseInput, mode: "A", paths: 200 }),
      runMonteCarloSimulation({ ...baseInput, mode: "C", paths: 200 }),
    ]);
    expect(modeC.fragilityMean).toBeGreaterThanOrEqual(modeA.fragilityMean);
  });

  it("throws for empty holdings", async () => {
    await expect(
      runMonteCarloSimulation({ ...baseInput, holdings: [] }),
    ).rejects.toThrow("No holdings provided");
  });

  it("longer horizon produces non-trivial return spread", async () => {
    const result = await runMonteCarloSimulation({ ...baseInput, horizon: 60, paths: 500 });
    const spread = result.p75Return - result.p25Return;
    expect(spread).toBeGreaterThan(0);
    expect(result.p75Return).toBeGreaterThan(result.p25Return);
  });
});
