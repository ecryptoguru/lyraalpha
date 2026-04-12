import { describe, it, expect } from "vitest";
import {
  calculateSignalStrength,
  SignalStrengthInput,
} from "../signal-strength";
import { AssetSignals, CompatibilityResult } from "../compatibility";
import { MarketContextSnapshot } from "../market-regime";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const bullishSignals: AssetSignals = {
  trend: 78,
  momentum: 72,
  volatility: 25,
  sentiment: 68,
  liquidity: 75,
  trust: 80,
};

const bearishSignals: AssetSignals = {
  trend: 22,
  momentum: 18,
  volatility: 82,
  sentiment: 25,
  liquidity: 30,
  trust: 60,
};

const neutralSignals: AssetSignals = {
  trend: 50,
  momentum: 48,
  volatility: 50,
  sentiment: 52,
  liquidity: 55,
  trust: 65,
};

const strongFitCompatibility: CompatibilityResult = {
  score: 82,
  label: "Strong Fit",
  confidence: "high",
  breakdown: { trend: 85, momentum: 80, volatility: 75, liquidity: 80, sentiment: 70 },
  explanation: ["Strong alignment with risk-on regime"],
};

const weakFitCompatibility: CompatibilityResult = {
  score: 28,
  label: "Weak Fit",
  confidence: "medium",
  breakdown: { trend: 25, momentum: 30, volatility: 35, liquidity: 20, sentiment: 30 },
  explanation: ["Poor alignment with current regime"],
};

const riskOnContext: MarketContextSnapshot = {
  regime: { score: 75, label: "RISK_ON", confidence: "high", drivers: ["Broad market strength"] },
  risk: { score: 65, label: "RISK_SEEKING", confidence: "high", drivers: [] },
  volatility: { score: 30, label: "STABLE", confidence: "high", drivers: [] },
  breadth: { score: 70, label: "BROAD", confidence: "medium", drivers: [] },
  liquidity: { score: 72, label: "STRONG", confidence: "high", drivers: [] },
  lastUpdated: new Date().toISOString(),
};

const riskOffContext: MarketContextSnapshot = {
  regime: { score: 20, label: "RISK_OFF", confidence: "high", drivers: ["Market stress"] },
  risk: { score: 25, label: "RISK_AVERSION", confidence: "high", drivers: [] },
  volatility: { score: 80, label: "ELEVATED", confidence: "high", drivers: [] },
  breadth: { score: 25, label: "NARROW", confidence: "medium", drivers: [] },
  liquidity: { score: 30, label: "THIN", confidence: "medium", drivers: [] },
  lastUpdated: new Date().toISOString(),
};

