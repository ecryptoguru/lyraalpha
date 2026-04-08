import { describe, it, expect } from "vitest";
import { estimateRegimeChangeProbability } from "../regime-transition";
import { HistoricalAnalogResult } from "../historical-analog";

describe("Regime Transition Probability", () => {
  it("calculates probabilities correctly", () => {
    const analogs = [
      { regimeState: "RISK_OFF" },
      { regimeState: "RISK_ON" },
      { regimeState: "RISK_OFF" },
      { regimeState: "TRANSITIONAL" },
    ] as HistoricalAnalogResult[];

    const probs = estimateRegimeChangeProbability("NORMAL", analogs);
    
    expect(probs["NORMAL -> RISK_OFF"]).toBe(0.5); // 2/4
    expect(probs["NORMAL -> RISK_ON"]).toBe(0.25); // 1/4
    expect(probs["NORMAL -> TRANSITIONAL"]).toBe(0.25); // 1/4
  });

  it("returns empty object if no analogs", () => {
    const probs = estimateRegimeChangeProbability("NORMAL", []);
    expect(probs).toEqual({});
  });
});
