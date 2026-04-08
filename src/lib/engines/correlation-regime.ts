/**
 * Correlation Regime Engine (Phase 1)
 * Analyzes cross-asset correlations to detect systemic vs idiosyncratic market conditions
 */

import { prisma } from "../prisma";
import { Asset } from "@/generated/prisma/client";

export type CorrelationRegime =
  | "SYSTEMIC_STRESS" // High correlation + high volatility
  | "MACRO_DRIVEN" // High correlation + stable
  | "IDIOSYNCRATIC" // Low correlation
  | "TRANSITIONING" // Rising correlation
  | "NORMAL"; // Moderate correlation

export interface CorrelationMetrics {
  avgCorrelation: number; // Average pairwise correlation
  dispersion: number; // Standard deviation of correlations
  trend: "RISING" | "STABLE" | "FALLING";
  regime: CorrelationRegime;
  confidence: "low" | "medium" | "high";
  implications: string;
}

export interface SectorCorrelationScore {
  sectorId: string;
  avgSectorCorrelation: number; // How correlated is stock to sector peers
  isPurePlay: boolean; // High correlation = pure play
  idiosyncraticScore: number; // Low correlation = idiosyncratic
}

// Global correlation cache (Regime changes slowly, no need for per-request calc)
let CORRELATION_METRICS_CACHE: { data: CorrelationMetrics; timestamp: number } | null = null;
const CORR_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Calculate correlation regime from asset correlation data.
 * Uses current pairwise correlations from Asset.correlationData and
 * compares against historical MarketRegime snapshots for trend detection.
 */
export async function calculateCorrelationRegime(
  assets?: Asset[],
): Promise<CorrelationMetrics> {
  const isGlobal = !assets;

  // Use cache if global request (no specific assets passed)
  if (isGlobal && CORRELATION_METRICS_CACHE && (Date.now() - CORRELATION_METRICS_CACHE.timestamp < CORR_CACHE_TTL)) {
    return CORRELATION_METRICS_CACHE.data;
  }

  const BASELINE: CorrelationMetrics = {
    avgCorrelation: 0.45,
    dispersion: 0.18,
    trend: "STABLE",
    regime: "NORMAL",
    confidence: "low",
    implications: "Baseline estimates. Correlation data will refine as more market data syncs.",
  };

  // If no assets provided, fetch top 100 by market cap
  if (!assets) {
    assets = await prisma.asset.findMany({
      where: {
        correlationData: { not: null as never },
        type: "STOCK",
      },
      take: 100,
      orderBy: { lastPriceUpdate: "desc" },
    });
  }

  if (assets.length < 2) return BASELINE;

  // Extract all pairwise correlations
  const correlations: number[] = [];

  for (const asset of assets) {
    if (!asset.correlationData || typeof asset.correlationData !== "object")
      continue;

    const corrData = asset.correlationData as Record<string, number>;
    Object.values(corrData).forEach((corr) => {
      if (typeof corr === "number" && !isNaN(corr)) {
        correlations.push(Math.abs(corr));
      }
    });
  }

  if (correlations.length === 0) return BASELINE;

  // Calculate metrics
  const avgCorrelation =
    correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
  const dispersion = calculateStandardDeviation(correlations);

  // ─── Trend detection from historical MarketRegime snapshots ────────
  let trend: "RISING" | "STABLE" | "FALLING" = "STABLE";
  try {
    const pastRegimes = await prisma.marketRegime.findMany({
      where: { correlationMetrics: { not: null as never } },
      orderBy: { date: "desc" },
      take: 7,
      select: { correlationMetrics: true },
    });

    if (pastRegimes.length >= 3) {
      const pastCorrs = pastRegimes
        .map(r => {
          const m = r.correlationMetrics as Record<string, unknown> | null;
          return typeof m?.avgCorrelation === "number" ? m.avgCorrelation : null;
        })
        .filter((v): v is number => v !== null);

      if (pastCorrs.length >= 3) {
        const recentAvg = pastCorrs.slice(0, Math.ceil(pastCorrs.length / 2))
          .reduce((s, v) => s + v, 0) / Math.ceil(pastCorrs.length / 2);
        const olderAvg = pastCorrs.slice(Math.ceil(pastCorrs.length / 2))
          .reduce((s, v) => s + v, 0) / (pastCorrs.length - Math.ceil(pastCorrs.length / 2));
        const delta = recentAvg - olderAvg;
        if (delta > 0.05) trend = "RISING";
        else if (delta < -0.05) trend = "FALLING";
      }
    }
  } catch { /* non-critical — fall back to STABLE */ }

  // ─── Regime classification (with SYSTEMIC_STRESS detection) ────────
  let regime: CorrelationRegime = "NORMAL";
  let implications = "";

  // Fetch current volatility state for SYSTEMIC_STRESS detection
  let isHighVol = false;
  try {
    const latestRegime = await prisma.marketRegime.findFirst({
      orderBy: { date: "desc" },
      select: { context: true },
    });
    if (latestRegime?.context) {
      const ctx = JSON.parse(latestRegime.context);
      const volLabel = ctx?.volatility?.label;
      isHighVol = volLabel === "STRESS" || volLabel === "ELEVATED";
    }
  } catch { /* non-critical */ }

  if (avgCorrelation > 0.7 && isHighVol) {
    regime = "SYSTEMIC_STRESS";
    implications =
      "Extremely high correlation with elevated volatility. Systemic stress detected — diversification benefits severely reduced.";
  } else if (avgCorrelation > 0.7) {
    regime = "MACRO_DRIVEN";
    implications =
      "High correlation suggests macro forces dominating. Sector selection less important; focus on market timing.";
  } else if (avgCorrelation < 0.3) {
    regime = "IDIOSYNCRATIC";
    implications =
      "Low correlation indicates stock-specific dynamics. Sector selection and stock-picking critical.";
  } else if (trend === "RISING" && avgCorrelation > 0.45) {
    regime = "TRANSITIONING";
    implications =
      "Correlations rising toward macro-driven territory. Monitor for regime shift.";
  } else if (dispersion > 0.25) {
    regime = "TRANSITIONING";
    implications =
      "High correlation dispersion suggests regime transition. Monitor for directional clarity.";
  } else {
    regime = "NORMAL";
    implications =
      "Moderate correlation environment. Balanced approach to macro and micro factors.";
  }

  // Confidence based on data quality
  const confidence: "low" | "medium" | "high" =
    correlations.length > 1000
      ? "high"
      : correlations.length > 500
        ? "medium"
        : "low";

  const result: CorrelationMetrics = {
    avgCorrelation: Math.round(avgCorrelation * 100) / 100,
    dispersion: Math.round(dispersion * 100) / 100,
    trend,
    regime,
    confidence,
    implications,
  };

  // Cache global results
  if (isGlobal) {
    CORRELATION_METRICS_CACHE = { data: result, timestamp: Date.now() };
  }

  return result;
}

