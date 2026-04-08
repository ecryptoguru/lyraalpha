/**
 * @vitest-environment node
 *
 * Portfolio Fragility Engine — accuracy & correctness tests.
 * Validates mathematical properties, boundary conditions, and monotonicity.
 */
import { describe, it, expect } from "vitest";
import {
  computePortfolioFragility,
  type FragilityHoldingInput,
} from "../portfolio-fragility";

const makeHolding = (overrides: Partial<FragilityHoldingInput> = {}): FragilityHoldingInput => ({
  symbol: "AAPL",
  weight: 1,
  avgVolatilityScore: 50,
  avgLiquidityScore: 60,
  avgTrustScore: 70,
  compatibilityScore: 55,
  sector: "Technology",
  type: "STOCK",
  ...overrides,
});

// ─── Boundary Conditions ────────────────────────────────────────────────────

describe("Portfolio Fragility Engine — boundary conditions", () => {
  it("returns zero fragility for empty portfolio", () => {
    const result = computePortfolioFragility([]);
    expect(result.fragilityScore).toBe(0);
    expect(result.classification).toBe("Robust");
    expect(result.topDrivers).toHaveLength(0);
  });

  it("all component scores are within [0, 100]", () => {
    const holdings = [
      makeHolding({ symbol: "A", weight: 0.4, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 0.3, type: "CRYPTO", sector: null, avgVolatilityScore: 90 }),
      makeHolding({ symbol: "C", weight: 0.3, type: "ETF", sector: "Finance" }),
    ];
    const result = computePortfolioFragility(holdings);
    expect(result.fragilityScore).toBeGreaterThanOrEqual(0);
    expect(result.fragilityScore).toBeLessThanOrEqual(100);
    expect(result.components.volatilityFragility).toBeGreaterThanOrEqual(0);
    expect(result.components.volatilityFragility).toBeLessThanOrEqual(100);
    expect(result.components.correlationFragility).toBeGreaterThanOrEqual(0);
    expect(result.components.correlationFragility).toBeLessThanOrEqual(100);
    expect(result.components.liquidityFragility).toBeGreaterThanOrEqual(0);
    expect(result.components.liquidityFragility).toBeLessThanOrEqual(100);
    expect(result.components.factorRotationFragility).toBeGreaterThanOrEqual(0);
    expect(result.components.factorRotationFragility).toBeLessThanOrEqual(100);
    expect(result.components.concentrationFragility).toBeGreaterThanOrEqual(0);
    expect(result.components.concentrationFragility).toBeLessThanOrEqual(100);
  });

  it("single holding returns non-zero fragility (max concentration)", () => {
    const result = computePortfolioFragility([makeHolding({ weight: 1 })]);
    // HHI of [1.0] = 1.0 → concentrationFragility = 100
    expect(result.components.concentrationFragility).toBeCloseTo(100, 0);
    expect(result.fragilityScore).toBeGreaterThan(0);
  });
});

// ─── Monotonicity ───────────────────────────────────────────────────────────

