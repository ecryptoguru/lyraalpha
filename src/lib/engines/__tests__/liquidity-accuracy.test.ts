/**
 * Liquidity Engine — Accuracy Tests
 * Verifies depth tier thresholds, stability (CV), volume trend ratio,
 * relative volume, short drag, cap tier, composite formula, and direction.
 */
import { describe, it, expect } from "vitest";
import { calculateLiquidityScore } from "../liquidity";
import { OHLCV } from "../types";
import type { MarketQuote } from "@/types/market-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuote(overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    regularMarketPrice: 100,
    regularMarketVolume: 1_000_000,
    averageDailyVolume10Day: 1_000_000,
    ...overrides,
  } as MarketQuote;
}

function makeHistory(volumes: number[]): OHLCV[] {
  return volumes.map((volume, i) => ({
    date: `2020-01-${String(i + 1).padStart(3, "0")}`,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume,
  }));
}

// ─── Depth-Only Mode (no enrichment) ─────────────────────────────────────────

describe("Liquidity — depth-only mode", () => {
  it("$600M dollar volume → institutional grade → score >= 90", () => {
    // avgVol10 * price = 6_000_000 * 100 = $600M > $500M threshold
    const quote = makeQuote({ averageDailyVolume10Day: 6_000_000, regularMarketPrice: 100 });
    const result = calculateLiquidityScore(quote);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("$150M dollar volume → high liquidity → score in [75, 90)", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 1_500_000, regularMarketPrice: 100 });
    const result = calculateLiquidityScore(quote);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.score).toBeLessThan(90);
  });

  it("$15M dollar volume → medium liquidity → score in [50, 75)", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 150_000, regularMarketPrice: 100 });
    const result = calculateLiquidityScore(quote);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(75);
  });

  it("$500K dollar volume → low liquidity → score < 30", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 5_000, regularMarketPrice: 100 });
    const result = calculateLiquidityScore(quote);
    expect(result.score).toBeLessThan(30);
  });

  it("zero volume → very low score", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 0, regularMarketVolume: 0, regularMarketPrice: 100 });
    const result = calculateLiquidityScore(quote);
    expect(result.score).toBeLessThan(10);
  });
});

// ─── Stability Dimension ──────────────────────────────────────────────────────

describe("Liquidity — stability score", () => {
  it("constant volume → CV = 0 → stabilityScore = 95", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.stability).toBe(95);
  });

  it("erratic volume → high CV → lower stability score", () => {
    const volumes = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? 5_000_000 : 10_000,
    );
    const quote = makeQuote({ averageDailyVolume10Day: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(volumes);
    const result = calculateLiquidityScore(quote, { history });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.stability).toBeLessThan(50);
  });

  it("stable > erratic stability score", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 1_000_000, regularMarketPrice: 100 });
    const stable = calculateLiquidityScore(quote, { history: makeHistory(Array(30).fill(1_000_000)) });
    const erratic = calculateLiquidityScore(quote, {
      history: makeHistory(Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? 5_000_000 : 10_000)),
    });
    const stableDims = stable.metadata?.dimensions as Record<string, number>;
    const erraticDims = erratic.metadata?.dimensions as Record<string, number>;
    expect(stableDims.stability).toBeGreaterThan(erraticDims.stability);
  });
});

// ─── Volume Trend Dimension ───────────────────────────────────────────────────

describe("Liquidity — volume trend score", () => {
  it("SMA5 = SMA20 (constant volume) → trendScore = 50", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.trend).toBeCloseTo(50, 0);
  });

  it("recent volume surge → SMA5 >> SMA20 → trendScore > 50", () => {
    // First 25 bars low, last 5 bars very high
    const volumes = [...Array(25).fill(100_000), ...Array(5).fill(5_000_000)];
    const quote = makeQuote({ averageDailyVolume10Day: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(volumes);
    const result = calculateLiquidityScore(quote, { history });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.trend).toBeGreaterThan(50);
  });

  it("recent volume dry-up → SMA5 << SMA20 → trendScore < 50", () => {
    const volumes = [...Array(25).fill(5_000_000), ...Array(5).fill(10_000)];
    const quote = makeQuote({ averageDailyVolume10Day: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(volumes);
    const result = calculateLiquidityScore(quote, { history });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.trend).toBeLessThan(50);
  });
});

