import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, STRESS_SCENARIO_IDS, getScenario } from "./index";

describe("stress scenario registry", () => {
  it("exports unique stress scenario ids", () => {
    expect(STRESS_SCENARIO_IDS).toEqual([...new Set(STRESS_SCENARIO_IDS)]);
  });

  it("keeps proxy paths internally consistent for each scenario", () => {
    for (const scenario of ALL_SCENARIOS) {
      expect(scenario.proxyPaths.length).toBeGreaterThan(0);

      const availableProxies = new Set(scenario.proxyPaths.map((path) => path.proxy));
      for (const path of scenario.proxyPaths) {
        expect(availableProxies.has(path.proxy)).toBe(true);
        expect(path.path.length).toBeGreaterThan(0);
        expect(path.path[0]?.day).toBe(0);
      }
    }
  });

  it("includes the expanded scenario ids", () => {
    expect(STRESS_SCENARIO_IDS).toEqual(expect.arrayContaining([
      "gfc-2008",
      "covid-2020",
      "rate-shock-2022",
      "recession",
      "interest-rate-shock",
      "tech-bubble-crash",
      "oil-spike",
    ]));
  });

  it("keeps rich metadata on the expanded scenarios for both regions", () => {
    for (const region of ["US", "IN"] as const) {
      for (const scenarioId of ["recession", "interest-rate-shock", "tech-bubble-crash", "oil-spike"] as const) {
        const scenario = getScenario(scenarioId, region);
        expect(scenario).toBeDefined();
        expect(scenario?.severity).toBeDefined();
        expect(scenario?.shockType).toBeDefined();
        expect(scenario?.narrative?.headline).toBeTruthy();
        expect(scenario?.narrative?.dominantDrivers.length).toBeGreaterThan(0);
        expect(scenario?.assetTypeAdjustments?.STOCK).toBeDefined();
        expect(scenario?.assetTypeAdjustments?.ETF).toBeDefined();
        expect(scenario?.assetTypeAdjustments?.CRYPTO).toBeDefined();
        expect(scenario?.assetTypeAdjustments?.COMMODITY).toBeDefined();
        expect(scenario?.assetTypeAdjustments?.MUTUAL_FUND).toBeDefined();
      }
    }
  });
});
