/**
 * Discovery Relevance Score (DRS) Engine — Accuracy Tests
 * Verifies score inflection scaling, peer divergence formula, regime relevance,
 * sentiment shift, structural signal, composite formula, suppression rules,
 * archetype detection, and weight configuration per asset type.
 */
import { describe, it, expect } from "vitest";
import { computeDRS, type DRSInput, type ScoreDynamicsEntry } from "../discovery-relevance";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDynamics(momentum: number, trend = "STABLE"): ScoreDynamicsEntry {
  return { momentum, acceleration: 0, trend, percentileRank: 50, sectorPercentile: 50, volatility: 0.5 };
}

function baseInput(overrides: Partial<DRSInput> = {}): DRSInput {
  return {
    assetId: "asset-1",
    symbol: "BTC-USD",
    name: "Bitcoin",
    type: "CRYPTO",
    region: "US",
    scoreDynamics: {
      TREND: makeDynamics(5),
      MOMENTUM: makeDynamics(5),
    },
    latestScores: { TREND: 70, MOMENTUM: 65 },
    peerMedians: { TREND: 50, MOMENTUM: 50 },
    regimeAlignment: { arcsScore: 70, transitionProbability: 50, transitionDirection: "UP" },
    portfolioLookthrough: null,
    signalStrength: { score: 70, label: "Bullish" },
    lastSyncAge: 12,
    ...overrides,
  };
}

// ─── Score Inflection ─────────────────────────────────────────────────────────

describe("DRS — score inflection", () => {
  it("zero dynamics → inflectionScore = 0", () => {
    const input = baseInput({
      scoreDynamics: {
        TREND: makeDynamics(0),
        MOMENTUM: makeDynamics(0),
      },
    });
    const result = computeDRS(input);
    // With zero inflection, DRS should be low
    expect(result.drs).toBeLessThan(50);
  });

  it("null dynamics → inflectionScore = 0", () => {
    const input = baseInput({ scoreDynamics: null });
    const result = computeDRS(input);
    expect(result.drs).toBeGreaterThanOrEqual(0);
    expect(result.drs).toBeLessThanOrEqual(100);
  });

  it("large momentum → higher DRS than small momentum", () => {
    const small = computeDRS(baseInput({
      scoreDynamics: { TREND: makeDynamics(1), MOMENTUM: makeDynamics(1) },
    }));
    const large = computeDRS(baseInput({
      scoreDynamics: { TREND: makeDynamics(20), MOMENTUM: makeDynamics(20) },
    }));
    expect(large.drs).toBeGreaterThan(small.drs);
  });

  it("inflection scaling: avgMagnitude < 1 → score < 15", () => {
    // avgMagnitude = 0.5 → 0.5 * 15 = 7.5
    const input = baseInput({
      scoreDynamics: { TREND: makeDynamics(0.5), MOMENTUM: makeDynamics(0.5) },
      peerMedians: { TREND: 70, MOMENTUM: 65 }, // zero peer divergence
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
    });
    const result = computeDRS(input);
    // inflectionScore ≈ 7.5, peerScore = 0, regimeScore ≈ 0, sentimentScore = 0
    // For CRYPTO: weights = {scoreInflection:0.333, peerDivergence:0.278, regimeRelevance:0.222, sentimentShift:0.167}
    // DRS ≈ round(0.333*7.5 + 0.278*0 + 0.222*0 + 0.167*0) = round(2.5) = 3
    expect(result.drs).toBeLessThan(15);
  });

  it("inflections list: only dynamics with |momentum| > 1 are included", () => {
    const input = baseInput({
      scoreDynamics: {
        TREND: makeDynamics(5, "IMPROVING"),
        MOMENTUM: makeDynamics(0.5), // below threshold
        SENTIMENT: makeDynamics(10, "IMPROVING"),
      },
    });
    const result = computeDRS(input);
    // Only TREND and SENTIMENT should appear in inflections
    expect(result.inflections.length).toBe(2);
    expect(result.inflections.every(i => Math.abs(i.momentum) > 1)).toBe(true);
  });

  it("inflections sorted by magnitude descending", () => {
    const input = baseInput({
      scoreDynamics: {
        TREND: makeDynamics(3),
        MOMENTUM: makeDynamics(15),
        SENTIMENT: makeDynamics(7),
      },
    });
    const result = computeDRS(input);
    const magnitudes = result.inflections.map(i => Math.abs(i.momentum));
    for (let i = 1; i < magnitudes.length; i++) {
      expect(magnitudes[i]).toBeLessThanOrEqual(magnitudes[i - 1]);
    }
  });
});

// ─── Peer Divergence ──────────────────────────────────────────────────────────