// ─── Relative Volume Dimension ────────────────────────────────────────────────

describe("Liquidity — relative volume score", () => {
  it("spot volume = avg3M → ratio = 1 → relativeScore = 50", () => {
    const quote = makeQuote({ regularMarketVolume: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history, avgVolume3M: 1_000_000 });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.relative).toBeCloseTo(50, 0);
  });

  it("spot volume = 2x avg3M → relativeScore > 50", () => {
    const quote = makeQuote({ regularMarketVolume: 2_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history, avgVolume3M: 1_000_000 });
    const dims = result.metadata?.dimensions as Record<string, number>;
    // ratio = 2 → 50 + (2-1)*40 = 90
    expect(dims.relative).toBeCloseTo(90, 0);
  });

  it("spot volume = 0.3x avg3M → relativeScore < 50", () => {
    const quote = makeQuote({ regularMarketVolume: 300_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history, avgVolume3M: 1_000_000 });
    const dims = result.metadata?.dimensions as Record<string, number>;
    // ratio = 0.3 → 50 + (0.3-1)*40 = 50 - 28 = 22
    expect(dims.relative).toBeCloseTo(22, 0);
  });
});

// ─── Cap Tier Dimension ───────────────────────────────────────────────────────

describe("Liquidity — cap tier score", () => {
  it("mega cap ($200B) → capTierScore = 95", () => {
    const quote = makeQuote({ regularMarketVolume: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history, marketCap: 200000000000 });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.capTier).toBe(95);
  });

  it("large cap ($15B) → capTierScore = 80", () => {
    const quote = makeQuote({ regularMarketVolume: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history, marketCap: 15000000000 });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.capTier).toBe(80);
  });

  it("micro cap ($50M) → capTierScore = 25", () => {
    const quote = makeQuote({ regularMarketVolume: 1_000_000, regularMarketPrice: 100 });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, { history, marketCap: 50000000 });
    const dims = result.metadata?.dimensions as Record<string, number>;
    expect(dims.capTier).toBe(25);
  });
});

// ─── Composite Formula ────────────────────────────────────────────────────────

describe("Liquidity — composite formula (with enrichment)", () => {
  it("score = round(depth*0.40 + stability*0.15 + trend*0.15 + relative*0.15 + capTier*0.15)", () => {
    const quote = makeQuote({
      regularMarketVolume: 1_000_000,
      averageDailyVolume10Day: 1_000_000,
      regularMarketPrice: 100,
    });
    const history = makeHistory(Array(30).fill(1_000_000));
    const result = calculateLiquidityScore(quote, {
      history,
      avgVolume3M: 1_000_000,
      marketCap: 10000000000,
    });
    const d = result.metadata?.dimensions as Record<string, number>;
    const expected = Math.round(
      d.depth * 0.40 + d.stability * 0.15 + d.trend * 0.15 +
      d.relative * 0.15 + d.capTier * 0.15,
    );
    const clamped = Math.min(100, Math.max(1, expected));
    expect(result.score).toBe(clamped);
  });

  it("score always in [1, 100]", () => {
    const quote = makeQuote({ regularMarketVolume: 0, regularMarketPrice: 0 });
    const result = calculateLiquidityScore(quote, { history: makeHistory(Array(30).fill(0)) });
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─── Direction ────────────────────────────────────────────────────────────────

describe("Liquidity — direction", () => {
  it("score > 80 → direction = UP", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 6_000_000, regularMarketPrice: 100 });
    const result = calculateLiquidityScore(quote);
    expect(result.direction).toBe("UP");
  });

  it("score < 40 → direction = DOWN", () => {
    const quote = makeQuote({ averageDailyVolume10Day: 100, regularMarketPrice: 1 });
    const result = calculateLiquidityScore(quote);
    expect(result.direction).toBe("DOWN");
  });
});
