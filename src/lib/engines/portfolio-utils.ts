/**
 * Shared utilities for portfolio intelligence engines.
 * Centralises clamp, regime formatting, risk-metric parsing, and share-text
 * normalisation so none of these are duplicated across engines and services.
 */

import type { PortfolioIntelligenceBand } from "./portfolio-intelligence";

// ─── Math helpers ────────────────────────────────────────────────────────────

/** Clamp `value` to [min, max]. */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/** Clamp to the 0-10 engine scoring range. */
export function clamp10(value: number): number {
  return Math.max(0, Math.min(10, value));
}

/** Herfindahl–Hirschman Index for a weight array. */
export function hhi(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w * w, 0);
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** "RISK_ON" → "risk on" */
export function formatRegime(regime: string | null | undefined): string | null {
  if (!regime) return null;
  return regime.replace(/_/g, " ").toLowerCase();
}

/** "7.4" → "7.4 / 10" */
export function formatScore10(score: number): string {
  return `${score.toFixed(1)} / 10`;
}

/** Collapse internal whitespace and strip leading/trailing space. */
export function normalizeShareText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ─── Risk-metric extraction ───────────────────────────────────────────────────

export interface ParsedRiskMetrics {
  averageCompatibilityScore: number | null;
  weakCompatibilityCount: number;
  topCompatibilityDrag: string[];
  regimeMismatchLabel: string | null;
  regimeMismatchReason: string | null;
  currentMarketRegime: string | null;
  dominantSector: string | null;
  concentrationWeight: number | null;
  portfolioScore: number | null;
  portfolioScoreBand: PortfolioIntelligenceBand | null;
  portfolioScoreHeadline: string | null;
  portfolioScoreBody: string | null;
  portfolioScoreAction: string | null;
}

export interface ParsedRiskMetricsWithFragility extends ParsedRiskMetrics {
  fragilityTopDrivers: string[];
}

function safeString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function safeNumber(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function safeStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

export function parseRiskMetrics(metrics: unknown): ParsedRiskMetrics {
  const data = metrics as Record<string, unknown> | null | undefined;

  return {
    averageCompatibilityScore: safeNumber(data?.averageCompatibilityScore),
    weakCompatibilityCount: safeNumber(data?.weakCompatibilityCount) ?? 0,
    topCompatibilityDrag: safeStringArray(data?.topCompatibilityDrag),
    regimeMismatchLabel: safeString(data?.regimeMismatchLabel),
    regimeMismatchReason: safeString(data?.regimeMismatchReason),
    currentMarketRegime: safeString(data?.currentMarketRegime),
    dominantSector: safeString(data?.dominantSector),
    concentrationWeight: safeNumber(data?.concentrationWeight),
    portfolioScore: safeNumber(data?.portfolioScore),
    portfolioScoreBand: safeString(data?.portfolioScoreBand) as PortfolioIntelligenceBand | null,
    portfolioScoreHeadline: safeString(data?.portfolioScoreHeadline),
    portfolioScoreBody: safeString(data?.portfolioScoreBody),
    portfolioScoreAction: safeString(data?.portfolioScoreAction),
  };
}

export function parseRiskMetricsWithFragility(metrics: unknown): ParsedRiskMetricsWithFragility {
  const base = parseRiskMetrics(metrics);
  const data = metrics as Record<string, unknown> | null | undefined;
  return {
    ...base,
    fragilityTopDrivers: safeStringArray(data?.fragilityTopDrivers),
  };
}
