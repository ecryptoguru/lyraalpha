import { describe, it, expect } from "vitest";
import { calculateRiskRewardAsymmetry, formatRiskRewardContext } from "../risk-reward";

describe("Risk/Reward Asymmetry", () => {
  it("calculates favorable risk/reward correctly", () => {
    const score = calculateRiskRewardAsymmetry(100, 150, 160, 80, "NORMAL");
    expect(score).not.toBeNull();
    expect(score!.ratio).toBe(2.5); // Upside: 50/100 = 0.5, Downside: 20/100 = 0.2. 0.5 / 0.2 = 2.5
    expect(score!.label).toBe("FAVORABLE");
  });

  it("adjusts downside risk in RISK_OFF regime", () => {
    const scoreNormal = calculateRiskRewardAsymmetry(100, 150, 160, 80, "NORMAL");
    const scoreRiskOff = calculateRiskRewardAsymmetry(100, 150, 160, 80, "RISK_OFF");
    
    expect(scoreNormal!.ratio).toBe(2.5);
    expect(scoreRiskOff!.ratio).toBeCloseTo(1.67, 2); // 0.5 / (0.2 * 1.5) = 1.666...
    expect(scoreRiskOff!.components.downside).toBeCloseTo(0.3, 2);
  });

  it("handles missing target price by using 52W high", () => {
    const score = calculateRiskRewardAsymmetry(100, null, 150, 80, "NORMAL");
    expect(score!.ratio).toBe(2.5); 
  });

  it("returns null if insufficient data", () => {
    const score1 = calculateRiskRewardAsymmetry(null, 150, 160, 80, "NORMAL");
    const score2 = calculateRiskRewardAsymmetry(100, null, null, 80, "NORMAL");
    const score3 = calculateRiskRewardAsymmetry(100, 150, 160, null, "NORMAL");
    
    expect(score1).toBeNull();
    expect(score2).toBeNull();
    expect(score3).toBeNull();
  });

  it("formats context string correctly", () => {
    const score = calculateRiskRewardAsymmetry(100, 150, 160, 80, "NORMAL");
    const formatted = formatRiskRewardContext(score!);
    expect(formatted).toBe("[RISK_REWARD] Asymmetry Ratio: 2.50x (FAVORABLE) | Upside: +50.0% | Downside Risk: -20.0% (Regime Adjusted)");
  });
});
