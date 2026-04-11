import { describe, expect, it } from "vitest";
import { getHistoryConfidence, resolveSingleSourceField } from "@/lib/data-quality/reliability";

describe("getHistoryConfidence", () => {
  it("returns calibrating for <60 bars", () => {
    expect(getHistoryConfidence(45)).toEqual({
      bars: 45,
      tier: "calibrating",
      regimeWeight: 0,
      shouldWriteScores: false,
    });
  });

  it("returns low for 60-119 bars", () => {
    const result = getHistoryConfidence(90);
    expect(result.tier).toBe("low");
    expect(result.regimeWeight).toBe(0.3);
    expect(result.shouldWriteScores).toBe(true);
  });

  it("returns medium for 120-199 bars", () => {
    const result = getHistoryConfidence(150);
    expect(result.tier).toBe("medium");
    expect(result.regimeWeight).toBe(0.7);
    expect(result.shouldWriteScores).toBe(true);
  });

  it("returns full for >=200 bars", () => {
    const result = getHistoryConfidence(250);
    expect(result.tier).toBe("full");
    expect(result.regimeWeight).toBe(1);
    expect(result.shouldWriteScores).toBe(true);
  });
});

describe("resolveSingleSourceField", () => {
  it("returns primary when value exists and freshness is within SLA", () => {
    const result = resolveSingleSourceField({
      expectedSource: "coingecko",
      source: "coingecko",
      value: 123,
      freshnessHours: 2,
      slaHours: 6,
    });

    expect(result.qualityTier).toBe("primary");
    expect(result.value).toBe(123);
    expect(result.slaBreach).toBe(false);
  });

  it("returns unavailable when source is stale", () => {
    const result = resolveSingleSourceField({
      expectedSource: "coingecko",
      source: "coingecko",
      value: 123,
      freshnessHours: 10,
      slaHours: 6,
    });

    expect(result.qualityTier).toBe("unavailable");
    expect(result.value).toBeNull();
    expect(result.slaBreach).toBe(true);
  });
});
