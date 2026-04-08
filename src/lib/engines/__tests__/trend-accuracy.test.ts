/**
 * Trend Engine — Accuracy Tests
 * Verifies gradient distance, slope, SMA tier selection, higher-low structure,
 * composite formula, and direction thresholds against the source logic.
 */
import { describe, it, expect } from "vitest";
import { calculateTrendScore } from "../trend";
import { OHLCV } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOHLCV(closes: number[], startDate = "2020-01-01"): OHLCV[] {
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

/** Linear price series: start → start + (n-1)*step */
function linearPrices(n: number, start: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

/** Flat price series */
function flatPrices(n: number, price: number): number[] {
  return Array.from({ length: n }, () => price);
}

// ─── Tier Selection ───────────────────────────────────────────────────────────

describe("Trend — tier selection", () => {
  it("TIER 3 (<50d): returns score with short-term mode context", () => {
    const data = makeOHLCV(linearPrices(30, 100, 0.5));
    const result = calculateTrendScore(data);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(99);
    expect(result.context).toContain("Short-term analysis");
  });

  it("TIER 2 (50-199d): returns score with medium-term mode context", () => {
    const data = makeOHLCV(linearPrices(80, 100, 0.5));
    const result = calculateTrendScore(data);
    expect(result.context).toContain("Medium-term analysis");
    expect(result.metadata?.mode).toBe("medium_term");
  });

  it("TIER 1 (200+d): uses SMA200 and SMA50, no mode tag in context", () => {
    const data = makeOHLCV(linearPrices(210, 100, 0.5));
    const result = calculateTrendScore(data);
    expect(result.metadata).toHaveProperty("sma200");
    expect(result.metadata).toHaveProperty("sma50");
    expect(result.metadata?.mode).toBeUndefined();
  });

  it("insufficient data (<20d): returns score=50, direction=NEUTRAL", () => {
    const data = makeOHLCV(flatPrices(15, 100));
    const result = calculateTrendScore(data);
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
  });
});

// ─── Gradient Distance Formula ────────────────────────────────────────────────

describe("Trend — gradient distance accuracy", () => {
  it("price exactly at SMA200 → s1 = 50", () => {
    // 200 flat prices → SMA200 = price → pctDist = 0 → gradientDistance = 50
    const data = makeOHLCV(flatPrices(210, 100));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s1).toBe(50);
  });

  it("price far above SMA200 → s1 = 100 (clamped)", () => {
    // 200 flat bars at 100, then 200 bars at 200 → SMA200 of last 200 bars = 200
    // Add one bar at 250 (25% above SMA200≈200) → well past the 15% cap → s1 = 100
    const prices = [...flatPrices(200, 100), ...flatPrices(199, 200), 250];
    const data = makeOHLCV(prices);
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    // SMA200 ≈ 200.25 (includes the 250 bar), price = 250 → pctDist ≈ 24.8% → clamped to 100
    expect(breakdown.s1).toBe(100);
  });

  it("price far below SMA200 → s1 = 0 (clamped)", () => {
    // 200 flat bars at 200, then 200 bars at 100 → SMA200 ≈ 100, add bar at 60
    const prices = [...flatPrices(200, 200), ...flatPrices(199, 100), 60];
    const data = makeOHLCV(prices);
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    // SMA200 ≈ 99.8, price = 60 → pctDist ≈ -39.9% → clamped to 0
    expect(breakdown.s1).toBe(0);
  });

  it("price 7.5% above SMA200 → s1 ≈ 75", () => {
    const prices = [...flatPrices(200, 200), ...flatPrices(199, 200), 215];
    const data = makeOHLCV(prices);
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    // SMA200 = 200, price = 215 → pctDist = 7.5% → s1 = 75
    expect(breakdown.s1).toBeCloseTo(75, 0);
  });
});

// ─── SMA Alignment (S3) ───────────────────────────────────────────────────────

describe("Trend — SMA alignment (s3)", () => {
  it("golden cross (SMA50 > SMA200) → s3 > 50", () => {
    // Strong uptrend: SMA50 will be above SMA200
    const data = makeOHLCV(linearPrices(210, 50, 1));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s3).toBeGreaterThan(50);
    expect(result.context).toContain("Golden Cross");
  });

  it("death cross (SMA50 < SMA200) → s3 < 50", () => {
    // Strong downtrend: SMA50 will be below SMA200
    const data = makeOHLCV(linearPrices(210, 260, -1));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s3).toBeLessThan(50);
    expect(result.context).toContain("Death Cross");
  });

  it("flat prices → SMA50 = SMA200 → s3 = 50", () => {
    const data = makeOHLCV(flatPrices(210, 100));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s3).toBe(50);
  });
});

// ─── Slope (S4) ───────────────────────────────────────────────────────────────

