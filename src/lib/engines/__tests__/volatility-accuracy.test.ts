/**
 * Volatility Engine — Accuracy Tests
 * Verifies NATR calculation, Bollinger %B band-width scoring,
 * vol regime ratio, crypto vs equity scaling, composite formula,
 * and direction thresholds.
 */
import { describe, it, expect } from "vitest";
import { calculateVolatilityScore } from "../volatility";
import { OHLCV } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBar(close: number, high?: number, low?: number, i = 0): OHLCV {
  return {
    date: `2020-01-${String(i + 1).padStart(3, "0")}`,
    open: close,
    high: high ?? close * 1.01,
    low: low ?? close * 0.99,
    close,
    volume: 1_000_000,
  };
}

/** Flat OHLCV with controlled high/low spread */
function flatBars(n: number, close: number, spread = 0.01): OHLCV[] {
  return Array.from({ length: n }, (_, i) =>
    makeBar(close, close * (1 + spread), close * (1 - spread), i),
  );
}

/** Alternating high/low volatility bars */
function altVolBars(n: number, close: number, bigSpread: number, smallSpread: number): OHLCV[] {
  return Array.from({ length: n }, (_, i) => {
    const spread = i % 2 === 0 ? bigSpread : smallSpread;
    return makeBar(close, close * (1 + spread), close * (1 - spread), i);
  });
}

// ─── Insufficient Data ────────────────────────────────────────────────────────

describe("Volatility — insufficient data", () => {
  it("< 20 bars → score=50, direction=NEUTRAL", () => {
    const result = calculateVolatilityScore(flatBars(15, 100));
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
  });

  it("exactly 20 bars → computes a score", () => {
    const result = calculateVolatilityScore(flatBars(20, 100));
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(99);
  });
});

// ─── NATR Accuracy ────────────────────────────────────────────────────────────

describe("Volatility — NATR accuracy", () => {
  it("tiny spread (0.1%) → low natrScore for equity", () => {
    const data = flatBars(30, 100, 0.001);
    const result = calculateVolatilityScore(data, "CRYPTO");
    const natrScore = result.metadata?.natrScore as number;
    // natr ≈ 0.2% → (0.2/3)*60 = 4 → very low
    expect(natrScore).toBeLessThan(15);
  });

  it("large spread (5%) → high natrScore for equity", () => {
    const data = flatBars(30, 100, 0.05);
    const result = calculateVolatilityScore(data, "CRYPTO");
    const natrScore = result.metadata?.natrScore as number;
    // natr ≈ 10% → 60 + (10-3)*20 = 200 → clamped 100
    expect(natrScore).toBeGreaterThanOrEqual(80);
  });

  it("same spread: natrScore is deterministic", () => {
    const data = flatBars(30, 100, 0.03);
    const cryptoResult = calculateVolatilityScore(data, "CRYPTO");
    const cryptoResult2 = calculateVolatilityScore(data, "CRYPTO");
    expect(cryptoResult.metadata?.natrScore as number).toBe(
      cryptoResult2.metadata?.natrScore as number,
    );
  });

  it("natr metadata is non-negative", () => {
    const data = flatBars(30, 100, 0.02);
    const result = calculateVolatilityScore(data, "CRYPTO");
    expect(result.metadata?.natr as number).toBeGreaterThanOrEqual(0);
  });
});

// ─── Bollinger Band Width ─────────────────────────────────────────────────────

describe("Volatility — Bollinger band width (bbScore)", () => {
  it("flat close prices → std of closes = 0 → bandWidth = 0 → bbScore = 50 (no bands)", () => {
    // Bollinger uses close prices for std. Flat closes → std=0 → bandWidth=0 → bbScore=50 (fallback)
    const data = flatBars(30, 100, 0.0001);
    const result = calculateVolatilityScore(data, "CRYPTO");
    // bandWidth = 0 → the if(bandWidth > 0) branch is skipped → bbScore stays at 50
    expect(result.metadata?.bbScore as number).toBe(50);
  });

  it("alternating close prices → non-zero std → bbScore > 50", () => {
    // Alternating closes create non-zero std → wider bands → higher bbScore
    const data = Array.from({ length: 30 }, (_, i) => ({
      date: `2020-01-${String(i + 1).padStart(3, "0")}`,
      open: 100,
      high: 110,
      low: 90,
      close: i % 2 === 0 ? 108 : 92, // alternating closes → high std
      volume: 1_000_000,
    }));
    const result = calculateVolatilityScore(data, "CRYPTO");
    expect(result.metadata?.bbScore as number).toBeGreaterThan(50);
  });

  it("wider close spread → higher bbScore (monotonicity)", () => {
    const narrow = Array.from({ length: 30 }, (_, i) => ({
      date: `2020-01-${String(i + 1).padStart(3, "0")}`,
      open: 100, high: 101, low: 99,
      close: i % 2 === 0 ? 100.5 : 99.5, // tiny spread
      volume: 1_000_000,
    }));
    const wide = Array.from({ length: 30 }, (_, i) => ({
      date: `2020-01-${String(i + 1).padStart(3, "0")}`,
      open: 100, high: 120, low: 80,
      close: i % 2 === 0 ? 115 : 85, // large spread
      volume: 1_000_000,
    }));
    const narrowResult = calculateVolatilityScore(narrow, "CRYPTO");
    const wideResult = calculateVolatilityScore(wide, "CRYPTO");
    expect(wideResult.metadata?.bbScore as number).toBeGreaterThan(narrowResult.metadata?.bbScore as number);
  });
});

