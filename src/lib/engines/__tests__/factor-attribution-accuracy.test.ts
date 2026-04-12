/**
 * Factor Attribution Engine — Accuracy Tests
 * Verifies value factor (PE-relative, crypto range), growth factor (price velocity),
 * momentum factor (1M vs 3M), volatility factor (annualized stddev), output clamping.
 */
import { describe, it, expect } from "vitest";
import { calculateFactorProfile } from "../factor-attribution";
import { OHLCV } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHistory(closes: number[], startDate = "2020-01-01"): OHLCV[] {
  return closes.map((close, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split("T")[0],
      open: close,
      high: close * 1.005,
      low: close * 0.995,
      close,
      volume: 1_000_000,
    };
  });
}

function linearPrices(n: number, start: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

function flatPrices(n: number, price: number): number[] {
  return Array.from({ length: n }, () => price);
}

// ─── Value Factor ─────────────────────────────────────────────────────────────

describe("Factor Attribution — value factor", () => {
  it("PE below industry PE → high value score", () => {
    // peRel = industryPe / peRatio = 30/10 = 3 → valueScore = min(100, 3*50) = 100
    const history = makeHistory(flatPrices(30, 100));
    const result = calculateFactorProfile("AAPL", history, { peRatio: 10, industryPe: 30 });
    expect(result.value).toBeGreaterThan(70);
  });

  it("PE above industry PE → low value score", () => {
    // peRel = 10/50 = 0.2 → valueScore = min(100, 0.2*50) = 10
    const history = makeHistory(flatPrices(30, 100));
    const result = calculateFactorProfile("AAPL", history, { peRatio: 50, industryPe: 10 });
    expect(result.value).toBeLessThan(30);
  });

  it("PE = industry PE → valueScore = 50", () => {
    const history = makeHistory(flatPrices(30, 100));
    const result = calculateFactorProfile("AAPL", history, { peRatio: 20, industryPe: 20 });
    // peRel = 1 → 50, no ROE → valueScore = 50
    expect(result.value).toBe(50);
  });

  it("high ROE boosts value score", () => {
    const history = makeHistory(flatPrices(30, 100));
    const withROE = calculateFactorProfile("AAPL", history, { peRatio: 20, industryPe: 20, roe: 40 });
    const noROE = calculateFactorProfile("AAPL", history, { peRatio: 20, industryPe: 20 });
    // With ROE=40: valueScore = (50 + min(100, 40*2)) / 2 = (50 + 80) / 2 = 65
    expect(withROE.value).toBeGreaterThan(noROE.value);
  });

  it("crypto value: price near 52W low → high value score", () => {
    // Build 252 bars: prices from 200 down to 100 (near low)
    const prices = linearPrices(252, 200, -0.4);
    const history = makeHistory(prices);
    const result = calculateFactorProfile("BTC-USD", history, {});
    // last price ≈ 100, low ≈ 100, high ≈ 200 → positionInRange ≈ 0 → valueScore = (1-0)*70+15 = 85
    expect(result.value).toBeGreaterThan(60);
  });

  it("crypto value: price near 52W high → low value score", () => {
    // Prices rising from 100 to 200 (near high)
    const prices = linearPrices(252, 100, 0.4);
    const history = makeHistory(prices);
    const result = calculateFactorProfile("BTC-USD", history, {});
    // last price ≈ 200, high ≈ 200 → positionInRange ≈ 1 → valueScore = (1-1)*70+15 = 15
    expect(result.value).toBeLessThan(30);
  });
});

// ─── Growth Factor ────────────────────────────────────────────────────────────

describe("Factor Attribution — growth factor", () => {
  it("flat prices → totalGrowth = 0 → growthScore = 50", () => {
    const history = makeHistory(flatPrices(30, 100));
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.growth).toBeCloseTo(50, 0);
  });

  it("50% price growth → growthScore = min(95, 50 + 50*100) = 95 (clamped)", () => {
    // start=100, end=150 → totalGrowth = 0.5 → 50 + 0.5*100 = 100 → clamped to 95
    const prices = linearPrices(30, 100, 50 / 29);
    const history = makeHistory(prices);
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.growth).toBe(95);
  });

  it("large price decline → growthScore = 10 (clamped at floor)", () => {
    // Need totalGrowth < -0.40 to hit floor: 50 + (-0.40)*100 = 10
    // Use 60% decline: start=250, end=100 → totalGrowth = (100-250)/250 = -0.60
    // growthScore = max(10, 50 + (-0.60)*100) = max(10, -10) = 10
    const prices = linearPrices(30, 250, -5);
    const history = makeHistory(prices);
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.growth).toBe(10);
  });

  it("rising prices → higher growth score than falling prices", () => {
    const rising = calculateFactorProfile("BTC-USD", makeHistory(linearPrices(30, 100, 1)), {});
    const falling = calculateFactorProfile("BTC-USD", makeHistory(linearPrices(30, 130, -1)), {});
    expect(rising.growth).toBeGreaterThan(falling.growth);
  });
});

