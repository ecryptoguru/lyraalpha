/**
 * Portfolio Fragility Engine (PFE) — Spec v1
 * Measures structural instability of a portfolio under regime deterioration.
 * Five components → composite Fragility Score (0-100).
 * Higher = more fragile. Non-predictive, deterministic, regulator-safe.
 */

import { clamp, hhi } from "./portfolio-utils";

export interface FragilityHoldingInput {
  symbol: string;
  weight: number;
  avgVolatilityScore: number | null;
  avgLiquidityScore: number | null;
  avgTrustScore: number | null;
  compatibilityScore: number | null;
  sector: string | null;
  type: string;
}

export interface FragilityComponents {
  volatilityFragility: number;
  correlationFragility: number;
  liquidityFragility: number;
  factorRotationFragility: number;
  concentrationFragility: number;
}

export interface PortfolioFragilityResult {
  fragilityScore: number;
  components: FragilityComponents;
  classification: "Robust" | "Moderate" | "Fragile" | "Structurally Fragile";
  topDrivers: string[];
}

const COMPONENT_WEIGHTS = {
  volatility: 0.25,
  correlation: 0.20,
  liquidity: 0.25,
  factorRotation: 0.15,
  concentration: 0.15,
} as const;

const REGIME_STRESS_GAMMA = 0.65;

function getClassification(score: number): PortfolioFragilityResult["classification"] {
  if (score <= 25) return "Robust";
  if (score <= 50) return "Moderate";
  if (score <= 75) return "Fragile";
  return "Structurally Fragile";
}

function computeVolatilityFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedVol = holdings.reduce((sum, h) => {
    const vol = h.avgVolatilityScore ?? 50;
    return sum + vol * h.weight;
  }, 0);

  const stressMultiplier = 1 + REGIME_STRESS_GAMMA * 0.5;
  return clamp(weightedVol * stressMultiplier);
}

function computeCorrelationFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length < 2) return 0;

  const sectorGroups: Record<string, number> = {};
  const typeGroups: Record<string, number> = {};

  for (const h of holdings) {
    const sector = h.sector ?? "Unknown";
    sectorGroups[sector] = (sectorGroups[sector] ?? 0) + h.weight;
    typeGroups[h.type] = (typeGroups[h.type] ?? 0) + h.weight;
  }

  const sectorHHI = hhi(Object.values(sectorGroups));
  const typeHHI = hhi(Object.values(typeGroups));

  const baseCorrelation = sectorHHI * 0.6 + typeHHI * 0.4;

  const stressedCorrelation = baseCorrelation + REGIME_STRESS_GAMMA * (1 - baseCorrelation);
  return clamp(stressedCorrelation * 100);
}

function computeLiquidityFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedIlliquidity = holdings.reduce((sum, h) => {
    const liquidity = h.avgLiquidityScore ?? 50;
    const illiquidity = 1 - liquidity / 100;
    const regimePenalty = 0.3 * illiquidity;
    return sum + (illiquidity + regimePenalty) * h.weight;
  }, 0);

  return clamp(weightedIlliquidity * 100);
}

function computeFactorRotationFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedMisalignment = holdings.reduce((sum, h) => {
    const compatibility = h.compatibilityScore ?? 50;
    const misalignment = 1 - compatibility / 100;
    return sum + misalignment * h.weight;
  }, 0);

  return clamp(weightedMisalignment * 100);
}

function computeConcentrationFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weights = holdings.map((h) => h.weight);
  const portfolioHHI = hhi(weights);

  return clamp(portfolioHHI * 100);
}

function getTopDrivers(components: FragilityComponents): string[] {
  const entries: [string, number][] = [
    ["Volatility Exposure", components.volatilityFragility],
    ["Correlation Convergence", components.correlationFragility],
    ["Liquidity Contraction", components.liquidityFragility],
    ["Factor Rotation Risk", components.factorRotationFragility],
    ["Concentration Risk", components.concentrationFragility],
  ];

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
}

export function computePortfolioFragility(holdings: FragilityHoldingInput[]): PortfolioFragilityResult {
  if (holdings.length === 0) {
    return {
      fragilityScore: 0,
      components: {
        volatilityFragility: 0,
        correlationFragility: 0,
        liquidityFragility: 0,
        factorRotationFragility: 0,
        concentrationFragility: 0,
      },
      classification: "Robust",
      topDrivers: [],
    };
  }

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const normalized = holdings.map((h) => ({
    ...h,
    weight: totalWeight > 0 ? h.weight / totalWeight : 1 / holdings.length,
  }));

  const volatilityFragility = computeVolatilityFragility(normalized);
  const correlationFragility = computeCorrelationFragility(normalized);
  const liquidityFragility = computeLiquidityFragility(normalized);
  const factorRotationFragility = computeFactorRotationFragility(normalized);
  const concentrationFragility = computeConcentrationFragility(normalized);

  const fragilityScore = clamp(
    volatilityFragility * COMPONENT_WEIGHTS.volatility +
    correlationFragility * COMPONENT_WEIGHTS.correlation +
    liquidityFragility * COMPONENT_WEIGHTS.liquidity +
    factorRotationFragility * COMPONENT_WEIGHTS.factorRotation +
    concentrationFragility * COMPONENT_WEIGHTS.concentration,
  );

  const components: FragilityComponents = {
    volatilityFragility: Math.round(volatilityFragility * 10) / 10,
    correlationFragility: Math.round(correlationFragility * 10) / 10,
    liquidityFragility: Math.round(liquidityFragility * 10) / 10,
    factorRotationFragility: Math.round(factorRotationFragility * 10) / 10,
    concentrationFragility: Math.round(concentrationFragility * 10) / 10,
  };

  return {
    fragilityScore: Math.round(fragilityScore * 10) / 10,
    components,
    classification: getClassification(fragilityScore),
    topDrivers: getTopDrivers(components),
  };
}
