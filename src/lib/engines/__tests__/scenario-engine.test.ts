import { describe, it, expect } from "vitest";
import { calculateScenarios } from "../scenario-engine";
import type { AssetSignals, FactorProfile } from "../scenario-engine";
import type { MarketContextSnapshot } from "../market-regime";

describe("Scenario Engine", () => {
  const mockSignals: AssetSignals = {
    trend: 65,
    momentum: 70,
    volatility: 45,
    liquidity: 60,
    sentiment: 55,
    trust: 70,
  };

  const mockFactorProfile: FactorProfile = {
    value: 40,
    growth: 70,
    momentum: 65,
    lowVol: 35,
  };

  const mockRegime: MarketContextSnapshot = {
    regime: {
      score: 65,
      label: "RISK_ON",
      confidence: "high",
      drivers: ["Test"],
    },
    risk: {
      score: 60,
      label: "RISK_SEEKING",
      confidence: "medium",
      drivers: ["Test"],
    },
    volatility: {
      score: 55,
      label: "STABLE",
      confidence: "high",
      drivers: ["Test"],
    },
    breadth: {
      score: 70,
      label: "BROAD",
      confidence: "high",
      drivers: ["Test"],
    },
    liquidity: {
      score: 65,
      label: "STRONG",
      confidence: "medium",
      drivers: ["Test"],
    },
    lastUpdated: new Date().toISOString(),
  };

  it("calculates scenario outcomes with valid inputs", () => {
    const result = calculateScenarios(mockSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result).toBeDefined();
    expect(result.bullCase).toBeDefined();
    expect(result.baseCase).toBeDefined();
    expect(result.bearCase).toBeDefined();
    expect(result.var5).toBeDefined();
    expect(result.es5).toBeDefined();
    expect(result.fragility).toBeDefined();
  });

  it("bull case return is higher than bear case", () => {
    const result = calculateScenarios(mockSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result.bullCase.expectedReturn).toBeGreaterThan(result.bearCase.expectedReturn);
  });

  it("fragility score is within 0-100 range", () => {
    const result = calculateScenarios(mockSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result.fragility).toBeGreaterThanOrEqual(0);
    expect(result.fragility).toBeLessThanOrEqual(100);
  });

  it("VaR is more negative than expected return", () => {
    const result = calculateScenarios(mockSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result.var5).toBeLessThan(result.bearCase.expectedReturn);
  });

  it("metadata includes current regime and factor alignments", () => {
    const result = calculateScenarios(mockSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result.metadata.currentRegime).toBe("RISK_ON");
    expect(result.metadata.factorAlignment).toBeDefined();
    expect(result.metadata.factorAlignment.STRONG_RISK_ON).toBeDefined();
    expect(result.metadata.liquidityFragility).toBeGreaterThanOrEqual(0);
    expect(result.metadata.liquidityFragility).toBeLessThanOrEqual(100);
  });

  it("handles low liquidity assets with higher fragility", () => {
    const lowLiqSignals: AssetSignals = {
      ...mockSignals,
      liquidity: 20,
    };

    const result = calculateScenarios(lowLiqSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result.fragility).toBeGreaterThan(50);
    expect(result.metadata.liquidityFragility).toBeGreaterThan(70);
  });

  it("handles high volatility assets with higher fragility", () => {
    const highVolSignals: AssetSignals = {
      ...mockSignals,
      volatility: 85,
    };

    const result = calculateScenarios(highVolSignals, mockFactorProfile, mockRegime, 0.5);

    expect(result.fragility).toBeGreaterThan(50);
  });

  it("defensive factor profile aligns better with DEFENSIVE regime", () => {
    const defensiveProfile: FactorProfile = {
      value: 70,
      growth: 20,
      momentum: 25,
      lowVol: 75,
    };

    const result = calculateScenarios(mockSignals, defensiveProfile, mockRegime, 0.5);

    expect(result.metadata.factorAlignment.DEFENSIVE).toBeGreaterThan(
      result.metadata.factorAlignment.STRONG_RISK_ON,
    );
  });

  it("growth factor profile aligns better with STRONG_RISK_ON regime", () => {
    const growthProfile: FactorProfile = {
      value: 20,
      growth: 80,
      momentum: 75,
      lowVol: 25,
    };

    const result = calculateScenarios(mockSignals, growthProfile, mockRegime, 0.5);

    expect(result.metadata.factorAlignment.STRONG_RISK_ON).toBeGreaterThan(
      result.metadata.factorAlignment.DEFENSIVE,
    );
  });
});