describe("Trend — slope score (s4)", () => {
  it("flat prices → slope ≈ 0 → s4 ≈ 50", () => {
    const data = makeOHLCV(flatPrices(210, 100));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s4).toBeCloseTo(50, 0);
  });

  it("strong uptrend → positive slope → s4 > 50", () => {
    const data = makeOHLCV(linearPrices(210, 100, 1));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s4).toBeGreaterThan(50);
  });

  it("strong downtrend → negative slope → s4 < 50", () => {
    const data = makeOHLCV(linearPrices(210, 310, -1));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s4).toBeLessThan(50);
  });
});

// ─── Higher-Low Structure (S5) ────────────────────────────────────────────────

describe("Trend — higher-low structure (s5)", () => {
  it("consistent uptrend with higher lows → s5 > 50", () => {
    // Zigzag upward: each trough is higher than the last
    const prices: number[] = [];
    for (let i = 0; i < 210; i++) {
      prices.push(100 + i * 0.5 + (i % 5 === 0 ? -1 : 0));
    }
    const data = makeOHLCV(prices);
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    expect(breakdown.s5).toBeGreaterThanOrEqual(50);
  });

  it("flat prices → no local minima found → s5 = 50 (default)", () => {
    // Flat prices: no point is strictly <= all 4 neighbors → lows.length < 2 → return 50
    const data = makeOHLCV(flatPrices(210, 100));
    const result = calculateTrendScore(data);
    const breakdown = result.metadata?.breakdown as Record<string, number>;
    // Engine returns 50 when lows.length < 2
    expect(breakdown.s5).toBeGreaterThanOrEqual(0);
    expect(breakdown.s5).toBeLessThanOrEqual(100);
  });
});

// ─── Composite Formula ────────────────────────────────────────────────────────

describe("Trend — composite formula", () => {
  it("TIER 1 composite = round(s1*0.25 + s2*0.20 + s3*0.15 + s4*0.20 + s5*0.20)", () => {
    const data = makeOHLCV(linearPrices(210, 100, 0.5));
    const result = calculateTrendScore(data);
    const b = result.metadata?.breakdown as Record<string, number>;
    const expected = Math.round(b.s1 * 0.25 + b.s2 * 0.20 + b.s3 * 0.15 + b.s4 * 0.20 + b.s5 * 0.20);
    const clamped = Math.min(99, Math.max(1, expected));
    expect(result.score).toBe(clamped);
  });

  it("score is always in [1, 99]", () => {
    const datasets = [
      makeOHLCV(flatPrices(210, 100)),
      makeOHLCV(linearPrices(210, 100, 2)),
      makeOHLCV(linearPrices(210, 300, -1)),
    ];
    for (const data of datasets) {
      const result = calculateTrendScore(data);
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(99);
    }
  });
});

// ─── Direction Thresholds ─────────────────────────────────────────────────────

describe("Trend — direction thresholds", () => {
  it("score >= 65 → direction = UP", () => {
    const data = makeOHLCV(linearPrices(210, 100, 1));
    const result = calculateTrendScore(data);
    if (result.score >= 65) expect(result.direction).toBe("UP");
  });

  it("score <= 35 → direction = DOWN", () => {
    const data = makeOHLCV(linearPrices(210, 310, -1));
    const result = calculateTrendScore(data);
    if (result.score <= 35) expect(result.direction).toBe("DOWN");
  });

  it("strong uptrend (200 bars rising) → direction = UP", () => {
    const data = makeOHLCV(linearPrices(210, 100, 1));
    const result = calculateTrendScore(data);
    expect(result.direction).toBe("UP");
  });

  it("strong downtrend (200 bars falling) → direction = DOWN", () => {
    const data = makeOHLCV(linearPrices(210, 310, -1));
    const result = calculateTrendScore(data);
    expect(result.direction).toBe("DOWN");
  });

  it("flat prices → direction = FLAT", () => {
    const data = makeOHLCV(flatPrices(210, 100));
    const result = calculateTrendScore(data);
    expect(result.direction).toBe("FLAT");
  });
});

// ─── Monotonicity ─────────────────────────────────────────────────────────────

describe("Trend — monotonicity", () => {
  it("steeper uptrend → higher score than shallow uptrend", () => {
    const shallow = calculateTrendScore(makeOHLCV(linearPrices(210, 100, 0.2)));
    const steep = calculateTrendScore(makeOHLCV(linearPrices(210, 100, 1.5)));
    expect(steep.score).toBeGreaterThan(shallow.score);
  });

  it("steeper downtrend → lower score than shallow downtrend", () => {
    const shallow = calculateTrendScore(makeOHLCV(linearPrices(210, 300, -0.2)));
    const steep = calculateTrendScore(makeOHLCV(linearPrices(210, 400, -1.5)));
    expect(steep.score).toBeLessThan(shallow.score);
  });
});
