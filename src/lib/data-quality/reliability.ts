export type HistoryConfidenceTier = "calibrating" | "low" | "medium" | "full";

export interface HistoryConfidence {
  bars: number;
  tier: HistoryConfidenceTier;
  regimeWeight: number;
  shouldWriteScores: boolean;
}

export interface SingleSourceFieldInput<T> {
  expectedSource: string;
  source: string;
  value: T | null | undefined;
  freshnessHours: number | null;
  slaHours: number;
}

export interface SourcedField<T> {
  value: T | null;
  source: string | null;
  expectedSource: string;
  precedenceOverridden: boolean;
  freshnessHours: number | null;
  slaBreach: boolean;
  qualityTier: "primary" | "fallback_fresh" | "stale_primary" | "unavailable";
}

export interface FundamentalSourceInput<T> {
  expectedSource: string;
  primarySource: string;
  primaryValue: T | null | undefined;
  primaryUpdatedAt?: Date | string | null;
  fallbackSource: string;
  fallbackValue: T | null | undefined;
  fallbackUpdatedAt?: Date | string | null;
  slaHours?: number;
  graceMultiplier?: number;
}

function toFreshnessHours(updatedAt?: Date | string | null): number | null {
  if (!updatedAt) return null;
  const ms = new Date(updatedAt).getTime();
  if (!Number.isFinite(ms)) return null;
  return (Date.now() - ms) / (60 * 60 * 1000);
}

function hasValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function getHistoryConfidence(bars: number): HistoryConfidence {
  if (bars < 60) {
    return { bars, tier: "calibrating", regimeWeight: 0, shouldWriteScores: false };
  }
  if (bars < 120) {
    return { bars, tier: "low", regimeWeight: 0.3, shouldWriteScores: true };
  }
  if (bars < 200) {
    return { bars, tier: "medium", regimeWeight: 0.7, shouldWriteScores: true };
  }
  return { bars, tier: "full", regimeWeight: 1, shouldWriteScores: true };
}

export function resolveFundamentalField<T>(input: FundamentalSourceInput<T>): SourcedField<T> {
  const slaHours = input.slaHours ?? 24 * 7;
  const graceMultiplier = input.graceMultiplier ?? 2;
  const thresholdHours = slaHours * graceMultiplier;

  const primaryValue = input.primaryValue;
  const fallbackValue = input.fallbackValue;
  const primaryFreshness = toFreshnessHours(input.primaryUpdatedAt);
  const fallbackFreshness = toFreshnessHours(input.fallbackUpdatedAt);

  const primaryValid = hasValue(primaryValue) && primaryFreshness !== null && primaryFreshness <= thresholdHours;
  if (primaryValid) {
    const isWithinPrimarySla = primaryFreshness <= slaHours;
    return {
      value: primaryValue,
      source: input.primarySource,
      expectedSource: input.expectedSource,
      precedenceOverridden: false,
      freshnessHours: primaryFreshness,
      slaBreach: !isWithinPrimarySla,
      qualityTier: isWithinPrimarySla ? "primary" : "stale_primary",
    };
  }

  const fallbackValid = hasValue(fallbackValue) && fallbackFreshness !== null && fallbackFreshness <= thresholdHours;
  if (fallbackValid) {
    return {
      value: fallbackValue,
      source: input.fallbackSource,
      expectedSource: input.expectedSource,
      precedenceOverridden: true,
      freshnessHours: fallbackFreshness,
      slaBreach: false,
      qualityTier: "fallback_fresh",
    };
  }

  return {
    value: null,
    source: null,
    expectedSource: input.expectedSource,
    precedenceOverridden: false,
    freshnessHours: null,
    slaBreach: true,
    qualityTier: "unavailable",
  };
}

export function resolveSingleSourceField<T>(input: SingleSourceFieldInput<T>): SourcedField<T> {
  const { expectedSource, source, freshnessHours, slaHours } = input;
  const value = input.value;

  if (!hasValue(value) || freshnessHours === null) {
    return {
      value: null,
      source: null,
      expectedSource,
      precedenceOverridden: false,
      freshnessHours,
      slaBreach: true,
      qualityTier: "unavailable",
    };
  }

  const isFresh = freshnessHours <= slaHours;
  return {
    value: isFresh ? value : null,
    source: isFresh ? source : null,
    expectedSource,
    precedenceOverridden: false,
    freshnessHours,
    slaBreach: !isFresh,
    qualityTier: isFresh ? "primary" : "unavailable",
  };
}
