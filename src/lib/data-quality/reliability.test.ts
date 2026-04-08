import { describe, expect, it, vi, afterEach } from "vitest";
import { getHistoryConfidence, resolveFundamentalField, resolveSingleSourceField } from "@/lib/data-quality/reliability";

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

describe("resolveFundamentalField", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps primary in primary tier when within 7d SLA", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const resolved = resolveFundamentalField({
      expectedSource: "finnhub",
      primarySource: "finnhub",
      primaryValue: 18.2,
      primaryUpdatedAt: "2026-02-10T00:00:00.000Z",
      fallbackSource: "yahoo",
      fallbackValue: 17.9,
      fallbackUpdatedAt: "2026-02-13T00:00:00.000Z",
      slaHours: 24 * 7,
      graceMultiplier: 2,
    });

    expect(resolved.source).toBe("finnhub");
    expect(resolved.qualityTier).toBe("primary");
    expect(resolved.precedenceOverridden).toBe(false);
    expect(resolved.slaBreach).toBe(false);
  });

  it("keeps stale_primary when within grace but over base SLA", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const resolved = resolveFundamentalField({
      expectedSource: "finnhub",
      primarySource: "finnhub",
      primaryValue: 12,
      primaryUpdatedAt: "2026-02-05T00:00:00.000Z", // 9 days old
      fallbackSource: "yahoo",
      fallbackValue: 11.8,
      fallbackUpdatedAt: "2026-02-13T00:00:00.000Z",
      slaHours: 24 * 7,
      graceMultiplier: 2,
    });

    expect(resolved.source).toBe("finnhub");
    expect(resolved.qualityTier).toBe("stale_primary");
    expect(resolved.slaBreach).toBe(true);
  });

  it("falls back to yahoo when primary breaches 14d threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const resolved = resolveFundamentalField({
      expectedSource: "finnhub",
      primarySource: "finnhub",
      primaryValue: 22,
      primaryUpdatedAt: "2026-01-20T00:00:00.000Z", // >14 days old
      fallbackSource: "yahoo",
      fallbackValue: 21,
      fallbackUpdatedAt: "2026-02-10T00:00:00.000Z",
      slaHours: 24 * 7,
      graceMultiplier: 2,
    });

    expect(resolved.source).toBe("yahoo");
    expect(resolved.precedenceOverridden).toBe(true);
    expect(resolved.qualityTier).toBe("fallback_fresh");
    expect(resolved.value).toBe(21);
  });

  it("returns unavailable when all sources are stale or missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const resolved = resolveFundamentalField({
      expectedSource: "finnhub",
      primarySource: "finnhub",
      primaryValue: 22,
      primaryUpdatedAt: "2026-01-10T00:00:00.000Z",
      fallbackSource: "yahoo",
      fallbackValue: null,
      fallbackUpdatedAt: "2026-01-10T00:00:00.000Z",
      slaHours: 24 * 7,
      graceMultiplier: 2,
    });

    expect(resolved.qualityTier).toBe("unavailable");
    expect(resolved.value).toBeNull();
    expect(resolved.slaBreach).toBe(true);
  });
});
