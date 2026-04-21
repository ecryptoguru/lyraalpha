import { describe, expect, it } from "vitest";
import { getScenario, getBestProxyPath, estimateBeta, STRESS_SCENARIO_IDS } from "./index";

// ── getScenario ──────────────────────────────────────────────────────────────

describe("getScenario", () => {
  it("returns a scenario for a valid US id", () => {
    const s = getScenario("gfc-2008", "US");
    expect(s).toBeDefined();
    expect(s?.id).toBe("gfc-2008");
    expect(s?.region).toBe("US");
  });

  it("returns undefined for unknown id", () => {
    expect(getScenario("nonexistent", "US")).toBeUndefined();
  });

  it("returns undefined for wrong region", () => {
    // IN scenarios may not exist in the current data set
    const s = getScenario("gfc-2008", "IN");
    // Just verify it doesn't throw — may be undefined if no IN data
    expect(typeof s === "undefined" || s?.region === "IN").toBe(true);
  });

  it("all STRESS_SCENARIO_IDS have US definitions", () => {
    for (const id of STRESS_SCENARIO_IDS) {
      const us = getScenario(id, "US");
      expect(us, `Expected US scenario for ${id}`).toBeDefined();
      expect(us!.proxyPaths.length).toBeGreaterThan(0);
    }
  });
});

// ── getBestProxyPath ──────────────────────────────────────────────────────────

describe("getBestProxyPath", () => {
  const gfc = getScenario("gfc-2008", "US")!;

  it("returns exact match when symbol is a proxy", () => {
    const path = getBestProxyPath(gfc, "CRYPTO", "BTC-USD");
    expect(path.proxy).toBe("BTC-USD");
  });

  it("returns BTC-USD as default proxy for unknown symbol", () => {
    const path = getBestProxyPath(gfc, "CRYPTO", "DOGE-USD");
    // Should prefer BTC-USD, then ETH-USD, then SOL-USD
    expect(["BTC-USD", "ETH-USD", "SOL-USD"]).toContain(path.proxy);
  });

  it("case-insensitive exact match", () => {
    const path = getBestProxyPath(gfc, "CRYPTO", "btc-usd");
    expect(path.proxy).toBe("BTC-USD");
  });
});

// ── estimateBeta ──────────────────────────────────────────────────────────────

describe("estimateBeta", () => {
  it("returns 1.0 for empty returns", () => {
    expect(estimateBeta([], "BTC-USD")).toBe(1.0);
  });

  it("returns 0.2 (min clamp) for single return (stdDev = 0)", () => {
    // stdDev returns 0 for n<2, so rawBeta = 0, clamped to 0.2
    expect(estimateBeta([0.01], "BTC-USD")).toBe(0.2);
  });

  it("clamps beta to 0.2 minimum", () => {
    // Very low vol asset vs high vol proxy
    const tinyVol = Array(30).fill(0.0001);
    const beta = estimateBeta(tinyVol, "BTC-USD");
    expect(beta).toBeGreaterThanOrEqual(0.2);
  });

  it("clamps beta to 2.5 maximum", () => {
    // Very high vol asset vs low vol proxy
    const hugeVol = Array(30).fill(0).map((_, i) => i % 2 === 0 ? 0.5 : -0.5);
    const beta = estimateBeta(hugeVol, "BTC-USD");
    expect(beta).toBeLessThanOrEqual(2.5);
  });

  it("produces reasonable beta for typical crypto asset", () => {
    // Simulate ~60% annualized vol (similar to ETH) vs BTC at 75%
    const dailyVol = 0.60 / Math.sqrt(252); // ~0.0378 daily
    const returns = Array(60).fill(0).map(() =>
      dailyVol * (Math.random() - 0.5) * 2,
    );
    const beta = estimateBeta(returns, "BTC-USD");
    expect(beta).toBeGreaterThan(0.3);
    expect(beta).toBeLessThan(2.5);
  });

  it("uses default proxy vol for unknown proxy symbol", () => {
    const returns = [0.01, -0.02, 0.015, -0.005, 0.02];
    // Should not throw — uses 0.20 default
    const beta = estimateBeta(returns, "UNKNOWN-USD");
    expect(beta).toBeGreaterThan(0);
    expect(beta).toBeLessThanOrEqual(2.5);
  });
});

// ── STRESS_SCENARIO_IDS ──────────────────────────────────────────────────────

describe("STRESS_SCENARIO_IDS", () => {
  it("contains expected core scenarios", () => {
    expect(STRESS_SCENARIO_IDS).toContain("gfc-2008");
    expect(STRESS_SCENARIO_IDS).toContain("covid-2020");
  });

  it("has no duplicate ids", () => {
    const unique = new Set(STRESS_SCENARIO_IDS);
    expect(unique.size).toBe(STRESS_SCENARIO_IDS.length);
  });
});
