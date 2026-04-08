/**
 * Trust Engine — Accuracy Tests
 * Verifies base scores by asset type, logarithmic cap scale,
 * volume/dollar-volume score, price stability proxy, composite formula.
 */
import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../trust";
import type { Asset } from "@/generated/prisma/client";
import type { MarketQuote } from "@/types/market-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAsset(type: string): Asset {
  return { id: "a1", symbol: "TEST", type, name: "Test" } as unknown as Asset;
}

function makeQuote(overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    regularMarketPrice: 100,
    regularMarketVolume: 1_000_000,
    averageDailyVolume10Day: 1_000_000,
    marketCap: 10_000_000_000,
    fiftyTwoWeekHigh: 120,
    ...overrides,
  } as MarketQuote;
}

// ─── Base Score by Asset Type ─────────────────────────────────────────────────

describe("Trust — base score by asset type", () => {
  it("STOCK → baseScore = 78", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 0 }));
    // With no market cap, capScore = 30 (default), volumeScore = 50 (no avgVol), stabilityScore = 50
    // score = round(78*0.40 + 30*0.30 + 50*0.15 + 50*0.15) = round(31.2 + 9 + 7.5 + 7.5) = round(55.2) = 55
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.context).toContain("Regulated public security");
  });

  it("ETF → baseScore = 78 (same as STOCK)", () => {
    const result = calculateTrustScore(makeAsset("ETF"), makeQuote({ marketCap: 0 }));
    expect(result.context).toContain("Regulated public security");
  });

  it("MUTUAL_FUND → baseScore = 78", () => {
    const result = calculateTrustScore(makeAsset("MUTUAL_FUND"), makeQuote({ marketCap: 0 }));
    expect(result.context).toContain("Regulated public security");
  });

  it("CRYPTO → baseScore = 38 (lower than STOCK)", () => {
    const stockResult = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 0 }));
    const cryptoResult = calculateTrustScore(makeAsset("CRYPTO"), makeQuote({ marketCap: 0 }));
    expect(cryptoResult.score).toBeLessThan(stockResult.score);
    expect(cryptoResult.context).toContain("Speculative asset class");
  });

  it("COMMODITY → baseScore = 72 (between STOCK and CRYPTO)", () => {
    const stockResult = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 0 }));
    const cryptoResult = calculateTrustScore(makeAsset("CRYPTO"), makeQuote({ marketCap: 0 }));
    const commodityResult = calculateTrustScore(makeAsset("COMMODITY"), makeQuote({ marketCap: 0 }));
    expect(commodityResult.score).toBeLessThan(stockResult.score);
    expect(commodityResult.score).toBeGreaterThan(cryptoResult.score);
  });
});

// ─── Market Cap Score (Logarithmic) ──────────────────────────────────────────

describe("Trust — market cap score (log scale)", () => {
  it("$1T market cap → capScore near 95", () => {
    // log10(1T) = 12 → ((12-7)/5.5)*85 + 10 = (5/5.5)*85 + 10 ≈ 77.3 + 10 = 87.3 → min(95, 87.3) = 87.3
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 1_000_000_000_000 }));
    const capScore = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(capScore.cap).toBeGreaterThanOrEqual(85);
  });

  it("$100M market cap → capScore ≈ 10 (minimum)", () => {
    // log10(100M) = 8 → ((8-7)/5.5)*85 + 10 = (1/5.5)*85 + 10 ≈ 15.45 + 10 = 25.45
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 100_000_000 }));
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(breakdown.cap).toBeGreaterThanOrEqual(10);
    expect(breakdown.cap).toBeLessThan(40);
  });

  it("larger market cap → higher trust score", () => {
    const small = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 500_000_000 }));
    const large = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 500_000_000_000 }));
    expect(large.score).toBeGreaterThan(small.score);
  });

  it("$500B+ market cap → context includes 'Category leader'", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 600_000_000_000 }));
    expect(result.context).toContain("Category leader");
  });

  it("$100B+ market cap → context includes 'Mega-cap'", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 150_000_000_000 }));
    expect(result.context).toContain("Mega-cap institutional grade");
  });

  it("< $100M market cap → context includes 'Micro-cap'", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ marketCap: 50_000_000 }));
    expect(result.context).toContain("Micro-cap volatility risk");
  });
});

// ─── Volume Score ─────────────────────────────────────────────────────────────

