/**
 * Portfolio Fragility Engine (PFE) — Spec v1
 * Measures structural instability of a portfolio under regime deterioration.
 * Five components → composite Fragility Score (0-100).
 * Higher = more fragile. Non-predictive, deterministic, regulator-safe.
 */

import { clamp, hhi } from "./portfolio-utils";
import type { CryptoIntelligenceResult } from "./crypto-intelligence";

export interface FragilityHoldingInput {
  symbol: string;
  weight: number;
  avgVolatilityScore: number | null;
  avgLiquidityScore: number | null;
  avgTrustScore: number | null;
  compatibilityScore: number | null;
  sector: string | null;
  type: string;
  // Crypto-specific fragility signals (optional)
  dexLiquidityConcentration?: number | null; // 0-100, higher = more concentrated in one pool
  isStablecoin?: boolean;
  cryptoIntelligence?: CryptoIntelligenceResult | null;
}

export interface FragilityComponents {
  volatilityFragility: number;
  correlationFragility: number;
  liquidityFragility: number;
  factorRotationFragility: number;
  concentrationFragility: number;
  stablecoinDepegFragility: number;
}

export interface PortfolioFragilityResult {
  fragilityScore: number;
  components: FragilityComponents;
  classification: "Robust" | "Moderate" | "Fragile" | "Structurally Fragile";
  topDrivers: string[];
}

const COMPONENT_WEIGHTS = {
  volatility: 0.23,
  correlation: 0.18,
  liquidity: 0.23,
  factorRotation: 0.13,
  concentration: 0.13,
  stablecoinDepeg: 0.10,
} as const;

// Stress gamma: crypto drawdowns are deeper and faster than equities in regime shifts.
// Use higher gamma (0.85) when portfolio contains any crypto holdings.
const DEFAULT_REGIME_STRESS_GAMMA = 0.65;
const CRYPTO_REGIME_STRESS_GAMMA = 0.85;

function getClassification(score: number): PortfolioFragilityResult["classification"] {
  if (score <= 25) return "Robust";
  if (score <= 50) return "Moderate";
  if (score <= 75) return "Fragile";
  return "Structurally Fragile";
}

function hasCryptoHoldings(holdings: FragilityHoldingInput[]): boolean {
  return holdings.some((h) => h.type.toLowerCase() === "crypto");
}

function getRegimeStressGamma(holdings: FragilityHoldingInput[]): number {
  return hasCryptoHoldings(holdings) ? CRYPTO_REGIME_STRESS_GAMMA : DEFAULT_REGIME_STRESS_GAMMA;
}

function computeVolatilityFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedVol = holdings.reduce((sum, h) => {
    const vol = h.avgVolatilityScore ?? 50;
    return sum + vol * h.weight;
  }, 0);

  const gamma = getRegimeStressGamma(holdings);
  const stressMultiplier = 1 + gamma * 0.5;
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

  const gamma = getRegimeStressGamma(holdings);
  const stressedCorrelation = baseCorrelation + gamma * (1 - baseCorrelation);
  return clamp(stressedCorrelation * 100);
}

function computeLiquidityFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedIlliquidity = holdings.reduce((sum, h) => {
    const liquidity = h.avgLiquidityScore ?? 50;
    const illiquidity = 1 - liquidity / 100;
    // DEX concentration penalty: if >70% liquidity in one pool, illiquidity risk doubles
    const dexConcentration = h.dexLiquidityConcentration ?? 0;
    const dexPenalty = dexConcentration > 70 ? 0.4 : dexConcentration > 50 ? 0.2 : 0;
    const regimePenalty = 0.3 * illiquidity;
    // MEV exposure increases liquidity fragility (extraction risk during stress)
    let mevPenalty = 0;
    let unlockPenalty = 0;
    if (h.type === "CRYPTO" && h.cryptoIntelligence) {
      const sr = h.cryptoIntelligence.structuralRisk;
      const mevLevel = sr?.mevExposure?.level;
      if (mevLevel === "high" || mevLevel === "critical") mevPenalty = 0.15;
      else if (mevLevel === "moderate") mevPenalty = 0.08;
      // Unlock pressure strains liquidity as forced selling hits thin markets
      const unlockLevel = sr?.unlockPressure?.level;
      if (unlockLevel === "high" || unlockLevel === "critical") unlockPenalty = 0.12;
      else if (unlockLevel === "moderate") unlockPenalty = 0.06;
    }
    return sum + (illiquidity + regimePenalty + dexPenalty + mevPenalty + unlockPenalty) * h.weight;
  }, 0);

  return clamp(weightedIlliquidity * 100);
}

function computeStablecoinDepegFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const stablecoinWeight = holdings.reduce((sum, h) => {
    const isStable = h.isStablecoin ?? false;
    return sum + (isStable ? h.weight : 0);
  }, 0);

  // Algorithmic / low-cap stablecoins carry depeg risk
  const lowCapStableWeight = holdings.reduce((sum, h) => {
    const isLowCap = h.isStablecoin && (h.avgLiquidityScore ?? 50) < 60;
    return sum + (isLowCap ? h.weight : 0);
  }, 0);

  // Base depeg fragility from stablecoin exposure
  let fragility = stablecoinWeight * 30; // up to 30 points for 100% stablecoins

  // Additional penalty for low-liquidity stables (algorithmic, small-cap)
  fragility += lowCapStableWeight * 50;

  return clamp(fragility);
}

function computeFactorRotationFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weightedMisalignment = holdings.reduce((sum, h) => {
    const compatibility = h.compatibilityScore ?? 50;
    const misalignment = 1 - compatibility / 100;
    // Bridge dependency makes it harder to rotate out during cross-chain stress
    let bridgePenalty = 0;
    if (h.type === "CRYPTO" && h.cryptoIntelligence) {
      const sr = h.cryptoIntelligence.structuralRisk;
      const bridgeLevel = sr?.bridgeDependency?.level;
      if (bridgeLevel === "high" || bridgeLevel === "critical") bridgePenalty = 0.1;
      else if (bridgeLevel === "moderate") bridgePenalty = 0.05;
    }
    return sum + (misalignment + bridgePenalty) * h.weight;
  }, 0);

  return clamp(weightedMisalignment * 100);
}

function computeConcentrationFragility(holdings: FragilityHoldingInput[]): number {
  if (holdings.length === 0) return 0;

  const weights = holdings.map((h) => h.weight);
  const portfolioHHI = hhi(weights);

  // On-chain holder concentration amplifies fragility for crypto assets
  let holderPenalty = 0;
  for (const h of holdings) {
    if (h.type === "CRYPTO" && h.cryptoIntelligence) {
      const hs = h.cryptoIntelligence.holderStability;
      if (hs) {
        const supplyConc = hs.supplyConcentration;
        if (typeof supplyConc === "number" && supplyConc < 30) holderPenalty += 5 * h.weight;
        else if (typeof supplyConc === "number" && supplyConc < 50) holderPenalty += 2.5 * h.weight;
      }
    }
  }

  return clamp(portfolioHHI * 100 + holderPenalty);
}

function getTopDrivers(components: FragilityComponents): string[] {
  const entries: [string, number][] = [
    ["Volatility Exposure", components.volatilityFragility],
    ["Correlation Convergence", components.correlationFragility],
    ["Liquidity Contraction", components.liquidityFragility],
    ["Factor Rotation Risk", components.factorRotationFragility],
    ["Concentration Risk", components.concentrationFragility],
    ["Stablecoin Depeg Risk", components.stablecoinDepegFragility],
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
        stablecoinDepegFragility: 0,
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
  const stablecoinDepegFragility = computeStablecoinDepegFragility(normalized);

  const fragilityScore = clamp(
    volatilityFragility * COMPONENT_WEIGHTS.volatility +
    correlationFragility * COMPONENT_WEIGHTS.correlation +
    liquidityFragility * COMPONENT_WEIGHTS.liquidity +
    factorRotationFragility * COMPONENT_WEIGHTS.factorRotation +
    concentrationFragility * COMPONENT_WEIGHTS.concentration +
    stablecoinDepegFragility * COMPONENT_WEIGHTS.stablecoinDepeg,
  );

  const components: FragilityComponents = {
    volatilityFragility: Math.round(volatilityFragility * 10) / 10,
    correlationFragility: Math.round(correlationFragility * 10) / 10,
    liquidityFragility: Math.round(liquidityFragility * 10) / 10,
    factorRotationFragility: Math.round(factorRotationFragility * 10) / 10,
    concentrationFragility: Math.round(concentrationFragility * 10) / 10,
    stablecoinDepegFragility: Math.round(stablecoinDepegFragility * 10) / 10,
  };

  return {
    fragilityScore: Math.round(fragilityScore * 10) / 10,
    components,
    classification: getClassification(fragilityScore),
    topDrivers: getTopDrivers(components),
  };
}
