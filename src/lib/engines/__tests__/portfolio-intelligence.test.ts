/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { buildPortfolioIntelligence, type PortfolioIntelligenceInput } from "../portfolio-intelligence";
import { computePortfolioHealth } from "../portfolio-health";
import { clamp, clamp10, hhi, formatRegime, normalizeShareText } from "../portfolio-utils";

const baseInput: PortfolioIntelligenceInput = {
  healthScore: 72,
  diversificationScore: 70,
  concentrationScore: 66,
  volatilityScore: 74,
  correlationScore: 79,
  qualityScore: 68,
  fragilityScore: 31,
  currentMarketRegime: "RISK_ON",
  riskMetrics: {
    averageCompatibilityScore: 66,
    weakCompatibilityCount: 1,
    topCompatibilityDrag: ["BTC-USD"],
    regimeMismatchLabel: "Moderate mismatch",
    regimeMismatchReason: "Part of the portfolio still looks out of sync with the current risk on backdrop.",
    currentMarketRegime: "RISK_ON",
    dominantSector: "Technology",
    concentrationWeight: 42,
  },
  holdings: [
    {
      quantity: 10,
      avgPrice: 100,
      asset: {
        price: 118,
        sector: "Technology",
        type: "CRYPTO",
      },
    },
    {
      quantity: 5,
      avgPrice: 200,
      asset: {
        price: 210,
        sector: "Finance",
        type: "CRYPTO",
      },
    },
  ],
};

describe("buildPortfolioIntelligence", () => {
  it("builds a bounded score and readable headline from portfolio inputs", () => {
    const result = buildPortfolioIntelligence(baseInput);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.band).toMatch(/Strong|Balanced|Fragile|High Risk|Exceptional/);
    expect(result.scoreValue).toMatch(/\/ 10$/);
    expect(result.headline.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it("uses live simulation context to adjust the narrative and score", () => {
    const withoutSimulation = buildPortfolioIntelligence(baseInput);
    const withSimulation = buildPortfolioIntelligence({
      ...baseInput,
      simulation: {
        expectedReturn: -0.08,
        medianReturn: -0.05,
        p25Return: -0.12,
        p75Return: 0.02,
        var5: -0.18,
        es5: -0.22,
        maxDrawdownMean: 0.18,
        fragilityMean: 64,
        regimeForecast: { RISK_ON: 0.35, NEUTRAL: 0.3, DEFENSIVE: 0.35 },
        pathCount: 2000,
        horizon: 20,
        mode: "B",
      },
    });

    expect(withSimulation.score).not.toBe(withoutSimulation.score);
    expect(withSimulation.signals.some((signal) => signal.label === "Monte Carlo")).toBe(true);
  });

  it("omits regime signal when no regime is available", () => {
    const result = buildPortfolioIntelligence({ ...baseInput, currentMarketRegime: null, riskMetrics: {} });
    expect(result.signals.some((s) => s.label === "Market regime")).toBe(false);
  });

  it("does not fall back volatilityScore to healthScore", () => {
    const withVol = buildPortfolioIntelligence({ ...baseInput, volatilityScore: 10 });
    const withoutVol = buildPortfolioIntelligence({ ...baseInput, volatilityScore: null });
    expect(withVol.components.resilience).not.toBe(withoutVol.components.resilience);
  });

  it("returns score 0 for empty holdings list with null scores", () => {
    const result = buildPortfolioIntelligence({
      healthScore: null,
      diversificationScore: null,
      concentrationScore: null,
      volatilityScore: null,
      correlationScore: null,
      qualityScore: null,
      fragilityScore: null,
      holdings: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});

describe("computePortfolioHealth", () => {
  it("returns 0 diversification for a single holding (not 10)", () => {
    const result = computePortfolioHealth([
      { symbol: "BTC-USD", weight: 1, avgVolatilityScore: 50, avgLiquidityScore: 80, avgTrustScore: 85, sector: null, type: "CRYPTO" },
    ]);
    expect(result.dimensions.diversificationScore).toBe(0);
  });

  it("returns empty-portfolio defaults for zero holdings", () => {
    const result = computePortfolioHealth([]);
    expect(result.healthScore).toBe(0);
    expect(result.band).toBe("High Risk");
    expect(result.holdingCount).toBe(0);
  });

  it("scores a well-diversified portfolio above 60", () => {
    const holdings = [
      { symbol: "BTC", weight: 0.25, avgVolatilityScore: 60, avgLiquidityScore: 90, avgTrustScore: 88, sector: "Layer 1", type: "CRYPTO" },
      { symbol: "ETH", weight: 0.25, avgVolatilityScore: 30, avgLiquidityScore: 92, avgTrustScore: 95, sector: "DeFi", type: "CRYPTO" },
      { symbol: "SOL", weight: 0.25, avgVolatilityScore: 20, avgLiquidityScore: 98, avgTrustScore: 97, sector: "Layer 1", type: "CRYPTO" },
      { symbol: "LINK", weight: 0.25, avgVolatilityScore: 80, avgLiquidityScore: 70, avgTrustScore: 65, sector: "Oracle", type: "CRYPTO" },
    ];
    const result = computePortfolioHealth(holdings);
    expect(result.healthScore).toBeGreaterThan(45);
  });
});

describe("portfolio-utils", () => {
  it("clamp keeps values in [0, 100]", () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(105)).toBe(100);
    expect(clamp(50)).toBe(50);
  });

  it("clamp10 keeps values in [0, 10]", () => {
    expect(clamp10(-1)).toBe(0);
    expect(clamp10(11)).toBe(10);
    expect(clamp10(7.5)).toBe(7.5);
  });

  it("hhi returns 1 for a single-asset portfolio", () => {
    expect(hhi([1])).toBe(1);
  });

  it("hhi returns 0.25 for equal-weight 4-asset portfolio", () => {
    expect(hhi([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(0.25);
  });

  it("formatRegime converts RISK_OFF to 'risk off'", () => {
    expect(formatRegime("RISK_OFF")).toBe("risk off");
    expect(formatRegime(null)).toBeNull();
    expect(formatRegime(undefined)).toBeNull();
  });

  it("normalizeShareText collapses whitespace", () => {
    expect(normalizeShareText("  hello   world  ")).toBe("hello world");
  });
});