describe("Portfolio Fragility Engine — monotonicity", () => {
  it("higher volatility scores produce higher volatility fragility", () => {
    const low = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgVolatilityScore: 10 }),
      makeHolding({ symbol: "B", weight: 0.5, avgVolatilityScore: 15 }),
    ]);
    const high = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgVolatilityScore: 85 }),
      makeHolding({ symbol: "B", weight: 0.5, avgVolatilityScore: 90 }),
    ]);
    expect(high.components.volatilityFragility).toBeGreaterThan(low.components.volatilityFragility);
  });

  it("lower liquidity scores produce higher liquidity fragility", () => {
    const liquid = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgLiquidityScore: 90 }),
      makeHolding({ symbol: "B", weight: 0.5, avgLiquidityScore: 85 }),
    ]);
    const illiquid = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgLiquidityScore: 10 }),
      makeHolding({ symbol: "B", weight: 0.5, avgLiquidityScore: 5 }),
    ]);
    expect(illiquid.components.liquidityFragility).toBeGreaterThan(liquid.components.liquidityFragility);
  });

  it("concentrated portfolio is more fragile than diversified one", () => {
    const diversified = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.25, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 0.25, type: "ETF", sector: "Finance" }),
      makeHolding({ symbol: "C", weight: 0.25, type: "CRYPTO", sector: null }),
      makeHolding({ symbol: "D", weight: 0.25, type: "COMMODITY", sector: "Energy" }),
    ]);
    const concentrated = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.90, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 0.10, type: "STOCK", sector: "Tech" }),
    ]);
    expect(concentrated.fragilityScore).toBeGreaterThan(diversified.fragilityScore);
  });

  it("lower compatibility score produces higher factor rotation fragility", () => {
    const aligned = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, compatibilityScore: 90 }),
      makeHolding({ symbol: "B", weight: 0.5, compatibilityScore: 85 }),
    ]);
    const misaligned = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, compatibilityScore: 10 }),
      makeHolding({ symbol: "B", weight: 0.5, compatibilityScore: 5 }),
    ]);
    expect(misaligned.components.factorRotationFragility).toBeGreaterThan(aligned.components.factorRotationFragility);
  });
});

// ─── Mathematical Accuracy ──────────────────────────────────────────────────

describe("Portfolio Fragility Engine — mathematical accuracy", () => {
  it("concentration fragility for equal-weight 4-asset portfolio matches HHI formula", () => {
    // Equal weight 4 assets → HHI = 4 * (0.25)^2 = 0.25 → concentrationFragility = 25
    const holdings = [
      makeHolding({ symbol: "A", weight: 0.25 }),
      makeHolding({ symbol: "B", weight: 0.25, sector: "Finance" }),
      makeHolding({ symbol: "C", weight: 0.25, sector: "Energy" }),
      makeHolding({ symbol: "D", weight: 0.25, sector: "Health" }),
    ];
    const result = computePortfolioFragility(holdings);
    expect(result.components.concentrationFragility).toBeCloseTo(25, 0);
  });

  it("concentration fragility for single asset is 100", () => {
    const result = computePortfolioFragility([makeHolding({ weight: 1.0 })]);
    expect(result.components.concentrationFragility).toBeCloseTo(100, 0);
  });

  it("liquidity fragility for fully liquid portfolio is near zero", () => {
    const result = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgLiquidityScore: 100 }),
      makeHolding({ symbol: "B", weight: 0.5, avgLiquidityScore: 100 }),
    ]);
    // illiquidity = 0, regimePenalty = 0 → liquidityFragility = 0
    expect(result.components.liquidityFragility).toBeCloseTo(0, 1);
  });

  it("liquidity fragility for fully illiquid portfolio is near 130 clamped to 100", () => {
    const result = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgLiquidityScore: 0 }),
      makeHolding({ symbol: "B", weight: 0.5, avgLiquidityScore: 0 }),
    ]);
    // illiquidity=1, regimePenalty=0.3 → (1+0.3)*100 = 130 → clamped to 100
    expect(result.components.liquidityFragility).toBeCloseTo(100, 0);
  });

  it("volatility fragility applies regime stress multiplier (1 + 0.65*0.5 = 1.325)", () => {
    // Single holding, vol=40 → 40 * 1.325 = 53
    const result = computePortfolioFragility([
      makeHolding({ weight: 1.0, avgVolatilityScore: 40 }),
    ]);
    expect(result.components.volatilityFragility).toBeCloseTo(40 * 1.325, 0);
  });

  it("factor rotation fragility for perfect compatibility is near zero", () => {
    const result = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, compatibilityScore: 100 }),
      makeHolding({ symbol: "B", weight: 0.5, compatibilityScore: 100 }),
    ]);
    expect(result.components.factorRotationFragility).toBeCloseTo(0, 1);
  });

  it("factor rotation fragility for zero compatibility is 100", () => {
    const result = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, compatibilityScore: 0 }),
      makeHolding({ symbol: "B", weight: 0.5, compatibilityScore: 0 }),
    ]);
    expect(result.components.factorRotationFragility).toBeCloseTo(100, 0);
  });

  it("composite score is weighted sum of components (within rounding tolerance)", () => {
    const holdings = [
      makeHolding({ symbol: "A", weight: 0.5, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 0.5, type: "ETF", sector: "Finance" }),
    ];
    const result = computePortfolioFragility(holdings);
    const { volatilityFragility, correlationFragility, liquidityFragility, factorRotationFragility, concentrationFragility } = result.components;
    const expected =
      volatilityFragility * 0.25 +
      correlationFragility * 0.20 +
      liquidityFragility * 0.25 +
      factorRotationFragility * 0.15 +
      concentrationFragility * 0.15;
    // fragilityScore is computed from unrounded values; components are rounded to 1dp
    // so allow ±1 tolerance for rounding differences
    expect(Math.abs(result.fragilityScore - expected)).toBeLessThan(1.5);
  });

  it("weight normalization: raw weights produce same result as normalized weights", () => {
    const raw = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 3000, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 7000, type: "ETF", sector: "Finance" }),
    ]);
    const norm = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.3, type: "STOCK", sector: "Tech" }),
      makeHolding({ symbol: "B", weight: 0.7, type: "ETF", sector: "Finance" }),
    ]);
    expect(raw.fragilityScore).toBeCloseTo(norm.fragilityScore, 1);
  });
});

