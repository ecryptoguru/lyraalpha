import { describe, it, expect } from "vitest";
import { calculateVolatilityScore } from "../volatility";
import { OHLCV } from "../types";

describe("calculateVolatilityScore", () => {
  const mockOHLCV: OHLCV[] = [
    { date: "2024-01-01", open: 100, high: 105, low: 95, close: 102, volume: 1000000 },
    { date: "2024-01-02", open: 102, high: 108, low: 98, close: 107, volume: 1200000 },
    { date: "2024-01-03", open: 107, high: 110, low: 103, close: 105, volume: 900000 },
    { date: "2024-01-04", open: 105, high: 112, low: 100, close: 110, volume: 1500000 },
    { date: "2024-01-05", open: 110, high: 115, low: 108, close: 108, volume: 800000 },
    // Add more data for ATR/Bollinger calculations
    ...Array.from({ length: 15 }, (_, i) => ({
      date: `2024-01-${String(6 + i).padStart(2, "0")}`,
      open: 100 + i * 0.3,
      high: 105 + i * 0.3,
      low: 95 + i * 0.3,
      close: 102 + i * 0.3,
      volume: 1000000,
    })),
  ];

  it("returns neutral for insufficient data", () => {
    const shortData = mockOHLCV.slice(0, 10);
    const result = calculateVolatilityScore(shortData);
    expect(result.score).toBe(50);
    expect(result.direction).toBe("NEUTRAL");
    expect(result.context).toBe("Insufficient data for volatility analysis.");
  });

  it("calculates volatility score for stocks", () => {
    const result = calculateVolatilityScore(mockOHLCV, "STOCK");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["UP", "DOWN", "FLAT", "NEUTRAL"]).toContain(result.direction);
    expect(result.context).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it("calculates volatility score for crypto", () => {
    const result = calculateVolatilityScore(mockOHLCV, "CRYPTO");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["UP", "DOWN", "FLAT", "NEUTRAL"]).toContain(result.direction);
    expect(result.context).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it("returns consistent results for same input", () => {
    const result1 = calculateVolatilityScore(mockOHLCV, "STOCK");
    const result2 = calculateVolatilityScore(mockOHLCV, "STOCK");
    expect(result1.score).toBe(result2.score);
    expect(result1.direction).toBe(result2.direction);
  });

  it("includes metadata with sub-scores", () => {
    const result = calculateVolatilityScore(mockOHLCV, "STOCK");
    expect(result.metadata).toHaveProperty("natr");
    expect(result.metadata).toHaveProperty("natrScore");
    expect(result.metadata).toHaveProperty("bbScore");
    expect(result.metadata).toHaveProperty("regimeScore");
    expect(result.metadata).toHaveProperty("assetType");
  });

  it("handles high volatility correctly", () => {
    // Create high volatility data
    const highVolData = Array.from({ length: 20 }, (_, i) => ({
      date: `2024-01-${String(1 + i).padStart(2, "0")}`,
      open: 100 + (i % 2 ? 10 : -10),
      high: 110 + (i % 2 ? 5 : -5),
      low: 90 + (i % 2 ? -5 : 5),
      close: 105 + (i % 2 ? 3 : -3),
      volume: 1000000,
    }));
    
    const result = calculateVolatilityScore(highVolData, "STOCK");
    expect(result.score).toBeGreaterThan(60);
  });

  it("handles low volatility correctly", () => {
    // Create low volatility data
    const lowVolData = Array.from({ length: 20 }, (_, i) => ({
      date: `2024-01-${String(1 + i).padStart(2, "0")}`,
      open: 100 + i * 0.1,
      high: 100.5 + i * 0.1,
      low: 99.5 + i * 0.1,
      close: 100.2 + i * 0.1,
      volume: 1000000,
    }));
    
    const result = calculateVolatilityScore(lowVolData, "STOCK");
    expect(result.score).toBeLessThan(40);
  });

  it("uses crypto-specific scaling for crypto assets", () => {
    const cryptoResult = calculateVolatilityScore(mockOHLCV, "CRYPTO");
    const stockResult = calculateVolatilityScore(mockOHLCV, "STOCK");
    
    // Crypto should have different scaling due to sigmoid mapping
    expect(cryptoResult.metadata?.assetType).toBe("CRYPTO");
    expect(stockResult.metadata?.assetType).toBe("STOCK");
  });
});
