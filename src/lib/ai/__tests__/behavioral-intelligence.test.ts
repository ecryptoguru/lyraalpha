import { describe, it, expect } from "vitest";
import {
  analyzeBehavioralPatterns,
  buildBehaviorProfile,
  getMentoringMessage,
} from "../behavioral-intelligence";

describe("Behavioral Intelligence Layer", () => {
  describe("analyzeBehavioralPatterns", () => {
    it("should detect concentration risk", () => {
      const queries = [
        { assetSymbol: "AAPL", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "AAPL", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "AAPL", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "AAPL", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "MSFT", assetType: "STOCK", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const concentrationPattern = patterns.find((p) => p.pattern === "CONCENTRATION_RISK");

      expect(concentrationPattern).toBeDefined();
      expect(concentrationPattern?.severity).toBe("high");
      expect(concentrationPattern?.affectedAssets).toContain("AAPL");
    });

    it("should detect volatility seeking behavior", () => {
      const queries = [
        { assetSymbol: "TSLA", volatility: 85, timestamp: new Date() },
        { assetSymbol: "GME", volatility: 90, timestamp: new Date() },
        { assetSymbol: "AMC", volatility: 88, timestamp: new Date() },
        { assetSymbol: "NVDA", volatility: 75, timestamp: new Date() },
        { assetSymbol: "COIN", volatility: 92, timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const volatilityPattern = patterns.find((p) => p.pattern === "VOLATILITY_SEEKING");

      expect(volatilityPattern).toBeDefined();
      expect(volatilityPattern?.severity).toBe("high");
    });

    it("should detect FOMO pattern from rapid queries", () => {
      const now = Date.now();
      const queries = [
        { assetSymbol: "BTC", timestamp: new Date(now) },
        { assetSymbol: "ETH", timestamp: new Date(now + 2 * 60 * 1000) },
        { assetSymbol: "SOL", timestamp: new Date(now + 3 * 60 * 1000) },
        { assetSymbol: "AVAX", timestamp: new Date(now + 5 * 60 * 1000) },
        { assetSymbol: "MATIC", timestamp: new Date(now + 6 * 60 * 1000) },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const fomoPattern = patterns.find((p) => p.pattern === "FOMO_PATTERN");

      expect(fomoPattern).toBeDefined();
      expect(fomoPattern?.severity).toBe("moderate");
    });

    it("should detect healthy diversification", () => {
      const queries = [
        { assetSymbol: "AAPL", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "BTC", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "SPY", assetType: "ETF", timestamp: new Date() },
        { assetSymbol: "MSFT", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "ETH", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "QQQ", assetType: "ETF", timestamp: new Date() },
        { assetSymbol: "GOOGL", assetType: "STOCK", timestamp: new Date() },
        { assetSymbol: "AMZN", assetType: "STOCK", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const healthyPattern = patterns.find((p) => p.pattern === "DIVERSIFICATION_HEALTHY");

      expect(healthyPattern).toBeDefined();
      expect(healthyPattern?.severity).toBe("low");
    });

    it("should return empty array for insufficient data", () => {
      const queries = [
        { assetSymbol: "AAPL", timestamp: new Date() },
        { assetSymbol: "MSFT", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);

      expect(patterns).toEqual([]);
    });
  });

  describe("buildBehaviorProfile", () => {
    it("should build complete behavior profile", () => {
      const queries = [
        { assetSymbol: "AAPL", assetType: "STOCK", volatility: 60, timestamp: new Date() },
        { assetSymbol: "AAPL", assetType: "STOCK", volatility: 65, timestamp: new Date() },
        { assetSymbol: "BTC", assetType: "CRYPTO", volatility: 85, timestamp: new Date() },
        { assetSymbol: "SPY", assetType: "ETF", volatility: 40, timestamp: new Date() },
        { assetSymbol: "MSFT", assetType: "STOCK", volatility: 55, timestamp: new Date() },
      ];

      const profile = buildBehaviorProfile("user123", queries);

      expect(profile.userId).toBe("user123");
      expect(profile.queryCount).toBe(5);
      expect(profile.assetInterest.get("AAPL")).toBe(2);
      expect(profile.assetTypeDistribution.STOCK).toBe(3);
      expect(profile.volatilityPreference).toBeGreaterThan(0);
      expect(profile.patterns.length).toBeGreaterThan(0);
    });

    it("should calculate volatility preference correctly", () => {
      const queries = [
        { assetSymbol: "AAPL", volatility: 50, timestamp: new Date() },
        { assetSymbol: "MSFT", volatility: 60, timestamp: new Date() },
        { assetSymbol: "GOOGL", volatility: 70, timestamp: new Date() },
        { assetSymbol: "AMZN", volatility: 80, timestamp: new Date() },
        { assetSymbol: "TSLA", volatility: 90, timestamp: new Date() },
      ];

      const profile = buildBehaviorProfile("user123", queries);

      expect(profile.volatilityPreference).toBe(70); // Average of 50,60,70,80,90
    });
  });

  describe("getMentoringMessage", () => {
    it("should prioritize high severity insights", () => {
      const insights = [
        {
          pattern: "CONCENTRATION_RISK" as const,
          severity: "high" as const,
          description: "80% focused on one asset",
          recommendation: "Diversify",
          affectedAssets: ["AAPL"],
        },
        {
          pattern: "VOLATILITY_SEEKING" as const,
          severity: "moderate" as const,
          description: "High volatility preference",
          recommendation: "Balance risk",
          affectedAssets: [],
        },
      ];

      const message = getMentoringMessage(insights);

      expect(message).toContain("CONCENTRATION RISK");
      expect(message).toContain("⚠️");
    });

    it("should show moderate insights when no high severity", () => {
      const insights = [
        {
          pattern: "RECENCY_BIAS" as const,
          severity: "moderate" as const,
          description: "Focused on recent assets",
          recommendation: "Review full watchlist",
          affectedAssets: [],
        },
      ];

      const message = getMentoringMessage(insights);

      expect(message).toContain("💡");
      expect(message).toContain("Focused on recent assets");
    });

    it("should show positive message for healthy patterns", () => {
      const insights = [
        {
          pattern: "DIVERSIFICATION_HEALTHY" as const,
          severity: "low" as const,
          description: "Healthy diversification",
          recommendation: "Continue",
          affectedAssets: [],
        },
      ];

      const message = getMentoringMessage(insights);

      expect(message).toContain("✅");
      expect(message).toContain("Healthy diversification");
    });

    it("should return null when no insights", () => {
      const message = getMentoringMessage([]);

      expect(message).toBeNull();
    });
  });
});
