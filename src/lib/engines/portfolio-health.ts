/**
 * Portfolio Health Engine — Spec v1
 * Deterministic, explainable, regulator-safe composite health score (0-100).
 * Five independent dimensions → weighted composite.
 * No investment advice. No predictions.
 */

import { clamp, hhi } from "./portfolio-utils";

export interface HoldingInput {
  symbol: string;
  weight: number;
  avgVolatilityScore: number | null;
  avgLiquidityScore: number | null;
  avgTrustScore: number | null;
  sector: string | null;
  type: string;
}

export interface HealthDimensions {
  diversificationScore: number;
  concentrationScore: number;
  volatilityScore: number;
  correlationScore: number;
  qualityScore: number;
}

export interface PortfolioHealthResult {
  healthScore: number;
  dimensions: HealthDimensions;
  band: "Strong" | "Balanced" | "Fragile" | "High Risk";
  holdingCount: number;
}

// ─── Local helpers ───────────────────────────────────────────────────────────

const WEIGHTS = {
  diversification: 0.25,
  concentration: 0.20,
  volatility: 0.20,
  correlation: 0.15,
  quality: 0.20,
} as const;

function getBand(score: number): PortfolioHealthResult["band"] {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Balanced";
  if (score >= 40) return "Fragile";
  return "High Risk";
}

function computeDiversificationScore(holdings: HoldingInput[]): number {
  if (holdings.length === 0) return 0;
  // A single holding is maximally undiversified.
  if (holdings.length === 1) return 0;

  const typeGroups: Record<string, number> = {};
  const sectorGroups: Record<string, number> = {};

  for (const h of holdings) {
    typeGroups[h.type] = (typeGroups[h.type] ?? 0) + h.weight;
    const sector = h.sector ?? "Unknown";
    sectorGroups[sector] = (sectorGroups[sector] ?? 0) + h.weight;
  }

  const typeWeights = Object.values(typeGroups);
  const sectorWeights = Object.values(sectorGroups);

  const typeHHI = hhi(typeWeights);
  const sectorHHI = hhi(sectorWeights);

  const typeScore = clamp((1 - typeHHI) * 100 * 1.25);
  const sectorScore = clamp((1 - sectorHHI) * 100 * 1.25);

  return clamp(typeScore * 0.6 + sectorScore * 0.4);
}

function computeConcentrationScore(holdings: HoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const sorted = [...holdings].sort((a, b) => b.weight - a.weight);
  const top1 = sorted[0]?.weight ?? 0;
  const top3 = sorted.slice(0, 3).reduce((s, h) => s + h.weight, 0);
  const top5 = sorted.slice(0, 5).reduce((s, h) => s + h.weight, 0);

  let penalty = 0;
  if (top1 > 0.25) penalty += (top1 - 0.25) * 200;
  if (top3 > 0.50) penalty += (top3 - 0.50) * 100;
  if (top5 > 0.70) penalty += (top5 - 0.70) * 60;

  return clamp(100 - penalty);
}

function computeVolatilityScore(holdings: HoldingInput[], diversificationScore: number): number {
  if (holdings.length === 0) return 0;

  const weightedVol = holdings.reduce((sum, h) => {
    const vol = h.avgVolatilityScore ?? 50;
    return sum + vol * h.weight;
  }, 0);

  let score = clamp(100 - weightedVol);

  if (diversificationScore >= 70) {
    score = clamp(score * 1.1);
  }

  return score;
}

function computeCorrelationScore(holdings: HoldingInput[]): number {
  if (holdings.length < 2) return 50;

  // Use weight-based HHI rather than count ratios so that a tiny crypto
  // position among 50 large-cap stocks does not inflate type diversity.
  const typeWeights: Record<string, number> = {};
  const sectorWeights: Record<string, number> = {};

  for (const h of holdings) {
    typeWeights[h.type] = (typeWeights[h.type] ?? 0) + h.weight;
    const sector = h.sector ?? "Unknown";
    sectorWeights[sector] = (sectorWeights[sector] ?? 0) + h.weight;
  }

  // Lower HHI = more spread = better correlation diversity.
  const typeHHI = hhi(Object.values(typeWeights));
  const sectorHHI = hhi(Object.values(sectorWeights));

  const typeScore = clamp((1 - typeHHI) * 100 * 1.4);
  const sectorScore = clamp((1 - sectorHHI) * 100 * 1.25);

  return clamp(typeScore * 0.5 + sectorScore * 0.5);
}

function computeQualityScore(holdings: HoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedQuality = holdings.reduce((sum, h) => {
    const trust = h.avgTrustScore ?? 50;
    const liquidity = h.avgLiquidityScore ?? 50;
    const composite = trust * 0.6 + liquidity * 0.4;

    let penalty = 0;
    if (h.type === "CRYPTO" && trust < 40) penalty = 10;
    if (h.type === "COMMODITY" && liquidity < 30) penalty = 5;

    return sum + (composite - penalty) * h.weight;
  }, 0);

  return clamp(weightedQuality);
}

export function computePortfolioHealth(holdings: HoldingInput[]): PortfolioHealthResult {
  if (holdings.length === 0) {
    return {
      healthScore: 0,
      dimensions: {
        diversificationScore: 0,
        concentrationScore: 0,
        volatilityScore: 0,
        correlationScore: 0,
        qualityScore: 0,
      },
      band: "High Risk",
      holdingCount: 0,
    };
  }

  const totalValue = holdings.reduce((s, h) => s + h.weight, 0);
  const normalized = holdings.map((h) => ({
    ...h,
    weight: totalValue > 0 ? h.weight / totalValue : 1 / holdings.length,
  }));

  const diversificationScore = computeDiversificationScore(normalized);
  const concentrationScore = computeConcentrationScore(normalized);
  const volatilityScore = computeVolatilityScore(normalized, diversificationScore);
  const correlationScore = computeCorrelationScore(normalized);
  const qualityScore = computeQualityScore(normalized);

  const healthScore = clamp(
    diversificationScore * WEIGHTS.diversification +
    concentrationScore * WEIGHTS.concentration +
    volatilityScore * WEIGHTS.volatility +
    correlationScore * WEIGHTS.correlation +
    qualityScore * WEIGHTS.quality,
  );

  return {
    healthScore: Math.round(healthScore * 10) / 10,
    dimensions: {
      diversificationScore: Math.round(diversificationScore * 10) / 10,
      concentrationScore: Math.round(concentrationScore * 10) / 10,
      volatilityScore: Math.round(volatilityScore * 10) / 10,
      correlationScore: Math.round(correlationScore * 10) / 10,
      qualityScore: Math.round(qualityScore * 10) / 10,
    },
    band: getBand(healthScore),
    holdingCount: holdings.length,
  };
}
