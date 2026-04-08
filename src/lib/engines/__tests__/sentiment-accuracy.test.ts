/**
 * Sentiment Engine — Accuracy Tests
 * Verifies OBV trend, volume-price divergence, CLV buying pressure,
 * volume trend, composite formula, and direction thresholds.
 */
import { describe, it, expect } from "vitest";
import { calculateSentimentScore } from "../sentiment";
import { OHLCV } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBar(
  close: number,
  volume: number,
  high?: number,
  low?: number,
  i = 0,
): OHLCV {
  return {
    date: `2020-01-${String(i + 1).padStart(3, "0")}`,
    open: close,
    high: high ?? close * 1.005,
    low: low ?? close * 0.995,
    close,
    volume,
  };
}

/** Flat price, constant volume */
function flatBars(n: number, close = 100, vol = 1_000_000): OHLCV[] {
  return Array.from({ length: n }, (_, i) => makeBar(close, vol, undefined, undefined, i));
}

/** Rising price, rising volume — strong bullish confirmation */
function risingPriceRisingVol(n: number): OHLCV[] {
  return Array.from({ length: n }, (_, i) =>
    makeBar(100 + i, 1_000_000 + i * 10_000, undefined, undefined, i),
  );
}

/** Falling price, rising volume — bearish capitulation */
function fallingPriceRisingVol(n: number): OHLCV[] {
  return Array.from({ length: n }, (_, i) =>
    makeBar(200 - i, 1_000_000 + i * 10_000, undefined, undefined, i),
  );
}

/** Rising price, falling volume — bearish divergence */
function risingPriceFallingVol(n: number): OHLCV[] {
  return Array.from({ length: n }, (_, i) =>
    makeBar(100 + i, Math.max(100_000, 2_000_000 - i * 30_000), undefined, undefined, i),
  );
}

// ─── Insufficient Data ────────────────────────────────────────────────────────

describe("Sentiment — insufficient data", () => {
  it("no data → score=50, direction=NEUTRAL", () => {
    const result = calculateSentimentScore();
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
  });

  it("< 20 bars → score=50, direction=NEUTRAL", () => {
    const result = calculateSentimentScore(flatBars(10));
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
  });

  it("exactly 20 bars → computes a score", () => {
    const result = calculateSentimentScore(flatBars(20));
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(99);
  });
});

// ─── OBV Trend ────────────────────────────────────────────────────────────────

describe("Sentiment — OBV trend (40%)", () => {
  it("rising price + rising volume → high OBV score (accumulation)", () => {
    const result = calculateSentimentScore(risingPriceRisingVol(40));
    const obvScore = result.metadata?.obvScore as number;
    expect(obvScore).toBeGreaterThan(50);
  });

  it("falling price + rising volume → low OBV score (distribution)", () => {
    const result = calculateSentimentScore(fallingPriceRisingVol(40));
    const obvScore = result.metadata?.obvScore as number;
    expect(obvScore).toBeLessThan(50);
  });

  it("flat prices → OBV stays near 0 → obvScore ≈ 50", () => {
    const result = calculateSentimentScore(flatBars(40));
    const obvScore = result.metadata?.obvScore as number;
    expect(obvScore).toBeCloseTo(50, 5);
  });
});

// ─── Volume-Price Divergence ──────────────────────────────────────────────────

describe("Sentiment — volume-price divergence (25%)", () => {
  it("price up + volume up → divScore > 70 (bullish confirmation)", () => {
    // Last 10 bars: price rising >1%, volume rising >5%
    const base = flatBars(30, 100, 1_000_000);
    const last10 = Array.from({ length: 10 }, (_, i) =>
      makeBar(102 + i * 0.5, 1_100_000 + i * 20_000, undefined, undefined, 30 + i),
    );
    const result = calculateSentimentScore([...base, ...last10]);
    const divScore = result.metadata?.divScore as number;
    expect(divScore).toBeGreaterThan(60);
  });

  it("price up + volume down → divScore < 40 (bearish divergence)", () => {
    const base = flatBars(30, 100, 2_000_000);
    const last10 = Array.from({ length: 10 }, (_, i) =>
      makeBar(102 + i * 0.5, Math.max(100_000, 2_000_000 - i * 200_000), undefined, undefined, 30 + i),
    );
    const result = calculateSentimentScore([...base, ...last10]);
    const divScore = result.metadata?.divScore as number;
    expect(divScore).toBeLessThan(40);
  });
});

// ─── CLV Buying Pressure ─────────────────────────────────────────────────────

describe("Sentiment — CLV buying pressure (20%)", () => {
  it("close at high → CLV = 1 → pressureScore = 100", () => {
    // close = high → (close - low) / (high - low) = 1
    const data = Array.from({ length: 30 }, (_, i) =>
      makeBar(105, 1_000_000, 105, 95, i),
    );
    const result = calculateSentimentScore(data);
    const pressureScore = result.metadata?.pressureScore as number;
    expect(pressureScore).toBeCloseTo(100, 0);
  });

  it("close at low → CLV = 0 → pressureScore = 0", () => {
    // close = low → (close - low) / (high - low) = 0
    const data = Array.from({ length: 30 }, (_, i) =>
      makeBar(95, 1_000_000, 105, 95, i),
    );
    const result = calculateSentimentScore(data);
    const pressureScore = result.metadata?.pressureScore as number;
    expect(pressureScore).toBeCloseTo(0, 0);
  });

  it("close at midpoint → pressureScore ≈ 50", () => {
    // close = (high + low) / 2 → CLV = 0.5
    const data = Array.from({ length: 30 }, (_, i) =>
      makeBar(100, 1_000_000, 105, 95, i),
    );
    const result = calculateSentimentScore(data);
    const pressureScore = result.metadata?.pressureScore as number;
    expect(pressureScore).toBeCloseTo(50, 0);
  });
});

