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
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "ETH-USD", assetType: "CRYPTO", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const concentrationPattern = patterns.find((p) => p.pattern === "CONCENTRATION_RISK");

      expect(concentrationPattern).toBeDefined();
      expect(concentrationPattern?.severity).toBe("high");
      expect(concentrationPattern?.affectedAssets).toContain("BTC-USD");
    });

    it("should detect volatility seeking behavior", () => {
      const queries = [
        { assetSymbol: "DOGE-USD", volatility: 85, timestamp: new Date() },
        { assetSymbol: "SHIB-USD", volatility: 90, timestamp: new Date() },
        { assetSymbol: "PEPE-USD", volatility: 88, timestamp: new Date() },
        { assetSymbol: "SOL-USD", volatility: 75, timestamp: new Date() },
        { assetSymbol: "AVAX-USD", volatility: 92, timestamp: new Date() },
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
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "ETH-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "SOL-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "BNB-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "XRP-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "ADA-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "DOGE-USD", assetType: "CRYPTO", timestamp: new Date() },
        { assetSymbol: "AVAX-USD", assetType: "CRYPTO", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const healthyPattern = patterns.find((p) => p.pattern === "DIVERSIFICATION_HEALTHY");

      expect(healthyPattern).toBeDefined();
      expect(healthyPattern?.severity).toBe("low");
    });

    it("should return empty array for insufficient data", () => {
      const queries = [
        { assetSymbol: "BTC-USD", timestamp: new Date() },
        { assetSymbol: "ETH-USD", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);

      expect(patterns).toEqual([]);
    });

    it("BI-1: detects impermanent loss ignorance in LP queries", () => {
      const queries = [
        { assetSymbol: "ETH-USD", query: "how to add liquidity to uniswap", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "best yield farm for ETH", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "provide liquidity to curve pool", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "LP strategy for stablecoins", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "amm pool returns", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const ilPattern = patterns.find((p) => p.pattern === "IMPERMANENT_LOSS_IGNORANCE");

      expect(ilPattern).toBeDefined();
      expect(ilPattern?.severity).toBe("moderate");
    });

    it("BI-1: does not flag IL when user explicitly mentions IL risk", () => {
      const queries = [
        { assetSymbol: "ETH-USD", query: "how to hedge impermanent loss on uniswap", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "LP with impermanent loss protection", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "divergence loss vs il risk", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "yield farm with il hedge", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "liquidity pool lp risk analysis", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const ilPattern = patterns.find((p) => p.pattern === "IMPERMANENT_LOSS_IGNORANCE");

      expect(ilPattern).toBeUndefined();
    });

    it("BI-2a: detects memecoin aping with hype language", () => {
      const queries = [
        { assetSymbol: "PEPE-USD", query: "PEPE 100x gem to the moon", timestamp: new Date() },
        { assetSymbol: "DOGE-USD", query: "dogecoin pump when lambo", timestamp: new Date() },
        { assetSymbol: "SHIB-USD", query: "shiba viral moonshot next big thing", timestamp: new Date() },
        { assetSymbol: "BONK-USD", query: "bonk meme coin fomo", timestamp: new Date() },
        { assetSymbol: "FLOKI-USD", query: "floki hype train", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const memePattern = patterns.find((p) => p.pattern === "MEMECOIN_APING");

      expect(memePattern).toBeDefined();
      expect(memePattern?.severity).toBe("high");
    });

    it("BI-2a: detects memecoin aping without risk framing", () => {
      const queries = [
        { assetSymbol: "PEPE-USD", query: "should i buy pepe coin", timestamp: new Date() },
        { assetSymbol: "DOGE-USD", query: "dogecoin price prediction", timestamp: new Date() },
        { assetSymbol: "SHIB-USD", query: "shiba inu analysis", timestamp: new Date() },
        { assetSymbol: "BONK-USD", query: "bonk outlook", timestamp: new Date() },
        { assetSymbol: "FLOKI-USD", query: "floki token", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const memePattern = patterns.find((p) => p.pattern === "MEMECOIN_APING");

      expect(memePattern).toBeDefined();
      expect(memePattern?.severity).toBe("moderate");
    });

    it("BI-2a: memecoin query with risk framing is not flagged", () => {
      const queries = [
        { assetSymbol: "PEPE-USD", query: "pepe coin downside risk", timestamp: new Date() },
        { assetSymbol: "DOGE-USD", query: "dogecoin dump risk analysis", timestamp: new Date() },
        { assetSymbol: "SHIB-USD", query: "shiba bear market drawdown", timestamp: new Date() },
        { assetSymbol: "BONK-USD", query: "bonk liquidity risk", timestamp: new Date() },
        { assetSymbol: "FLOKI-USD", query: "floki bear market risk", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const memePattern = patterns.find((p) => p.pattern === "MEMECOIN_APING");

      expect(memePattern).toBeUndefined();
    });

    it("BI-2b: detects staking lockup blindness with full commitment", () => {
      const queries = [
        { assetSymbol: "SOL-USD", query: "stake all my solana 100%", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "lock everything in staking node", timestamp: new Date() },
        { assetSymbol: "ATOM-USD", query: "full stake cosmos validator", timestamp: new Date() },
        { assetSymbol: "SOL-USD", query: "delegate all sol", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "max stake eth 2.0", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const stakingPattern = patterns.find((p) => p.pattern === "STAKING_LOCKUP_BLINDNESS");

      expect(stakingPattern).toBeDefined();
      expect(stakingPattern?.severity).toBe("high");
    });

    it("BI-2b: detects staking lockup blindness with long lockup", () => {
      const queries = [
        { assetSymbol: "ETH-USD", query: "stake eth for 1 year locked", timestamp: new Date() },
        { assetSymbol: "SOL-USD", query: "90 day staking cooldown unstaking", timestamp: new Date() },
        { assetSymbol: "ATOM-USD", query: "180 day unbond period", timestamp: new Date() },
        { assetSymbol: "DOT-USD", query: "validator staking 2 year lock", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "staking with cooldown period", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const stakingPattern = patterns.find((p) => p.pattern === "STAKING_LOCKUP_BLINDNESS");

      expect(stakingPattern).toBeDefined();
      expect(stakingPattern?.severity).toBe("moderate");
    });

    it("BI-2b: staking with liquidity awareness is not flagged", () => {
      const queries = [
        { assetSymbol: "ETH-USD", query: "stake eth but keep liquid reserve for drawdowns", timestamp: new Date() },
        { assetSymbol: "SOL-USD", query: "partial staking with unstake plan", timestamp: new Date() },
        { assetSymbol: "ATOM-USD", query: "diversify staking across validators", timestamp: new Date() },
        { assetSymbol: "DOT-USD", query: "liquid staking instead of lockup", timestamp: new Date() },
        { assetSymbol: "ETH-USD", query: "staking with emergency exit strategy", timestamp: new Date() },
      ];

      const patterns = analyzeBehavioralPatterns(queries);
      const stakingPattern = patterns.find((p) => p.pattern === "STAKING_LOCKUP_BLINDNESS");

      expect(stakingPattern).toBeUndefined();
    });
  });

  describe("buildBehaviorProfile", () => {
    it("should build complete behavior profile", () => {
      const queries = [
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", volatility: 60, timestamp: new Date() },
        { assetSymbol: "BTC-USD", assetType: "CRYPTO", volatility: 65, timestamp: new Date() },
        { assetSymbol: "ETH-USD", assetType: "CRYPTO", volatility: 85, timestamp: new Date() },
        { assetSymbol: "SOL-USD", assetType: "CRYPTO", volatility: 40, timestamp: new Date() },
        { assetSymbol: "BNB-USD", assetType: "CRYPTO", volatility: 55, timestamp: new Date() },
      ];

      const profile = buildBehaviorProfile("user123", queries);

      expect(profile.userId).toBe("user123");
      expect(profile.queryCount).toBe(5);
      expect(profile.assetInterest.get("BTC-USD")).toBe(2);
      expect(profile.assetTypeDistribution.CRYPTO).toBe(5);
      expect(profile.volatilityPreference).toBeGreaterThan(0);
      expect(profile.patterns.length).toBeGreaterThan(0);
    });

    it("should calculate volatility preference correctly", () => {
      const queries = [
        { assetSymbol: "BTC-USD", volatility: 50, timestamp: new Date() },
        { assetSymbol: "ETH-USD", volatility: 60, timestamp: new Date() },
        { assetSymbol: "SOL-USD", volatility: 70, timestamp: new Date() },
        { assetSymbol: "BNB-USD", volatility: 80, timestamp: new Date() },
        { assetSymbol: "DOGE-USD", volatility: 90, timestamp: new Date() },
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
          affectedAssets: ["BTC-USD"],
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
