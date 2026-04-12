import { describe, it, expect, beforeEach } from "vitest";
import { 
  calculateTrendScore,
} from "../trend";
import { 
  calculateMomentumScore,
} from "../momentum";
import { 
  calculateVolatilityScore,
} from "../volatility";
import { 
  calculateSentimentScore,
} from "../sentiment";
import { OHLCV } from "../types";

describe("Engines Integration Tests", () => {
  const mockOHLCV: OHLCV[] = [
    { date: "2024-01-01", open: 100, high: 105, low: 95, close: 102, volume: 1000000 },
    { date: "2024-01-02", open: 102, high: 108, low: 98, close: 107, volume: 1200000 },
    { date: "2024-01-03", open: 107, high: 110, low: 103, close: 105, volume: 900000 },
    { date: "2024-01-04", open: 105, high: 112, low: 100, close: 110, volume: 1500000 },
    { date: "2024-01-05", open: 110, high: 115, low: 108, close: 108, volume: 800000 },
    // Extended dataset for comprehensive testing
    ...Array.from({ length: 195 }, (_, i) => ({
      date: `2024-01-${String(6 + i).padStart(2, "0")}`,
      open: 100 + i * 0.1 + Math.sin(i * 0.1) * 2,
      high: 105 + i * 0.1 + Math.sin(i * 0.1) * 2 + 3,
      low: 95 + i * 0.1 + Math.sin(i * 0.1) * 2 - 3,
      close: 102 + i * 0.1 + Math.sin(i * 0.1) * 2,
      volume: 1000000 + Math.random() * 500000,
    })),
  ];

  beforeEach(() => {
    // Reset any global state if needed
  });

  describe("Engine Consistency", () => {
    it("all engines return valid score ranges", () => {
      const trend = calculateTrendScore(mockOHLCV);
      const momentum = calculateMomentumScore(mockOHLCV);
      const volatility = calculateVolatilityScore(mockOHLCV, "CRYPTO");
      const sentiment = calculateSentimentScore(mockOHLCV);

      // All scores should be 0-100
      [trend, momentum, volatility, sentiment].forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });

      // All should have valid directions
      [trend, momentum, volatility, sentiment].forEach(result => {
        expect(["UP", "DOWN", "FLAT", "NEUTRAL"]).toContain(result.direction);
      });

      // All should have context
      [trend, momentum, volatility, sentiment].forEach(result => {
        expect(result.context).toBeDefined();
        expect(typeof result.context).toBe("string");
      });
    });

    it("engines handle insufficient data consistently", () => {
      const shortData = mockOHLCV.slice(0, 5);
      
      const trend = calculateTrendScore(shortData);
      const momentum = calculateMomentumScore(shortData);
      const volatility = calculateVolatilityScore(shortData, "CRYPTO");
      const sentiment = calculateSentimentScore(shortData);

      // All should return neutral for insufficient data
      [trend, momentum, volatility, sentiment].forEach(result => {
        expect(result.score).toBe(50);
        expect(result.direction).toBe("NEUTRAL");
        // Context varies by engine - just check it's not empty
        expect(result.context).toBeDefined();
        expect(result.context.length).toBeGreaterThan(0);
      });
    });

    it("engines return deterministic results", () => {
      const trend1 = calculateTrendScore(mockOHLCV);
      const trend2 = calculateTrendScore(mockOHLCV);
      
      const momentum1 = calculateMomentumScore(mockOHLCV);
      const momentum2 = calculateMomentumScore(mockOHLCV);
      
      const volatility1 = calculateVolatilityScore(mockOHLCV, "CRYPTO");
      const volatility2 = calculateVolatilityScore(mockOHLCV, "CRYPTO");
      
      const sentiment1 = calculateSentimentScore(mockOHLCV);
      const sentiment2 = calculateSentimentScore(mockOHLCV);

      expect(trend1.score).toBe(trend2.score);
      expect(momentum1.score).toBe(momentum2.score);
      expect(volatility1.score).toBe(volatility2.score);
      expect(sentiment1.score).toBe(sentiment2.score);
    });
  });

  describe("Cross-Engine Relationships", () => {
    it("trend and momentum show reasonable correlation", () => {
      const trend = calculateTrendScore(mockOHLCV);
      const momentum = calculateMomentumScore(mockOHLCV);

      // In an uptrend, momentum should generally be positive
      // This is a loose test - real markets are complex
      if (trend.direction === "UP" && trend.score > 60) {
        // We expect momentum to not be strongly bearish in a strong uptrend
        expect(momentum.score).toBeGreaterThan(30);
      }
    });

    it("volatility and sentiment have independent logic", () => {
      const volatility = calculateVolatilityScore(mockOHLCV, "CRYPTO");
      const sentiment = calculateSentimentScore(mockOHLCV);

      // These should be independent - no specific correlation expected
      // Just ensure both work with the same data
      expect(volatility.metadata).toBeDefined();
      expect(sentiment.metadata).toBeDefined();
    });
  });

  describe("Metadata Consistency", () => {
    it("all engines provide relevant metadata", () => {
      const trend = calculateTrendScore(mockOHLCV);
      const momentum = calculateMomentumScore(mockOHLCV);
      const volatility = calculateVolatilityScore(mockOHLCV, "CRYPTO");
      const sentiment = calculateSentimentScore(mockOHLCV);

      // Trend metadata
      expect(trend.metadata).toHaveProperty("price");
      expect(trend.metadata).toHaveProperty("sma200");
      expect(trend.metadata).toHaveProperty("sma50");
      expect(trend.metadata).toHaveProperty("breakdown");

      // Momentum metadata
      expect(momentum.metadata).toHaveProperty("rsi");
      expect(momentum.metadata).toHaveProperty("macdHistogram");
      expect(momentum.metadata).toHaveProperty("roc");

      // Volatility metadata
      expect(volatility.metadata).toHaveProperty("natr");
      expect(volatility.metadata).toHaveProperty("natrScore");
      expect(volatility.metadata).toHaveProperty("bbScore");
      expect(volatility.metadata).toHaveProperty("regimeScore");
      expect(volatility.metadata).toHaveProperty("assetType");

      // Sentiment metadata - only check if not fallback
      if (sentiment.metadata?.method !== "fallback") {
        expect(sentiment.metadata).toHaveProperty("obvScore");
        expect(sentiment.metadata).toHaveProperty("divScore");
        expect(sentiment.metadata).toHaveProperty("pressureScore");
        expect(sentiment.metadata).toHaveProperty("volTrendScore");
      }
    });
  });

  describe("Asset Type Handling", () => {
    it("volatility engine handles crypto asset type", () => {
      const cryptoVol = calculateVolatilityScore(mockOHLCV, "CRYPTO");

      expect(cryptoVol.metadata?.assetType).toBe("CRYPTO");

      // Score should be in valid range
      expect(cryptoVol.score).toBeGreaterThanOrEqual(0);
      expect(cryptoVol.score).toBeLessThanOrEqual(100);
    });
  });
});