// ─── Momentum Factor ─────────────────────────────────────────────────────────

describe("Factor Attribution — momentum factor", () => {
  it("flat prices → mom1m = 0, mom3m = 0 → momentumScore = 50", () => {
    const history = makeHistory(flatPrices(70, 100));
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.momentum).toBeCloseTo(50, 0);
  });

  it("strong 1M uptrend → momentumScore > 50", () => {
    // Last 21 bars rising strongly
    const base = flatPrices(49, 100);
    const recent = linearPrices(21, 100, 1);
    const history = makeHistory([...base, ...recent]);
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.momentum).toBeGreaterThan(50);
  });

  it("strong 1M downtrend → momentumScore < 50", () => {
    const base = flatPrices(49, 120);
    const recent = linearPrices(21, 120, -1);
    const history = makeHistory([...base, ...recent]);
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.momentum).toBeLessThan(50);
  });

  it("momentum formula: 50 + mom1m*50 + mom3m*25", () => {
    const history = makeHistory(flatPrices(70, 100));
    const result = calculateFactorProfile("BTC-USD", history, {});
    // mom1m = 0, mom3m = 0 → 50 + 0 + 0 = 50
    expect(result.momentum).toBe(50);
  });
});

// ─── Volatility Factor ────────────────────────────────────────────────────────

describe("Factor Attribution — volatility factor (inverse)", () => {
  it("flat prices → stdDev = 0 → annualizedVol = 0 → volScore = 100 → clamped 95", () => {
    const history = makeHistory(flatPrices(30, 100));
    const result = calculateFactorProfile("BTC-USD", history, {});
    // stdDev = 0 → 100 - 0*60 = 100 → clamped to 95
    expect(result.volatility).toBe(95);
  });

  it("high volatility → low volScore (higher vol = lower score)", () => {
    // Alternating ±10% prices → high stdDev
    const prices = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 100 : 90));
    const history = makeHistory(prices);
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.volatility).toBeLessThan(50);
  });

  it("lower volatility → higher volScore (monotonicity)", () => {
    const calm = calculateFactorProfile("BTC-USD", makeHistory(flatPrices(30, 100)), {});
    const volatile = calculateFactorProfile("BTC-USD", makeHistory(
      Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 100 : 85)),
    ), {});
    expect(calm.volatility).toBeGreaterThan(volatile.volatility);
  });

  it("lowVol = volatility (same value)", () => {
    const history = makeHistory(flatPrices(30, 100));
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.lowVol).toBe(result.volatility);
  });
});

// ─── Output Clamping ─────────────────────────────────────────────────────────

describe("Factor Attribution — output clamping [10, 95]", () => {
  it("all scores are in [10, 95]", () => {
    const datasets = [
      { prices: flatPrices(30, 100), fin: {} },
      { prices: linearPrices(30, 100, 5), fin: { peRatio: 5, industryPe: 100, roe: 50 } },
      { prices: linearPrices(30, 200, -5), fin: { peRatio: 100, industryPe: 5 } },
    ];
    for (const { prices, fin } of datasets) {
      const result = calculateFactorProfile("BTC-USD", makeHistory(prices), fin);
      expect(result.value).toBeGreaterThanOrEqual(10);
      expect(result.value).toBeLessThanOrEqual(95);
      expect(result.growth).toBeGreaterThanOrEqual(10);
      expect(result.growth).toBeLessThanOrEqual(95);
      expect(result.momentum).toBeGreaterThanOrEqual(10);
      expect(result.momentum).toBeLessThanOrEqual(95);
      expect(result.volatility).toBeGreaterThanOrEqual(10);
      expect(result.volatility).toBeLessThanOrEqual(95);
    }
  });

  it("insufficient history (<20 bars) → all scores default to 50", () => {
    const history = makeHistory(flatPrices(10, 100));
    const result = calculateFactorProfile("BTC-USD", history, {});
    expect(result.growth).toBe(50);
    expect(result.momentum).toBe(50);
    expect(result.volatility).toBe(50);
  });
});