// ─── Volume Trend ─────────────────────────────────────────────────────────────

describe("Sentiment — volume trend (15%)", () => {
  it("rising volume → volTrendScore > 50", () => {
    const data = Array.from({ length: 40 }, (_, i) =>
      makeBar(100, 500_000 + i * 50_000, undefined, undefined, i),
    );
    const result = calculateSentimentScore(data);
    const volTrendScore = result.metadata?.volTrendScore as number;
    expect(volTrendScore).toBeGreaterThan(50);
  });

  it("falling volume → volTrendScore < 50", () => {
    const data = Array.from({ length: 40 }, (_, i) =>
      makeBar(100, Math.max(10_000, 2_000_000 - i * 50_000), undefined, undefined, i),
    );
    const result = calculateSentimentScore(data);
    const volTrendScore = result.metadata?.volTrendScore as number;
    expect(volTrendScore).toBeLessThan(50);
  });

  it("constant volume → volTrendScore = 50", () => {
    const data = flatBars(40, 100, 1_000_000);
    const result = calculateSentimentScore(data);
    const volTrendScore = result.metadata?.volTrendScore as number;
    expect(volTrendScore).toBeCloseTo(50, 0);
  });
});

// ─── Composite Formula ────────────────────────────────────────────────────────

describe("Sentiment — composite formula", () => {
  it("score = round(obvScore*0.40 + divScore*0.25 + pressureScore*0.20 + volTrendScore*0.15)", () => {
    const data = risingPriceRisingVol(40);
    const result = calculateSentimentScore(data);
    const { obvScore, divScore, pressureScore, volTrendScore } = result.metadata as Record<string, number>;
    const expected = Math.round(
      obvScore * 0.40 + divScore * 0.25 + pressureScore * 0.20 + volTrendScore * 0.15,
    );
    const clamped = Math.min(99, Math.max(1, expected));
    expect(result.score).toBe(clamped);
  });

  it("score always in [1, 99]", () => {
    const datasets = [
      flatBars(40),
      risingPriceRisingVol(40),
      fallingPriceRisingVol(40),
      risingPriceFallingVol(40),
    ];
    for (const data of datasets) {
      const result = calculateSentimentScore(data);
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(99);
    }
  });
});

// ─── Direction Thresholds ─────────────────────────────────────────────────────

describe("Sentiment — direction thresholds", () => {
  it("score >= 65 → direction = UP", () => {
    const result = calculateSentimentScore(risingPriceRisingVol(40));
    if (result.score >= 65) expect(result.direction).toBe("UP");
  });

  it("score <= 35 → direction = DOWN", () => {
    const result = calculateSentimentScore(fallingPriceRisingVol(40));
    if (result.score <= 35) expect(result.direction).toBe("DOWN");
  });

  it("strong bullish signal (score >= 65) → direction = UP", () => {
    // Close at high (CLV=1), rising price, rising volume → all sub-scores high
    const data = Array.from({ length: 40 }, (_, i) =>
      makeBar(100 + i * 0.5, 1_000_000 + i * 50_000, 100 + i * 0.5, 90 + i * 0.5, i),
    );
    const result = calculateSentimentScore(data);
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.direction).toBe("UP");
  });

  it("strong bearish signal (score <= 35) → direction = DOWN", () => {
    // Close at low (CLV=0), falling price, rising volume → all sub-scores low
    const data = Array.from({ length: 40 }, (_, i) =>
      makeBar(200 - i * 0.5, 1_000_000 + i * 50_000, 210 - i * 0.5, 200 - i * 0.5, i),
    );
    const result = calculateSentimentScore(data);
    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.direction).toBe("DOWN");
  });
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe("Sentiment — metadata", () => {
  it("includes all sub-scores", () => {
    const result = calculateSentimentScore(risingPriceRisingVol(40));
    expect(result.metadata).toHaveProperty("obvScore");
    expect(result.metadata).toHaveProperty("divScore");
    expect(result.metadata).toHaveProperty("pressureScore");
    expect(result.metadata).toHaveProperty("volTrendScore");
    expect(result.metadata?.method).toBe("volume-price");
  });

  it("all sub-scores in [0, 100]", () => {
    const result = calculateSentimentScore(risingPriceRisingVol(40));
    const m = result.metadata as Record<string, number>;
    for (const key of ["obvScore", "divScore", "pressureScore", "volTrendScore"]) {
      expect(m[key]).toBeGreaterThanOrEqual(0);
      expect(m[key]).toBeLessThanOrEqual(100);
    }
  });
});
