import { describe, it, expect } from "vitest";
import {
  calculateNarrativeDivergence,
  computeBatchNarrativeDivergence,
  findSignificantDivergences,
} from "../narrative-divergence";

describe("Narrative Divergence Engine", () => {
  describe("calculateNarrativeDivergence", () => {
    it("should detect aligned sentiment", () => {
      const result = calculateNarrativeDivergence(60, 58, 5);

      expect(result.direction).toBe("ALIGNED");
      expect(result.signal).toBe("CONFIRMATION");
      expect(result.divergenceScore).toBeLessThan(15);
    });

    it("should detect bullish divergence", () => {
      const result = calculateNarrativeDivergence(80, 40, 10);

      expect(result.direction).toBe("BULLISH_DIVERGENCE");
      expect(result.divergenceScore).toBeGreaterThan(30);
      expect(result.explanation).toContain("positive");
    });

    it("should detect bearish divergence", () => {
      const result = calculateNarrativeDivergence(30, 70, 8);

      expect(result.direction).toBe("BEARISH_DIVERGENCE");
      expect(result.divergenceScore).toBeGreaterThan(30);
      expect(result.explanation).toContain("negative");
    });

    it("should weight divergence by news volume", () => {
      const lowVolume = calculateNarrativeDivergence(80, 40, 1);
      const highVolume = calculateNarrativeDivergence(80, 40, 10);

      expect(highVolume.divergenceScore).toBeGreaterThan(lowVolume.divergenceScore);
    });

    it("should handle edge cases", () => {
      const result = calculateNarrativeDivergence(0, 100, 5);

      expect(result.divergenceScore).toBeGreaterThan(0);
      expect(result.direction).toBe("BEARISH_DIVERGENCE");
    });

    it("should normalize out-of-range inputs", () => {
      const result = calculateNarrativeDivergence(150, -20, 5);

      expect(result.narrativeStrength).toBe(100);
      expect(result.engineSentiment).toBe(0);
    });
  });

  describe("computeBatchNarrativeDivergence", () => {
    it("should compute divergence for multiple assets", () => {
      const assets = [
        { symbol: "AAPL", mediaSentiment: 70, engineSentiment: 65, newsCount: 5 },
        { symbol: "TSLA", mediaSentiment: 85, engineSentiment: 45, newsCount: 12 },
        { symbol: "MSFT", mediaSentiment: 60, engineSentiment: 62, newsCount: 3 },
      ];

      const results = computeBatchNarrativeDivergence(assets);

      expect(results.size).toBe(3);
      expect(results.get("AAPL")).toBeDefined();
      expect(results.get("TSLA")?.direction).toBe("BULLISH_DIVERGENCE");
      expect(results.get("MSFT")?.direction).toBe("ALIGNED");
    });

    it("should skip assets with missing data", () => {
      const assets = [
        { symbol: "AAPL", mediaSentiment: 70, engineSentiment: 65 },
        { symbol: "TSLA", mediaSentiment: 85 },
        { symbol: "MSFT", engineSentiment: 62 },
      ];

      const results = computeBatchNarrativeDivergence(assets);

      expect(results.size).toBe(1);
      expect(results.has("AAPL")).toBe(true);
    });
  });

  describe("findSignificantDivergences", () => {
    it("should identify assets with high divergence", () => {
      const divergences = new Map();
      divergences.set("AAPL", calculateNarrativeDivergence(70, 68, 5));
      divergences.set("TSLA", calculateNarrativeDivergence(90, 40, 10));
      divergences.set("MSFT", calculateNarrativeDivergence(80, 45, 8));

      const significant = findSignificantDivergences(divergences, 30);

      expect(significant.length).toBeGreaterThan(0);
      expect(significant[0].symbol).toBe("TSLA"); // Highest divergence first
    });

    it("should filter by minimum divergence score", () => {
      const divergences = new Map();
      divergences.set("AAPL", calculateNarrativeDivergence(60, 58, 5));
      divergences.set("TSLA", calculateNarrativeDivergence(90, 40, 10));

      const significant = findSignificantDivergences(divergences, 40);

      expect(significant.length).toBe(1);
      expect(significant[0].symbol).toBe("TSLA");
    });
  });
});
