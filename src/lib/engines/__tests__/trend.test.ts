import { describe, it, expect } from "vitest";
import { calculateTrendScore } from "../trend";
import { OHLCV } from "../types";

describe("calculateTrendScore", () => {
  const mockOHLCV: OHLCV[] = [
    { date: "2024-01-01", open: 100, high: 105, low: 95, close: 102, volume: 1000000 },
    { date: "2024-01-02", open: 102, high: 108, low: 98, close: 107, volume: 1200000 },
    { date: "2024-01-03", open: 107, high: 110, low: 103, close: 105, volume: 900000 },
    { date: "2024-01-04", open: 105, high: 112, low: 100, close: 110, volume: 1500000 },
    { date: "2024-01-05", open: 110, high: 115, low: 108, close: 108, volume: 800000 },
    // Add more data for SMA calculations
    ...Array.from({ length: 195 }, (_, i) => ({
      date: `2024-01-${String(6 + i).padStart(2, "0")}`,
      open: 100 + i * 0.1,
      high: 105 + i * 0.1,
      low: 95 + i * 0.1,
      close: 102 + i * 0.1,
      volume: 1000000,
    })),
  ];

  it("returns neutral for insufficient data", () => {
    const shortData = mockOHLCV.slice(0, 10);
    const result = calculateTrendScore(shortData);
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
    expect(result.context).toBe("Insufficient data for trend analysis (Need > 20 days)");
  });

  it("calculates trend score with gradient signals", () => {
    const result = calculateTrendScore(mockOHLCV);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["UP", "DOWN", "FLAT", "NEUTRAL"]).toContain(result.direction);
    expect(result.context).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it("returns consistent results for same input", () => {
    const result1 = calculateTrendScore(mockOHLCV);
    const result2 = calculateTrendScore(mockOHLCV);
    expect(result1.score).toBe(result2.score);
    expect(result1.direction).toBe(result2.direction);
  });

  it("includes metadata with sub-scores", () => {
    const result = calculateTrendScore(mockOHLCV);
    expect(result.metadata).toBeDefined();
    expect(result.metadata).toHaveProperty("price");
    expect(result.metadata).toHaveProperty("sma200");
    expect(result.metadata).toHaveProperty("sma50");
    expect(result.metadata).toHaveProperty("breakdown");
    if (result.metadata?.breakdown) {
      expect(result.metadata.breakdown).toHaveProperty("s1");
      expect(result.metadata.breakdown).toHaveProperty("s2");
      expect(result.metadata.breakdown).toHaveProperty("s3");
      expect(result.metadata.breakdown).toHaveProperty("s4");
      expect(result.metadata.breakdown).toHaveProperty("s5");
    }
  });

  it("handles bullish trend correctly", () => {
    // Create a strong uptrend
    const bullishData = Array.from({ length: 200 }, (_, i) => ({
      date: `2024-01-${String(1 + i).padStart(2, "0")}`,
      open: 100 + i * 0.5,
      high: 105 + i * 0.5,
      low: 95 + i * 0.5,
      close: 102 + i * 0.5,
      volume: 1000000,
    }));
    
    const result = calculateTrendScore(bullishData);
    expect(result.score).toBeGreaterThan(60);
    expect(result.direction).toBe("UP");
  });

  it("handles bearish trend correctly", () => {
    // Create a strong downtrend
    const bearishData = Array.from({ length: 200 }, (_, i) => ({
      date: `2024-01-${String(1 + i).padStart(2, "0")}`,
      open: 200 - i * 0.5,
      high: 205 - i * 0.5,
      low: 195 - i * 0.5,
      close: 202 - i * 0.5,
      volume: 1000000,
    }));
    
    const result = calculateTrendScore(bearishData);
    expect(result.score).toBeLessThan(40);
    expect(result.direction).toBe("DOWN");
  });
});
