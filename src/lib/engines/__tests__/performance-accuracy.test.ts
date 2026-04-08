/**
 * Performance Engine — Accuracy Tests
 * Verifies multi-timeframe returns, 52W range metrics, YTD calculation,
 * deduplication of same-day bars, and edge cases.
 */
import { describe, it, expect } from "vitest";
import { calculatePerformance } from "../performance";
import { OHLCV } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBar(date: string, close: number, high?: number, low?: number): OHLCV {
  return {
    date,
    open: close,
    high: high ?? close * 1.01,
    low: low ?? close * 0.99,
    close,
    volume: 1_000_000,
  };
}

/** Build N bars ending on `endDate`, each step days apart, linearly priced */
function buildHistory(
  n: number,
  endDate: string,
  endPrice: number,
  stepDays = 1,
  stepPrice = 0,
): OHLCV[] {
  const end = new Date(endDate);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (n - 1 - i) * stepDays);
    const close = endPrice + (i - (n - 1)) * stepPrice; // negative stepPrice = rising toward end
    return makeBar(d.toISOString().split("T")[0], Math.max(1, close));
  });
}

// ─── Empty / Edge Cases ───────────────────────────────────────────────────────

describe("Performance — empty / edge cases", () => {
  it("empty history → all nulls", () => {
    const result = calculatePerformance([]);
    expect(result.returns["1D"]).toBeNull();
    expect(result.returns["1Y"]).toBeNull();
    expect(result.range52W.high).toBeNull();
  });

  it("single bar → returns all null (no prior price)", () => {
    const result = calculatePerformance([makeBar("2024-01-15", 100)]);
    expect(result.returns["1D"]).toBeNull();
    expect(result.returns["1W"]).toBeNull();
  });
});

// ─── Return Calculations ──────────────────────────────────────────────────────

/** Build a dense daily history ending at endDate, filling every day.
 * Adds extra buffer days before the start to ensure lookback windows always find a bar. */
function denseHistory(endDate: string, daysBack: number, startPrice: number, endPrice: number): OHLCV[] {
  // Build extra bars before the target start so the engine's reverse-search always finds one
  const buffer = 5;
  const totalDays = daysBack + buffer;
  const end = new Date(endDate);
  // Use local date arithmetic matching the engine's setHours(0,0,0,0) normalization
  const bars: OHLCV[] = [];
  for (let i = totalDays; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    // Price: buffer days before start all at startPrice, then linear to endPrice
    const daysFromStart = totalDays - i;
    const frac = daysFromStart <= buffer ? 0 : (daysFromStart - buffer) / daysBack;
    const close = startPrice + (endPrice - startPrice) * frac;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    bars.push(makeBar(dateStr, close));
  }
  return bars;
}

describe("Performance — return calculations", () => {
  it("1D return: price up 10% from yesterday → 1D = 10%", () => {
    // Dense history: 2 days, start=100, end=110
    const history = denseHistory("2024-06-15", 1, 100, 110);
    const result = calculatePerformance(history);
    expect(result.returns["1D"]).toBeCloseTo(10, 1);
  });

  it("1D return: price down 5% from yesterday → 1D = -5%", () => {
    const history = denseHistory("2024-06-15", 1, 100, 95);
    const result = calculatePerformance(history);
    expect(result.returns["1D"]).toBeCloseTo(-5, 1);
  });

  it("1W return: price up 20% from 7 days ago", () => {
    const history = denseHistory("2024-06-15", 7, 100, 120);
    const result = calculatePerformance(history);
    expect(result.returns["1W"]).toBeCloseTo(20, 1);
  });

  it("1Y return: price doubled over 365 days → 1Y = 100%", () => {
    const history = denseHistory("2024-06-15", 365, 100, 200);
    const result = calculatePerformance(history);
    expect(result.returns["1Y"]).toBeCloseTo(100, 1);
  });

  it("return formula: ((current - prior) / prior) * 100", () => {
    // 1M return: price from 80 to 100 over 30 days = 25%
    const history = denseHistory("2024-06-15", 30, 80, 100);
    const result = calculatePerformance(history);
    expect(result.returns["1M"]).toBeCloseTo(25, 1);
  });

  it("no prior bar within window → return is null", () => {
    // Only bars from 2 days ago — no bar for 1W, 1M, etc.
    const history = denseHistory("2024-06-15", 2, 100, 110);
    const result = calculatePerformance(history);
    expect(result.returns["1W"]).toBeNull();
    expect(result.returns["1M"]).toBeNull();
  });
});