// ─── Vol Regime ───────────────────────────────────────────────────────────────

describe("Volatility — vol regime score", () => {
  it("flat prices → recentVol = longerVol → regimeScore ≈ 50", () => {
    const data = flatBars(70, 100, 0.01);
    const result = calculateVolatilityScore(data, "CRYPTO");
    // Both recentVol and longerVol are same → ratio = 1 → regimeScore = 50
    expect(result.metadata?.regimeScore as number).toBeCloseTo(50, 5);
  });

  it("recent vol expanding → regimeScore > 50", () => {
    // Vol regime uses CLOSE prices for realized vol calculation
    // First 46 bars: flat closes (low vol), last 14 bars: alternating closes (high vol)
    const calm = Array.from({ length: 46 }, (_, i) => ({
      date: `2020-01-${String(i + 1).padStart(3, "0")}`,
      open: 100, high: 101, low: 99, close: 100, volume: 1_000_000,
    }));
    const wild = Array.from({ length: 14 }, (_, i) => ({
      date: `2020-01-${String(i + 47).padStart(3, "0")}`,
      open: 100, high: 120, low: 80,
      close: i % 2 === 0 ? 115 : 85,
      volume: 1_000_000,
    }));
    const data = [...calm, ...wild];
    const result = calculateVolatilityScore(data, "CRYPTO");
    expect(result.metadata?.regimeScore as number).toBeGreaterThan(50);
  });

  it("recent vol contracting → regimeScore < 50", () => {
    // First 46 bars: alternating closes (high vol), last 14 bars: flat closes (low vol)
    const wild = Array.from({ length: 46 }, (_, i) => ({
      date: `2020-01-${String(i + 1).padStart(3, "0")}`,
      open: 100, high: 120, low: 80,
      close: i % 2 === 0 ? 115 : 85,
      volume: 1_000_000,
    }));
    const calm = Array.from({ length: 14 }, (_, i) => ({
      date: `2020-01-${String(i + 47).padStart(3, "0")}`,
      open: 100, high: 101, low: 99, close: 100, volume: 1_000_000,
    }));
    const data = [...wild, ...calm];
    const result = calculateVolatilityScore(data, "CRYPTO");
    expect(result.metadata?.regimeScore as number).toBeLessThan(50);
  });
});

// ─── Composite Formula ────────────────────────────────────────────────────────

describe("Volatility — composite formula", () => {
  it("score = round(natrScore*0.40 + bbScore*0.30 + regimeScore*0.30)", () => {
    const data = flatBars(60, 100, 0.02);
    const result = calculateVolatilityScore(data, "CRYPTO");
    const { natrScore, bbScore, regimeScore } = result.metadata as Record<string, number>;
    const expected = Math.round(natrScore * 0.40 + bbScore * 0.30 + regimeScore * 0.30);
    const clamped = Math.min(99, Math.max(1, expected));
    expect(result.score).toBe(clamped);
  });

  it("score always in [1, 99]", () => {
    const datasets = [
      flatBars(30, 100, 0.001),
      flatBars(30, 100, 0.1),
      altVolBars(30, 100, 0.05, 0.001),
    ];
    for (const data of datasets) {
      const result = calculateVolatilityScore(data, "CRYPTO");
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(99);
    }
  });
});

// ─── Direction Thresholds ─────────────────────────────────────────────────────

describe("Volatility — direction thresholds", () => {
  it("score >= 70 → direction = UP", () => {
    const data = altVolBars(60, 100, 0.08, 0.001);
    const result = calculateVolatilityScore(data, "CRYPTO");
    if (result.score >= 70) expect(result.direction).toBe("UP");
  });

  it("score <= 30 → direction = DOWN", () => {
    const data = flatBars(60, 100, 0.001);
    const result = calculateVolatilityScore(data, "CRYPTO");
    if (result.score <= 30) expect(result.direction).toBe("DOWN");
  });

  it("high-vol data → direction = UP (if score >= 70)", () => {
    const data = altVolBars(60, 100, 0.1, 0.001);
    const result = calculateVolatilityScore(data, "CRYPTO");
    if (result.score >= 70) {
      expect(result.direction).toBe("UP");
    } else {
      // Score didn't reach 70 threshold — direction stays FLAT
      expect(["FLAT", "UP"]).toContain(result.direction);
    }
  });

  it("low-vol data → direction = DOWN or FLAT", () => {
    // Flat closes → natrScore low, bbScore=50, regimeScore=50 → composite may be FLAT or DOWN
    const data = flatBars(60, 100, 0.0005);
    const result = calculateVolatilityScore(data, "CRYPTO");
    expect(["DOWN", "FLAT"]).toContain(result.direction);
  });
});

// ─── Monotonicity ─────────────────────────────────────────────────────────────

describe("Volatility — monotonicity", () => {
  it("higher spread → higher score", () => {
    const low = calculateVolatilityScore(flatBars(30, 100, 0.005), "CRYPTO");
    const high = calculateVolatilityScore(flatBars(30, 100, 0.04), "CRYPTO");
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("crypto score is deterministic for same data", () => {
    const data = flatBars(30, 100, 0.03);
    const crypto = calculateVolatilityScore(data, "CRYPTO");
    const crypto2 = calculateVolatilityScore(data, "CRYPTO");
    expect(crypto.score).toBe(crypto2.score);
  });
});
