import { describe, it, expect } from "vitest";
import {
  calculateAssetFragility,
  computeBatchFragility,
  type ScoreMap,
} from "../asset-fragility";

describe("Asset Fragility Score", () => {
  describe("calculateAssetFragility", () => {
    it("should calculate LOW fragility for stable asset", () => {
      const scores: ScoreMap = {
        volatility: 20,
        liquidity: 80,
        momentum: 70,
        trend: 75,
      };

      const result = calculateAssetFragility(scores);

      expect(result.level).toBe("LOW");
      expect(result.score).toBeLessThan(30);
      expect(result.drivers).toHaveLength(0);
    });

    it("should calculate CRITICAL fragility for vulnerable asset", () => {
      const scores: ScoreMap = {
        volatility: 90,
        liquidity: 15,
        momentum: 20,
        trend: 25,
      };

      const result = calculateAssetFragility(scores);

      expect(result.level).toBe("CRITICAL");
      expect(result.score).toBeGreaterThan(75);
      expect(result.drivers.length).toBeGreaterThan(0);
    });

    it("should handle missing scores with defaults", () => {
      const scores: ScoreMap = {};

      const result = calculateAssetFragility(scores);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.level).toBeDefined();
    });

    it("should incorporate correlation convergence", () => {
      const scores: ScoreMap = {
        volatility: 50,
        liquidity: 50,
        momentum: 50,
        trend: 50,
      };

      const withHighCorr = calculateAssetFragility(scores, {
        correlationMetrics: { avgCorrelation: 0.9 },
      });

      const withLowCorr = calculateAssetFragility(scores, {
        correlationMetrics: { avgCorrelation: 0.2 },
      });

      expect(withHighCorr.score).toBeGreaterThan(withLowCorr.score);
      expect(withHighCorr.components.correlationConvergence).toBeCloseTo(90);
      expect(withLowCorr.components.correlationConvergence).toBeCloseTo(20);
    });

    it("should identify correct drivers", () => {
      const scores: ScoreMap = {
        volatility: 85,
        liquidity: 20,
        momentum: 50,
        trend: 50,
      };

      const result = calculateAssetFragility(scores);

      expect(result.drivers).toContain("High volatility");
      expect(result.drivers).toContain("Liquidity constraints");
    });

    it("should compute correct component weights", () => {
      const scores: ScoreMap = {
        volatility: 100,
        liquidity: 0,
        momentum: 0,
        trend: 0,
      };

      const result = calculateAssetFragility(scores);

      // With all components at max fragility:
      // vol: 100 * 0.30 = 30
      // liq: 100 * 0.25 = 25
      // corr: 50 * 0.25 = 12.5 (default 0.5)
      // factor: 100 * 0.20 = 20
      // Total ≈ 87.5
      expect(result.score).toBeGreaterThan(80);
      expect(result.score).toBeLessThan(95);
    });

    it("should generate appropriate explanations", () => {
      const lowFragility = calculateAssetFragility({
        volatility: 20,
        liquidity: 80,
        momentum: 70,
        trend: 75,
      });

      const criticalFragility = calculateAssetFragility({
        volatility: 90,
        liquidity: 10,
        momentum: 15,
        trend: 20,
      });

      expect(lowFragility.explanation).toContain("resilience");
      expect(criticalFragility.explanation).toContain("Critical");
    });
  });

  describe("computeBatchFragility", () => {
    it("should compute fragility for multiple assets", () => {
      const assets = [
        {
          symbol: "AAPL",
          scores: { volatility: 30, liquidity: 70, momentum: 65, trend: 70 },
        },
        {
          symbol: "TSLA",
          scores: { volatility: 85, liquidity: 40, momentum: 55, trend: 50 },
        },
        {
          symbol: "BTC",
          scores: null,
        },
      ];

      const results = computeBatchFragility(assets);

      expect(results.size).toBe(2);
      expect(results.get("AAPL")).toBeDefined();
      expect(results.get("TSLA")).toBeDefined();
      expect(results.get("BTC")).toBeUndefined();
      expect(results.get("AAPL")!.score).toBeLessThan(55);
      expect(results.get("TSLA")!.score).toBeGreaterThan(45);
    });

    it("should skip assets with null scores", () => {
      const assets = [
        { symbol: "A", scores: null },
        { symbol: "B", scores: { volatility: 50 } },
      ];

      const results = computeBatchFragility(assets);

      expect(results.size).toBe(1);
      expect(results.has("B")).toBe(true);
    });
  });
});