function buildInput(overrides: Partial<SignalStrengthInput> = {}): SignalStrengthInput {
  return {
    signals: bullishSignals,
    compatibility: strongFitCompatibility,
    marketContext: riskOnContext,
    assetType: "CRYPTO",
    scoreDynamics: null,
    eventAdjustedScores: null,
    factorAlignment: null,
    fundamentals: null,
    groupClassification: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calculateSignalStrength", () => {
  describe("Core Output Structure", () => {
    it("returns all required fields", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("breakdown");
      expect(result).toHaveProperty("weights");
      expect(result).toHaveProperty("keyDrivers");
      expect(result).toHaveProperty("riskFactors");
      expect(result).toHaveProperty("engineDirections");
      expect(result).toHaveProperty("metadata");
    });

    it("score is clamped between 0 and 100", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("breakdown sub-scores are each 0-100", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result.breakdown.dse).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.dse).toBeLessThanOrEqual(100);
      expect(result.breakdown.regime).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.regime).toBeLessThanOrEqual(100);
      expect(result.breakdown.fundamental).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.fundamental).toBeLessThanOrEqual(100);
      expect(result.breakdown.dynamics).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.dynamics).toBeLessThanOrEqual(100);
    });

    it("returns deterministic results for same input", () => {
      const input = buildInput();
      const r1 = calculateSignalStrength(input);
      const r2 = calculateSignalStrength(input);
      expect(r1.score).toBe(r2.score);
      expect(r1.label).toBe(r2.label);
      expect(r1.confidence).toBe(r2.confidence);
    });
  });

  describe("Signal Labels", () => {
    it("bullish signals + strong fit = Bullish or Strong Bullish", () => {
      const result = calculateSignalStrength(buildInput());
      expect(["Bullish", "Strong Bullish"]).toContain(result.label);
    });

    it("bearish signals + weak fit = Bearish or Strong Bearish", () => {
      const result = calculateSignalStrength(buildInput({
        signals: bearishSignals,
        compatibility: weakFitCompatibility,
        marketContext: riskOffContext,
      }));
      expect(["Bearish", "Strong Bearish"]).toContain(result.label);
    });

    it("neutral signals = Neutral", () => {
      const result = calculateSignalStrength(buildInput({
        signals: neutralSignals,
        compatibility: { ...strongFitCompatibility, score: 50, label: "Mixed Fit" },
      }));
      expect(result.label).toBe("Neutral");
    });
  });

  describe("Asset-Type-Aware Weighting", () => {
    it("CRYPTO uses 40% DSE weight", () => {
      const result = calculateSignalStrength(buildInput({ assetType: "CRYPTO" }));
      expect(result.weights.dse).toBe(0.40);
      expect(result.weights.fundamental).toBe(0.20);
    });

    it("CRYPTO uses 55% DSE weight and 0% fundamental", () => {
      const result = calculateSignalStrength(buildInput({ assetType: "CRYPTO" }));
      expect(result.weights.dse).toBe(0.55);
      expect(result.weights.fundamental).toBe(0.00);
    });

    it("CRYPTO uses DSE weight", () => {
      const result = calculateSignalStrength(buildInput({ assetType: "CRYPTO" }));
      expect(result.weights.dse).toBeGreaterThan(0);
    });

    it("normalizes asset type variants (cryptocurrency → CRYPTO)", () => {
      const result = calculateSignalStrength(buildInput({ assetType: "cryptocurrency" }));
      expect(result.metadata.assetType).toBe("CRYPTO");
      expect(result.weights.dse).toBe(0.55);
    });

    it("normalizes asset type variants (equity → CRYPTO)", () => {
      const result = calculateSignalStrength(buildInput({ assetType: "equity" }));
      expect(result.metadata.assetType).toBe("CRYPTO");
    });
  });

  describe("Volatility Inversion", () => {
    it("high volatility reduces DSE score", () => {
      const highVol = calculateSignalStrength(buildInput({
        signals: { ...bullishSignals, volatility: 90 },
      }));
      const lowVol = calculateSignalStrength(buildInput({
        signals: { ...bullishSignals, volatility: 15 },
      }));
      expect(lowVol.score).toBeGreaterThan(highVol.score);
    });
  });

  describe("Fundamental Layer", () => {
    it("strong fundamentals boost crypto signal", () => {
      const withFundamentals = calculateSignalStrength(buildInput({
        fundamentals: {
          peRatio: 15,
          industryPe: 25,
          pegRatio: 0.8,
          priceToBook: 1.5,
          roe: 0.22,
          operatingMargins: 0.20,
          revenueGrowth: 0.25,
          targetMeanPrice: 200,
          currentPrice: 150,
          heldPercentInstitutions: 0.75,
          shortRatio: 1.5,
        },
      }));
      const withoutFundamentals = calculateSignalStrength(buildInput());
      expect(withFundamentals.breakdown.fundamental).toBeGreaterThan(withoutFundamentals.breakdown.fundamental);
    });

    it("fundamentals are neutral (50) for CRYPTO regardless of data", () => {
      const result = calculateSignalStrength(buildInput({
        assetType: "CRYPTO",
        fundamentals: {
          peRatio: 15,
          industryPe: 25,
          roe: 0.22,
        },
      }));
      expect(result.breakdown.fundamental).toBe(50);
    });

    it("analyst upside > 20% produces high analyst score", () => {
      const result = calculateSignalStrength(buildInput({
        fundamentals: {
          targetMeanPrice: 180,
          currentPrice: 100,
        },
      }));
      expect(result.breakdown.fundamental).toBeGreaterThan(50);
    });
  });

  describe("Score Dynamics Layer", () => {
    it("improving dynamics boost signal", () => {
      const withDynamics = calculateSignalStrength(buildInput({
        scoreDynamics: {
          trend: { momentum: 2.5, acceleration: 0.5, volatility: 0.3, trend: "IMPROVING", percentileRank: 75, sectorPercentile: 70 },
          momentum: { momentum: 1.8, acceleration: 0.3, volatility: 0.4, trend: "IMPROVING", percentileRank: 68, sectorPercentile: 65 },
          volatility: { momentum: -1.0, acceleration: -0.2, volatility: 0.5, trend: "IMPROVING", percentileRank: 60, sectorPercentile: 55 },
        },
      }));
      const withoutDynamics = calculateSignalStrength(buildInput());
      expect(withDynamics.breakdown.dynamics).toBeGreaterThan(withoutDynamics.breakdown.dynamics);
    });

    it("deteriorating dynamics reduce signal", () => {
      const result = calculateSignalStrength(buildInput({
        scoreDynamics: {
          trend: { momentum: -3.0, acceleration: -1.0, volatility: 1.5, trend: "DETERIORATING", percentileRank: 20, sectorPercentile: 15 },
          momentum: { momentum: -2.5, acceleration: -0.8, volatility: 1.2, trend: "DETERIORATING", percentileRank: 25, sectorPercentile: 20 },
        },
      }));
      expect(result.breakdown.dynamics).toBeLessThan(50);
    });
  });

  describe("Confidence Calculation", () => {
    it("high confidence with complete data and engine agreement", () => {
      const result = calculateSignalStrength(buildInput({
        scoreDynamics: {
          trend: { momentum: 1, acceleration: 0.1, volatility: 0.3, trend: "IMPROVING", percentileRank: 70, sectorPercentile: 65 },
        },
        factorAlignment: { score: 70, regimeFit: "STRONG" },
      }));
      expect(result.confidence).toBe("high");
    });

    it("low confidence with zero signals", () => {
      const result = calculateSignalStrength(buildInput({
        signals: { trend: 0, momentum: 0, volatility: 0, sentiment: 0, liquidity: 0, trust: 0 },
        compatibility: { ...strongFitCompatibility, score: 0 },
        marketContext: { ...riskOnContext, regime: { ...riskOnContext.regime, confidence: "low" } },
      }));
      expect(result.confidence).toBe("low");
    });
  });

  describe("Key Drivers and Risk Factors", () => {
    it("bullish input generates key drivers", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result.keyDrivers.length).toBeGreaterThan(0);
      expect(result.keyDrivers.length).toBeLessThanOrEqual(3);
    });

    it("bearish input generates risk factors", () => {
      const result = calculateSignalStrength(buildInput({
        signals: bearishSignals,
        compatibility: weakFitCompatibility,
      }));
      expect(result.riskFactors.length).toBeGreaterThan(0);
      expect(result.riskFactors.length).toBeLessThanOrEqual(2);
    });

    it("drivers are strings with meaningful content", () => {
      const result = calculateSignalStrength(buildInput());
      result.keyDrivers.forEach(d => {
        expect(typeof d).toBe("string");
        expect(d.length).toBeGreaterThan(10);
      });
    });
  });

  describe("Engine Directions", () => {
    it("returns direction for all 6 engines", () => {
      const result = calculateSignalStrength(buildInput());
      expect(Object.keys(result.engineDirections)).toHaveLength(6);
      expect(result.engineDirections).toHaveProperty("trend");
      expect(result.engineDirections).toHaveProperty("momentum");
      expect(result.engineDirections).toHaveProperty("volatility");
      expect(result.engineDirections).toHaveProperty("sentiment");
      expect(result.engineDirections).toHaveProperty("liquidity");
      expect(result.engineDirections).toHaveProperty("trust");
    });

    it("bullish signals produce bullish directions", () => {
      const result = calculateSignalStrength(buildInput());
      expect(["STRONG_BULLISH", "BULLISH"]).toContain(result.engineDirections.trend);
      expect(["STRONG_BULLISH", "BULLISH"]).toContain(result.engineDirections.momentum);
    });

    it("volatility direction is inverted (low vol = bullish)", () => {
      const result = calculateSignalStrength(buildInput({
        signals: { ...bullishSignals, volatility: 20 },
      }));
      expect(["STRONG_BULLISH", "BULLISH"]).toContain(result.engineDirections.volatility);
    });
  });

  describe("Regime Transitioning", () => {
    it("transitioning regime reduces regime layer influence", () => {
      const transitioningContext: MarketContextSnapshot = {
        ...riskOnContext,
        regime: { score: 50, label: "TRANSITIONING", confidence: "medium", drivers: ["Shifting conditions"] },
      };

      const stable = calculateSignalStrength(buildInput());
      const transitioning = calculateSignalStrength(buildInput({ marketContext: transitioningContext }));

      // Transitioning should produce a different (likely lower) score due to reduced regime confidence
      expect(transitioning.score).not.toBe(stable.score);
    });
  });

  describe("Event Impact Modifier", () => {
    it("positive events slightly boost score", () => {
      const withEvents = calculateSignalStrength(buildInput({
        eventAdjustedScores: {
          trend: { adjustedScore: 82, impactMagnitude: 5.0, recentEvents: 2, maxSeverity: "MEDIUM" },
          momentum: { adjustedScore: 75, impactMagnitude: 3.0, recentEvents: 1, maxSeverity: "LOW" },
        },
      }));
      const withoutEvents = calculateSignalStrength(buildInput());
      // Event modifier is clamped to ±5, so difference should be small
      expect(Math.abs(withEvents.score - withoutEvents.score)).toBeLessThanOrEqual(5);
    });

    it("no events produces zero modifier", () => {
      const withNoActiveEvents = calculateSignalStrength(buildInput({
        eventAdjustedScores: {
          trend: { adjustedScore: 78, impactMagnitude: 0, recentEvents: 0 },
        },
      }));
      const withoutEvents = calculateSignalStrength(buildInput());
      expect(withNoActiveEvents.score).toBe(withoutEvents.score);
    });
  });

  describe("Metadata", () => {
    it("includes data completeness ratio", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result.metadata.dataCompleteness).toBeGreaterThan(0);
      expect(result.metadata.dataCompleteness).toBeLessThanOrEqual(1);
    });

    it("includes engine agreement ratio", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result.metadata.engineAgreement).toBeGreaterThan(0);
      expect(result.metadata.engineAgreement).toBeLessThanOrEqual(1);
    });

    it("includes regime context", () => {
      const result = calculateSignalStrength(buildInput());
      expect(result.metadata.regimeContext).toBe("RISK_ON");
    });

    it("includes asset type", () => {
      const result = calculateSignalStrength(buildInput({ assetType: "CRYPTO" }));
      expect(result.metadata.assetType).toBe("CRYPTO");
    });
  });
});
