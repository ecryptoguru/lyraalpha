/**
 * Portfolio Health Engine — Spec v1
 * Deterministic, explainable, regulator-safe composite health score (0-100).
 * Five independent dimensions → weighted composite.
 * No investment advice. No predictions.
 */

import { clamp, hhi } from "./portfolio-utils";
import type { CryptoIntelligenceResult } from "./crypto-intelligence";

export interface HoldingInput {
  symbol: string;
  weight: number;
  avgVolatilityScore: number | null;
  avgLiquidityScore: number | null;
  avgTrustScore: number | null;
  sector: string | null;
  type: string;
  cryptoIntelligence?: CryptoIntelligenceResult | null;
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

// Crypto-native diversification buckets — maps common sector names to functional categories
const CRYPTO_BUCKETS: Record<string, string> = {
  "layer 1": "l1",
  "smart contract": "l1",
  "defi": "defi",
  "dex": "defi",
  "infrastructure": "infra",
  "oracle": "infra",
  "bridge": "infra",
  "interoperability": "infra",
  "meme": "meme",
  "stablecoin": "stable",
  "store of value": "sov",
};

function getCryptoBucket(sector: string | null, symbol: string): string {
  if (!sector) {
    // Fallback: infer from symbol for known assets
    const s = symbol.toUpperCase();
    if (s === "BTC-USD" || s === "BTC") return "sov";
    if (s === "ETH-USD" || s === "ETH") return "l1";
    if (s.startsWith("USDT") || s.startsWith("USDC") || s.startsWith("DAI")) return "stable";
    return "other";
  }
  const key = sector.toLowerCase();
  for (const [prefix, bucket] of Object.entries(CRYPTO_BUCKETS)) {
    if (key.includes(prefix)) return bucket;
  }
  return "other";
}

function computeDiversificationScore(holdings: HoldingInput[]): number {
  if (holdings.length === 0) return 0;
  // A single holding is maximally undiversified.
  if (holdings.length === 1) return 0;

  const isAllCrypto = holdings.every((h) => h.type === "CRYPTO");

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

  let typeScore = clamp((1 - typeHHI) * 100 * 1.25);
  let sectorScore = clamp((1 - sectorHHI) * 100 * 1.25);

  // For crypto-only portfolios, use crypto-native buckets AND apply BTC-beta penalty
  if (isAllCrypto) {
    const bucketGroups: Record<string, number> = {};
    for (const h of holdings) {
      const bucket = getCryptoBucket(h.sector, h.symbol);
      bucketGroups[bucket] = (bucketGroups[bucket] ?? 0) + h.weight;
    }
    const bucketWeights = Object.values(bucketGroups);
    const bucketHHI = hhi(bucketWeights);
    // Crypto bucket score is tighter: max 90 even for perfect spread (crypto correlations are high)
    const bucketScore = clamp((1 - bucketHHI) * 100 * 1.15);
    sectorScore = Math.min(sectorScore, bucketScore);

    // BTC-beta penalty: if >60% weight is in assets historically correlated to BTC,
    // diversification is illusory. Apply penalty proportional to BTC-correlated weight.
    const btcCorrelatedWeight = holdings.reduce((sum, h) => {
      // BTC itself, L1s, and most altcoins are BTC-beta correlated
      const bucket = getCryptoBucket(h.sector, h.symbol);
      const isBtcCorrelated = bucket !== "stable" && bucket !== "sov";
      return sum + (isBtcCorrelated ? h.weight : 0);
    }, 0);
    if (btcCorrelatedWeight > 0.6) {
      const penalty = (btcCorrelatedWeight - 0.6) * 80; // up to 32 points penalty
      typeScore = clamp(typeScore - penalty);
      sectorScore = clamp(sectorScore - penalty);
    }
  }

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

  const isAllCrypto = holdings.every((h) => h.type === "CRYPTO");

  // Use weight-based HHI rather than count ratios so that a tiny crypto
  // position among 50 large-cap crypto assets does not inflate type diversity.
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

  let typeScore = clamp((1 - typeHHI) * 100 * 1.4);
  let sectorScore = clamp((1 - sectorHHI) * 100 * 1.25);

  // For crypto-only portfolios, compute correlation from crypto buckets.
  // Most crypto assets (L1, DeFi, infra, meme) are 0.7-0.95 correlated to BTC.
  // Only stablecoins and BTC itself provide genuine decorrelation.
  if (isAllCrypto) {
    const bucketWeights: Record<string, number> = {};
    for (const h of holdings) {
      const bucket = getCryptoBucket(h.sector, h.symbol);
      bucketWeights[bucket] = (bucketWeights[bucket] ?? 0) + h.weight;
    }
    const bucketHHI = hhi(Object.values(bucketWeights));
    // Cap crypto correlation diversity at 70: even a perfectly spread crypto portfolio
    // has ~0.85 average pairwise correlation during stress.
    const bucketScore = clamp((1 - bucketHHI) * 100 * 1.4);
    sectorScore = Math.min(sectorScore, bucketScore, 70);

    // If portfolio contains no stablecoins and no BTC, correlation is structurally high
    const hasStable = Object.keys(bucketWeights).includes("stable");
    const hasSov = Object.keys(bucketWeights).includes("sov");
    if (!hasStable && !hasSov) {
      typeScore = clamp(typeScore * 0.75); // penalize further
    }
  }

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

    // Phase-1: incorporate crypto-intelligence structural risk into quality
    if (h.type === "CRYPTO" && h.cryptoIntelligence) {
      const ci = h.cryptoIntelligence;
      if (ci.structuralRisk) {
        const unlockLevel = ci.structuralRisk.unlockPressure?.level;
        if (unlockLevel === "high" || unlockLevel === "critical") penalty += 8;
        else if (unlockLevel === "moderate") penalty += 4;

        const bridgeLevel = ci.structuralRisk.bridgeDependency?.level;
        if (bridgeLevel === "high" || bridgeLevel === "critical") penalty += 4;
        else if (bridgeLevel === "moderate") penalty += 2;
      }
      // Holder concentration penalty: supplyConcentration is already inverted
      // (higher = more distributed). If very low, it implies whale concentration.
      if (ci.holderStability && ci.holderStability.supplyConcentration < 30) {
        penalty += 5;
      }
    }

    return sum + clamp(composite - penalty, 0, 100) * h.weight;
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