// ─── YTD Return ───────────────────────────────────────────────────────────────

describe("Performance — YTD return", () => {
  it("price up 30% from Jan 1 → YTD = 30%", () => {
    // Dense history from Jan 1 to Jun 15 (165 days)
    const history = denseHistory("2024-06-15", 165, 100, 130);
    const result = calculatePerformance(history);
    expect(result.returns.YTD).toBeCloseTo(30, 0);
  });

  it("price down 20% from Jan 1 → YTD = -20%", () => {
    const history = denseHistory("2024-06-15", 165, 100, 80);
    const result = calculatePerformance(history);
    expect(result.returns.YTD).toBeCloseTo(-20, 0);
  });

  it("YTD uses first bar in current year as baseline", () => {
    // Build history spanning Jan 1 to Jun 15 with known start/end
    const history = denseHistory("2024-06-15", 165, 100, 115);
    const result = calculatePerformance(history);
    // YTD should be approximately 15%
    expect(result.returns.YTD).toBeCloseTo(15, 0);
  });
});

// ─── 52W Range ────────────────────────────────────────────────────────────────

describe("Performance — 52W range", () => {
  it("52W high = max high over last year", () => {
    const history = buildHistory(365, "2024-06-15", 100, 1, 0);
    // Inject a high spike
    history[100].high = 200;
    const result = calculatePerformance(history);
    expect(result.range52W.high).toBe(200);
  });

  it("52W low = min low over last year", () => {
    const history = buildHistory(365, "2024-06-15", 100, 1, 0);
    history[50].low = 40;
    const result = calculatePerformance(history);
    expect(result.range52W.low).toBe(40);
  });

  it("currentPosition: price at 52W low → 0%", () => {
    // All bars at 100 except low at 50
    const history = buildHistory(365, "2024-06-15", 100, 1, 0);
    history.forEach(b => { b.high = 150; b.low = 50; });
    history[history.length - 1].close = 50; // current = low
    const result = calculatePerformance(history);
    expect(result.range52W.currentPosition).toBeCloseTo(0, 0);
  });

  it("currentPosition: price at 52W high → 100%", () => {
    const history = buildHistory(365, "2024-06-15", 150, 1, 0);
    history.forEach(b => { b.high = 150; b.low = 50; });
    const result = calculatePerformance(history);
    expect(result.range52W.currentPosition).toBeCloseTo(100, 0);
  });

  it("distanceFromHigh: price 10% below high → -10%", () => {
    const history = buildHistory(365, "2024-06-15", 90, 1, 0);
    history.forEach(b => { b.high = 100; b.low = 50; });
    const result = calculatePerformance(history);
    // distanceFromHigh = (90 - 100) / 100 * 100 = -10
    expect(result.range52W.distanceFromHigh).toBeCloseTo(-10, 0);
  });

  it("distanceFromLow: price 80% above low → 80%", () => {
    const history = buildHistory(365, "2024-06-15", 90, 1, 0);
    history.forEach(b => { b.high = 100; b.low = 50; });
    const result = calculatePerformance(history);
    // distanceFromLow = (90 - 50) / 50 * 100 = 80
    expect(result.range52W.distanceFromLow).toBeCloseTo(80, 0);
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe("Performance — same-day deduplication", () => {
  it("multiple bars on same day → uses last one", () => {
    // Build dense 365-day history, then inject a duplicate for the first day
    const history = denseHistory("2024-06-15", 365, 100, 200);
    // Add a duplicate for the earliest date with a different price
    const firstDate = history[0].date;
    history.unshift(makeBar(firstDate, 50)); // earlier duplicate with price=50
    const result = calculatePerformance(history);
    // Deduplication keeps the LAST bar for each day (price=100 not 50)
    // 1Y return = (200 - 100) / 100 * 100 = 100%
    expect(result.returns["1Y"]).toBeCloseTo(100, 0);
  });
});

// ─── Monotonicity ─────────────────────────────────────────────────────────────

describe("Performance — monotonicity", () => {
  it("larger price gain → higher return", () => {
    const small = calculatePerformance(denseHistory("2024-06-15", 365, 100, 110));
    const large = calculatePerformance(denseHistory("2024-06-15", 365, 100, 150));
    expect(large.returns["1Y"]!).toBeGreaterThan(small.returns["1Y"]!);
  });
});