/**
 * Calculate sector-specific correlation score for a stock
 */
export async function calculateSectorCorrelationScore(
  assetId: string,
  sectorId: string,
): Promise<SectorCorrelationScore | null> {
  // Get the asset
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { correlationData: true, symbol: true },
  });

  if (!asset || !asset.correlationData) {
    return null;
  }

  // Get sector peers
  const sectorPeers = await prisma.stockSector.findMany({
    where: { sectorId, isActive: true, assetId: { not: assetId } },
    include: { asset: { select: { symbol: true } } },
    take: 50,
  });

  if (sectorPeers.length === 0) {
    return null;
  }

  // Extract correlations to sector peers
  const corrData = asset.correlationData as Record<string, number>;
  const sectorCorrelations: number[] = [];

  for (const peer of sectorPeers) {
    const corr = corrData[peer.asset.symbol];
    if (typeof corr === "number" && !isNaN(corr)) {
      sectorCorrelations.push(Math.abs(corr));
    }
  }

  if (sectorCorrelations.length === 0) {
    return null;
  }

  const avgSectorCorrelation =
    sectorCorrelations.reduce((sum, c) => sum + c, 0) /
    sectorCorrelations.length;

  // Classification
  const isPurePlay = avgSectorCorrelation > 0.7;
  const idiosyncraticScore = (1 - avgSectorCorrelation) * 100;

  return {
    sectorId,
    avgSectorCorrelation: Math.round(avgSectorCorrelation * 100) / 100,
    isPurePlay,
    idiosyncraticScore: Math.round(idiosyncraticScore),
  };
}

/**
 * Detect correlation-based regime warnings
 */
export async function detectCorrelationWarnings(): Promise<{
  hasWarning: boolean;
  warningType?: "SYSTEMIC_STRESS" | "CORRELATION_SPIKE" | "BREAKDOWN";
  message?: string;
}> {
  const metrics = await calculateCorrelationRegime();

  // Warning: Very high correlation (potential systemic stress)
  if (metrics.avgCorrelation > 0.8) {
    return {
      hasWarning: true,
      warningType: "SYSTEMIC_STRESS",
      message:
        "Extremely high cross-asset correlation detected. Diversification benefits reduced. Potential systemic stress.",
    };
  }

  // Warning: Rising correlation (regime transition)
  if (metrics.trend === "RISING" && metrics.avgCorrelation > 0.6) {
    return {
      hasWarning: true,
      warningType: "CORRELATION_SPIKE",
      message:
        "Correlation rising rapidly. Potential regime transition ahead. Monitor for volatility spike.",
    };
  }

  // Warning: Correlation breakdown (unusual)
  if (metrics.avgCorrelation < 0.2 && metrics.dispersion > 0.3) {
    return {
      hasWarning: true,
      warningType: "BREAKDOWN",
      message:
        "Correlation structure breaking down. Unusual market conditions. Exercise caution.",
    };
  }

  return { hasWarning: false };
}

/**
 * Store correlation metrics in MarketRegime
 */
export async function storeCorrelationMetrics(): Promise<void> {
  const metrics = await calculateCorrelationRegime();

  // Get latest market regime
  const latestRegime = await prisma.marketRegime.findFirst({
    orderBy: { date: "desc" },
  });

  if (latestRegime) {
    await prisma.marketRegime.update({
      where: { id: latestRegime.id },
      data: {
        correlationMetrics: metrics as never,
      },
    });
  }
}

/**
 * Helper: Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate correlation matrix for a set of assets
 */
export async function calculateCorrelationMatrix(
  assetSymbols: string[],
): Promise<Record<string, Record<string, number>>> {
  const assets = await prisma.asset.findMany({
    where: { symbol: { in: assetSymbols } },
    select: { symbol: true, correlationData: true },
  });

  const matrix: Record<string, Record<string, number>> = {};

  for (const asset of assets) {
    if (!asset.correlationData) continue;

    const corrData = asset.correlationData as Record<string, number>;
    matrix[asset.symbol] = {};

    for (const otherSymbol of assetSymbols) {
      if (otherSymbol === asset.symbol) {
        matrix[asset.symbol][otherSymbol] = 1.0;
      } else {
        matrix[asset.symbol][otherSymbol] = corrData[otherSymbol] || 0;
      }
    }
  }

  return matrix;
}