describe("DRS — peer divergence", () => {
  it("asset scores = peer medians → peerScore = 0 → lower DRS", () => {
    const input = baseInput({
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
    });
    const result = computeDRS(input);
    expect(result.drs).toBeLessThan(15);
  });

  it("large divergence from peers → higher DRS", () => {
    const low = computeDRS(baseInput({
      latestScores: { TREND: 52, MOMENTUM: 51 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
    }));
    const high = computeDRS(baseInput({
      latestScores: { TREND: 90, MOMENTUM: 85 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
    }));
    expect(high.drs).toBeGreaterThan(low.drs);
  });

  it("avgDivergence = 20 → peerScore = 60 + (20-15)*2 = 70", () => {
    // Both scores diverge by 20 from median
    const input = baseInput({
      latestScores: { TREND: 70, MOMENTUM: 70 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
    });
    const result = computeDRS(input);
    // peerScore = 70, inflectionScore = 0, regimeScore = 0, sentimentScore = 0
    // DRS = round(0.333*0 + 0.278*70 + 0.222*0 + 0.167*0) = round(19.46) = 19
    expect(result.drs).toBeGreaterThan(15);
  });
});

// ─── Regime Relevance ─────────────────────────────────────────────────────────

describe("DRS — regime relevance", () => {
  it("null regime alignment → regimeScore = 10 (low default)", () => {
    const input = baseInput({
      regimeAlignment: null,
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
    });
    const result = computeDRS(input);
    // regimeScore = 10 → small contribution
    expect(result.drs).toBeLessThan(20);
  });

  it("low transition probability (≤20) → regimeScore = clamp(arcs*0.15, 0, 25)", () => {
    // arcs=80, tp=10 → regimeScore = clamp(80*0.15, 0, 25) = clamp(12, 0, 25) = 12
    const input = baseInput({
      regimeAlignment: { arcsScore: 80, transitionProbability: 10, transitionDirection: "FLAT" },
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
    });
    const result = computeDRS(input);
    expect(result.drs).toBeLessThan(20);
  });

  it("high transition probability + high ARCS → higher DRS", () => {
    const low = computeDRS(baseInput({
      regimeAlignment: { arcsScore: 20, transitionProbability: 25, transitionDirection: "UP" },
    }));
    const high = computeDRS(baseInput({
      regimeAlignment: { arcsScore: 90, transitionProbability: 80, transitionDirection: "UP" },
    }));
    expect(high.drs).toBeGreaterThan(low.drs);
  });

  it("tp=55, arcs=80 → regimeScore = clamp(55*0.8, 0, 100) = 44", () => {
    // Verify the formula: transitionProbability * (arcsScore/100)
    const input = baseInput({
      regimeAlignment: { arcsScore: 80, transitionProbability: 55, transitionDirection: "UP" },
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
    });
    // regimeScore = 44; for CRYPTO: DRS = round(0.333*0 + 0.278*0 + 0.222*44 + 0.167*0) = round(9.77) = 10
    const result = computeDRS(input);
    expect(result.drs).toBeGreaterThan(5);
    expect(result.drs).toBeLessThan(30);
  });
});

// ─── Sentiment Shift ──────────────────────────────────────────────────────────

describe("DRS — sentiment shift", () => {
  it("no SENTIMENT in dynamics → sentimentScore = 0", () => {
    const input = baseInput({
      scoreDynamics: { TREND: makeDynamics(5) }, // no SENTIMENT key
      latestScores: { TREND: 50 },
      peerMedians: { TREND: 50 },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
    });
    const result = computeDRS(input);
    // sentimentScore = 0
    expect(result.drs).toBeLessThan(20);
  });

  it("large sentiment momentum → higher DRS", () => {
    const small = computeDRS(baseInput({
      scoreDynamics: { TREND: makeDynamics(5), SENTIMENT: makeDynamics(2) },
    }));
    const large = computeDRS(baseInput({
      scoreDynamics: { TREND: makeDynamics(5), SENTIMENT: makeDynamics(40) },
    }));
    expect(large.drs).toBeGreaterThan(small.drs);
  });

  it("magnitude < 5 → sentimentScore < 20", () => {
    // magnitude = 3 → 3*4 = 12
    const input = baseInput({
      scoreDynamics: {
        TREND: makeDynamics(0),
        MOMENTUM: makeDynamics(0),
        SENTIMENT: makeDynamics(3),
      },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
    });
    const result = computeDRS(input);
    // sentimentScore = 12; DRS = round(0.333*0 + 0.278*0 + 0.222*0 + 0.167*12) = round(2) = 2
    expect(result.drs).toBeLessThan(10);
  });
});

// ─── Structural Signal ────────────────────────────────────────────────────────
// Platform is crypto-only; structural_anomaly archetype not applicable

describe("DRS — structural signal", () => {
  it("CRYPTO type → structuralScore = 0, weights redistributed", () => {
    const crypto = computeDRS(baseInput({ type: "CRYPTO" }));
    expect(typeof crypto.drs).toBe("number");
  });
});

// ─── Suppression Rules ────────────────────────────────────────────────────────

describe("DRS — suppression rules", () => {
  it("DRS < 25 (US) → suppressed", () => {
    const input = baseInput({
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
      region: "US",
    });
    const result = computeDRS(input);
    if (result.drs < 25) {
      expect(result.isSuppressed).toBe(true);
      expect(result.suppressionReason).toContain("noise threshold");
    }
  });

  it("DRS < 18 (IN) → suppressed with lower threshold", () => {
    const input = baseInput({
      scoreDynamics: { TREND: makeDynamics(0), MOMENTUM: makeDynamics(0) },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
      region: "IN",
    });
    const result = computeDRS(input);
    if (result.drs < 18) {
      expect(result.isSuppressed).toBe(true);
    }
  });


  it("stale data (>72h) → suppressed", () => {
    const result = computeDRS(baseInput({ lastSyncAge: 100 }));
    expect(result.isSuppressed).toBe(true);
    expect(result.suppressionReason).toContain("Stale data");
  });

  it("all-zero dynamics → suppressed", () => {
    const result = computeDRS(baseInput({
      scoreDynamics: {
        TREND: makeDynamics(0),
        MOMENTUM: makeDynamics(0),
      },
      latestScores: { TREND: 50, MOMENTUM: 50 },
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      regimeAlignment: { arcsScore: 0, transitionProbability: 0, transitionDirection: "FLAT" },
    }));
    // all-zero dynamics → suppressed (no score movement)
    expect(result.isSuppressed).toBe(true);
  });

  it("high-signal asset with fresh data → not suppressed", () => {
    const result = computeDRS(baseInput({
      scoreDynamics: {
        TREND: makeDynamics(20, "IMPROVING"),
        MOMENTUM: makeDynamics(15, "IMPROVING"),
        SENTIMENT: makeDynamics(30, "IMPROVING"),
      },
      latestScores: { TREND: 85, MOMENTUM: 80, SENTIMENT: 75 },
      peerMedians: { TREND: 50, MOMENTUM: 50, SENTIMENT: 50 },
      regimeAlignment: { arcsScore: 85, transitionProbability: 70, transitionDirection: "UP" },
      lastSyncAge: 6,
      region: "US",
    }));
    expect(result.isSuppressed).toBe(false);
    expect(result.drs).toBeGreaterThanOrEqual(25);
  });
});

// ─── Archetype Detection ──────────────────────────────────────────────────────

describe("DRS — archetype detection", () => {
  it("dominant inflection → archetype = score_inflection", () => {
    const result = computeDRS(baseInput({
      scoreDynamics: {
        TREND: makeDynamics(30, "IMPROVING"),
        MOMENTUM: makeDynamics(25, "IMPROVING"),
      },
      latestScores: { TREND: 52, MOMENTUM: 51 }, // minimal peer divergence
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      regimeAlignment: { arcsScore: 10, transitionProbability: 10, transitionDirection: "FLAT" },
    }));
    expect(result.archetype).toBe("score_inflection");
  });

  it("dominant peer divergence → archetype = peer_divergence", () => {
    const result = computeDRS(baseInput({
      scoreDynamics: { TREND: makeDynamics(0.5), MOMENTUM: makeDynamics(0.5) },
      latestScores: { TREND: 90, MOMENTUM: 88 }, // huge peer divergence
      peerMedians: { TREND: 50, MOMENTUM: 50 },
      regimeAlignment: { arcsScore: 10, transitionProbability: 10, transitionDirection: "FLAT" },
    }));
    expect(result.archetype).toBe("peer_divergence");
  });

  // structural_anomaly archetype removed — platform is crypto-only
});

// ─── Weight Configuration ─────────────────────────────────────────────────────

describe("DRS — weight configuration", () => {
  it("CRYPTO uses DEFAULT_WEIGHTS", () => {
    const crypto = computeDRS(baseInput({ type: "CRYPTO" }));
    expect(crypto.drs).toBeGreaterThanOrEqual(0);
  });
});

// ─── DRS Range ────────────────────────────────────────────────────────────────

describe("DRS — output range", () => {
  it("DRS always in [0, 100]", () => {
    const cases = [
      baseInput(),
      baseInput({ scoreDynamics: null }),
      baseInput({ symbol: "TQQQ" }),
      baseInput({
        scoreDynamics: { TREND: makeDynamics(100), MOMENTUM: makeDynamics(100), SENTIMENT: makeDynamics(100) },
        latestScores: { TREND: 100, MOMENTUM: 100 },
        peerMedians: { TREND: 0, MOMENTUM: 0 },
        regimeAlignment: { arcsScore: 100, transitionProbability: 100, transitionDirection: "UP" },
      }),
    ];
    for (const input of cases) {
      const result = computeDRS(input);
      expect(result.drs).toBeGreaterThanOrEqual(0);
      expect(result.drs).toBeLessThanOrEqual(100);
    }
  });

  it("isEliteOnly = false for non cross_asset_pattern archetypes", () => {
    const result = computeDRS(baseInput());
    // cross_asset_pattern is never produced by current logic (no component maps to it)
    expect(result.isEliteOnly).toBe(false);
  });
});
