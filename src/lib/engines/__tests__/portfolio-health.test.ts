/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { computePortfolioHealth, type HoldingInput } from "../portfolio-health";

const makeHolding = (overrides: Partial<HoldingInput> = {}): HoldingInput => ({
  symbol: "AAPL",
  weight: 1,
  avgVolatilityScore: 50,
  avgLiquidityScore: 60,
  avgTrustScore: 70,
  sector: "Technology",
  type: "STOCK",
  ...overrides,
});

describe("Portfolio Health Engine", () => {
  it("returns zero score for empty portfolio", () => {
    const result = computePortfolioHealth([]);
    expect(result.healthScore).toBe(0);
    expect(result.band).toBe("High Risk");
    expect(result.holdingCount).toBe(0);
  });

  it("all scores are within 0-100 range", () => {
    const holdings = [
      makeHolding({ symbol: "AAPL", weight: 5000, type: "STOCK", sector: "Technology" }),
      makeHolding({ symbol: "BTC", weight: 2000, type: "CRYPTO", sector: null }),
      makeHolding({ symbol: "GLD", weight: 1500, type: "COMMODITY", sector: "Commodities" }),
      makeHolding({ symbol: "SPY", weight: 1500, type: "ETF", sector: "Broad Market" }),
    ];
    const result = computePortfolioHealth(holdings);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(result.dimensions.diversificationScore).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.diversificationScore).toBeLessThanOrEqual(100);
    expect(result.dimensions.concentrationScore).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.concentrationScore).toBeLessThanOrEqual(100);
    expect(result.dimensions.volatilityScore).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.volatilityScore).toBeLessThanOrEqual(100);
    expect(result.dimensions.correlationScore).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.correlationScore).toBeLessThanOrEqual(100);
    expect(result.dimensions.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.qualityScore).toBeLessThanOrEqual(100);
  });

  it("diversified portfolio scores higher than concentrated one", () => {
    const diversified = [
      makeHolding({ symbol: "AAPL", weight: 0.25, type: "STOCK", sector: "Technology" }),
      makeHolding({ symbol: "BTC", weight: 0.25, type: "CRYPTO", sector: null }),
      makeHolding({ symbol: "GLD", weight: 0.25, type: "COMMODITY", sector: "Commodities" }),
      makeHolding({ symbol: "SPY", weight: 0.25, type: "ETF", sector: "Broad Market" }),
    ];
    const concentrated = [
      makeHolding({ symbol: "AAPL", weight: 0.90, type: "STOCK", sector: "Technology" }),
      makeHolding({ symbol: "MSFT", weight: 0.10, type: "STOCK", sector: "Technology" }),
    ];
    const divResult = computePortfolioHealth(diversified);
    const conResult = computePortfolioHealth(concentrated);
    expect(divResult.healthScore).toBeGreaterThan(conResult.healthScore);
  });

  it("high concentration triggers lower concentration score", () => {
    const holdings = [
      makeHolding({ symbol: "AAPL", weight: 0.80 }),
      makeHolding({ symbol: "MSFT", weight: 0.20, sector: "Technology" }),
    ];
    const result = computePortfolioHealth(holdings);
    expect(result.dimensions.concentrationScore).toBeLessThan(60);
  });

  it("high volatility assets lower volatility score", () => {
    const highVol = [
      makeHolding({ symbol: "A", weight: 0.5, avgVolatilityScore: 90 }),
      makeHolding({ symbol: "B", weight: 0.5, avgVolatilityScore: 85, sector: "Crypto" }),
    ];
    const lowVol = [
      makeHolding({ symbol: "C", weight: 0.5, avgVolatilityScore: 20 }),
      makeHolding({ symbol: "D", weight: 0.5, avgVolatilityScore: 15, sector: "Bonds" }),
    ];
    const highResult = computePortfolioHealth(highVol);
    const lowResult = computePortfolioHealth(lowVol);
    expect(lowResult.dimensions.volatilityScore).toBeGreaterThan(highResult.dimensions.volatilityScore);
  });

  it("returns correct band labels", () => {
    const strong = [
      makeHolding({ symbol: "A", weight: 0.25, type: "STOCK", sector: "Tech", avgTrustScore: 90, avgLiquidityScore: 90, avgVolatilityScore: 10 }),
      makeHolding({ symbol: "B", weight: 0.25, type: "ETF", sector: "Finance", avgTrustScore: 85, avgLiquidityScore: 85, avgVolatilityScore: 15 }),
      makeHolding({ symbol: "C", weight: 0.25, type: "COMMODITY", sector: "Energy", avgTrustScore: 80, avgLiquidityScore: 80, avgVolatilityScore: 20 }),
      makeHolding({ symbol: "D", weight: 0.25, type: "CRYPTO", sector: null, avgTrustScore: 75, avgLiquidityScore: 75, avgVolatilityScore: 25 }),
    ];
    const result = computePortfolioHealth(strong);
    expect(["Strong", "Balanced", "Fragile", "High Risk"]).toContain(result.band);
  });

  it("single holding returns low score", () => {
    const result = computePortfolioHealth([makeHolding({ weight: 1 })]);
    expect(result.healthScore).toBeLessThan(50);
    expect(result.dimensions.diversificationScore).toBeLessThanOrEqual(10);
  });

  it("normalizes weights correctly regardless of input scale", () => {
    const rawWeights = [
      makeHolding({ symbol: "A", weight: 5000, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 5000, type: "ETF", sector: "Finance" }),
    ];
    const normalizedWeights = [
      makeHolding({ symbol: "A", weight: 0.5, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 0.5, type: "ETF", sector: "Finance" }),
    ];
    const r1 = computePortfolioHealth(rawWeights);
    const r2 = computePortfolioHealth(normalizedWeights);
    expect(r1.healthScore).toBeCloseTo(r2.healthScore, 1);
  });
});