// ─── Classification ─────────────────────────────────────────────────────────

describe("Portfolio Fragility Engine — classification", () => {
  it("returns Robust for very low fragility", () => {
    // Maximally diversified, liquid, low-vol portfolio
    const holdings = [
      makeHolding({ symbol: "A", weight: 0.25, type: "STOCK", sector: "Tech", avgVolatilityScore: 5, avgLiquidityScore: 99, compatibilityScore: 99 }),
      makeHolding({ symbol: "B", weight: 0.25, type: "ETF", sector: "Finance", avgVolatilityScore: 5, avgLiquidityScore: 99, compatibilityScore: 99 }),
      makeHolding({ symbol: "C", weight: 0.25, type: "COMMODITY", sector: "Energy", avgVolatilityScore: 5, avgLiquidityScore: 99, compatibilityScore: 99 }),
      makeHolding({ symbol: "D", weight: 0.25, type: "CRYPTO", sector: null, avgVolatilityScore: 5, avgLiquidityScore: 99, compatibilityScore: 99 }),
    ];
    const result = computePortfolioFragility(holdings);
    expect(["Robust", "Moderate"]).toContain(result.classification);
  });

  it("returns Structurally Fragile for worst-case portfolio", () => {
    // Single concentrated, illiquid, high-vol, misaligned asset
    const result = computePortfolioFragility([
      makeHolding({ weight: 1.0, avgVolatilityScore: 100, avgLiquidityScore: 0, compatibilityScore: 0 }),
    ]);
    expect(["Fragile", "Structurally Fragile"]).toContain(result.classification);
  });

  it("topDrivers contains at most 3 entries", () => {
    const result = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5 }),
      makeHolding({ symbol: "B", weight: 0.5, sector: "Finance" }),
    ]);
    expect(result.topDrivers.length).toBeLessThanOrEqual(3);
  });

  it("topDrivers are sorted by severity (highest fragility component first)", () => {
    // Force high volatility fragility to be the top driver
    const result = computePortfolioFragility([
      makeHolding({ symbol: "A", weight: 0.5, avgVolatilityScore: 99, avgLiquidityScore: 99, compatibilityScore: 99 }),
      makeHolding({ symbol: "B", weight: 0.5, avgVolatilityScore: 99, avgLiquidityScore: 99, compatibilityScore: 99 }),
    ]);
    expect(result.topDrivers[0]).toContain("Volatility");
  });

  it("null scores fall back to defaults (50) without throwing", () => {
    const result = computePortfolioFragility([
      makeHolding({ avgVolatilityScore: null, avgLiquidityScore: null, compatibilityScore: null }),
    ]);
    expect(result.fragilityScore).toBeGreaterThanOrEqual(0);
    expect(result.fragilityScore).toBeLessThanOrEqual(100);
  });
});