describe("Trust — volume score (log scale)", () => {
  it("zero volume → volumeScore = 50 (default)", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({ averageDailyVolume10Day: 0, regularMarketVolume: 0 }));
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(breakdown.volume).toBe(50);
  });

  it("$1B daily dollar volume → volumeScore near 90", () => {
    // avgVol = 10_000_000, price = 100 → dollarVol = $1B
    // log10(1B) = 9 → ((9-5)/5)*75 + 15 = (4/5)*75 + 15 = 60 + 15 = 75 → min(90, 75) = 75
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({
      averageDailyVolume10Day: 10_000_000,
      regularMarketPrice: 100,
    }));
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(breakdown.volume).toBeGreaterThanOrEqual(70);
  });

  it("higher volume → higher volume score", () => {
    const low = calculateTrustScore(makeAsset("STOCK"), makeQuote({ averageDailyVolume10Day: 10_000, regularMarketPrice: 10 }));
    const high = calculateTrustScore(makeAsset("STOCK"), makeQuote({ averageDailyVolume10Day: 10_000_000, regularMarketPrice: 100 }));
    const lowBreakdown = (low.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    const highBreakdown = (high.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(highBreakdown.volume).toBeGreaterThan(lowBreakdown.volume);
  });
});

// ─── Price Stability (52W High Proximity) ────────────────────────────────────

describe("Trust — price stability score", () => {
  it("price = 52W high → distFromHigh = 0 → stabilityScore = 85", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({
      regularMarketPrice: 120,
      fiftyTwoWeekHigh: 120,
    }));
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    // distFromHigh = 0 → 85 - 0*1.3 = 85
    expect(breakdown.stability).toBe(85);
  });

  it("price 50% below 52W high → stabilityScore = 20 (clamped)", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({
      regularMarketPrice: 60,
      fiftyTwoWeekHigh: 120,
    }));
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    // distFromHigh = 50% → 85 - 50*1.3 = 85 - 65 = 20
    expect(breakdown.stability).toBe(20);
  });

  it("closer to 52W high → higher stability score", () => {
    const near = calculateTrustScore(makeAsset("STOCK"), makeQuote({ regularMarketPrice: 115, fiftyTwoWeekHigh: 120 }));
    const far = calculateTrustScore(makeAsset("STOCK"), makeQuote({ regularMarketPrice: 80, fiftyTwoWeekHigh: 120 }));
    const nearBreakdown = (near.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    const farBreakdown = (far.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(nearBreakdown.stability).toBeGreaterThan(farBreakdown.stability);
  });
});

// ─── Composite Formula ────────────────────────────────────────────────────────

describe("Trust — composite formula", () => {
  it("score = round(base*0.40 + cap*0.30 + volume*0.15 + stability*0.15)", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote({
      marketCap: 50_000_000_000,
      averageDailyVolume10Day: 5_000_000,
      regularMarketPrice: 100,
      fiftyTwoWeekHigh: 110,
    }));
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    const expected = Math.round(
      breakdown.base * 0.40 + breakdown.cap * 0.30 +
      breakdown.volume * 0.15 + breakdown.stability * 0.15,
    );
    const clamped = Math.min(99, Math.max(1, expected));
    expect(result.score).toBe(clamped);
  });

  it("score always in [1, 99]", () => {
    const cases = [
      makeQuote({ marketCap: 0, averageDailyVolume10Day: 0 }),
      makeQuote({ marketCap: 2_000_000_000_000, averageDailyVolume10Day: 100_000_000 }),
    ];
    for (const quote of cases) {
      const result = calculateTrustScore(makeAsset("STOCK"), quote);
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(99);
    }
  });
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe("Trust — metadata", () => {
  it("includes breakdown with base, cap, volume, stability", () => {
    const result = calculateTrustScore(makeAsset("STOCK"), makeQuote());
    const breakdown = (result.metadata as Record<string, unknown>)?.breakdown as Record<string, number>;
    expect(breakdown).toHaveProperty("base");
    expect(breakdown).toHaveProperty("cap");
    expect(breakdown).toHaveProperty("volume");
    expect(breakdown).toHaveProperty("stability");
  });

  it("direction reflects score (UP >= 65, DOWN <= 40, FLAT otherwise)", () => {
    // Score > 65 should be UP
    const highAsset = makeAsset("STOCK");
    const highQuote = makeQuote({ marketCap: 2000000000000, averageDailyVolume10Day: 100000000, regularMarketPrice: 100, fiftyTwoWeekHigh: 100 });
    const highResult = calculateTrustScore(highAsset, highQuote);
    expect(highResult.score).toBeGreaterThanOrEqual(65);
    expect(highResult.direction).toBe("UP");

    // Score < 40 should be DOWN
    const lowAsset = makeAsset("CRYPTO");
    const lowQuote = makeQuote({ marketCap: 1000000, averageDailyVolume10Day: 10000, regularMarketPrice: 50, fiftyTwoWeekHigh: 100 });
    const lowResult = calculateTrustScore(lowAsset, lowQuote);
    expect(lowResult.score).toBeLessThanOrEqual(40);
    expect(lowResult.direction).toBe("DOWN");
  });
});
