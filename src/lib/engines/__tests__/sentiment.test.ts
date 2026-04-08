import { describe, it, expect } from "vitest";
import { calculateSentimentScore } from "../sentiment";
import { OHLCV } from "../types";

describe("calculateSentimentScore", () => {
  const mockOHLCV: OHLCV[] = [
    { date: "2024-01-01", open: 100, high: 105, low: 95, close: 102, volume: 1000000 },
    { date: "2024-01-02", open: 102, high: 108, low: 98, close: 107, volume: 1200000 },
    { date: "2024-01-03", open: 107, high: 110, low: 103, close: 105, volume: 900000 },
    { date: "2024-01-04", open: 105, high: 112, low: 100, close: 110, volume: 1500000 },
    { date: "2024-01-05", open: 110, high: 115, low: 108, close: 108, volume: 800000 },
  ];

  it("returns neutral fallback when no OHLCV data provided", () => {
    const result = calculateSentimentScore();
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
    expect(result.context).toBe("Insufficient volume data for sentiment analysis.");
  });

  it("calculates sentiment score with volume-price signals", () => {
    const result = calculateSentimentScore(mockOHLCV);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(result.direction);
    expect(result.context).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it("handles insufficient data gracefully", () => {
    const shortData = mockOHLCV.slice(0, 2);
    const result = calculateSentimentScore(shortData);
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
    expect(result.context).toBe("Insufficient volume data for sentiment analysis.");
  });

  it("returns consistent results for same input", () => {
    const result1 = calculateSentimentScore(mockOHLCV);
    const result2 = calculateSentimentScore(mockOHLCV);
    expect(result1.score).toBe(result2.score);
    expect(result1.direction).toBe(result2.direction);
  });

  it("includes metadata with OBV and volume signals", () => {
    const result = calculateSentimentScore(mockOHLCV);
    // Only check metadata if we have sufficient data
    if (result.metadata?.method !== "fallback") {
      expect(result.metadata).toHaveProperty("obvTrend");
      expect(result.metadata).toHaveProperty("volumePriceDivergence");
      expect(result.metadata).toHaveProperty("buyingPressure");
      expect(result.metadata).toHaveProperty("volumeTrend");
    } else {
      // Fallback case
      expect(result.metadata).toHaveProperty("method");
    }
  });
});
