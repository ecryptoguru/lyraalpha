/**
 * Discovery Relevance Score (DRS) Engine — Phase 2.3
 *
 * Computes a 0-100 relevance score per asset to surface what deserves attention.
 * Formula: DRS = w1·ScoreInflection + w2·PeerDivergence + w3·RegimeRelevance + w4·SentimentShift + w5·StructuralSignal
 *
 * Key decisions:
 * - ScoreInflection reads from scoreDynamics.momentum (not raw AssetScore rows)
 * - SentimentShift uses SENTIMENT engine score delta from scoreDynamics
 * - StructuralSignal gated by type: ETF uses etfLookthrough, others weight=0 (redistributed)
 * - Graceful degradation when data is sparse
 */

import type { AssetType } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DiscoveryArchetype =
  | "score_inflection"
  | "peer_divergence"
  | "regime_sensitive"
  | "sentiment_shift"
  | "structural_anomaly"
  | "cross_asset_pattern";

export interface ScoreInflection {
  scoreType: string;
  momentum: number;
  trend: string;
  percentileRank: number;
}

export interface DRSResult {
  assetId: string;
  symbol: string;
  name: string;
  type: AssetType;
  drs: number;
  archetype: DiscoveryArchetype;
  headline: string;
  context: string;
  inflections: ScoreInflection[];
  isEliteOnly: boolean;
  isSuppressed: boolean;
  suppressionReason?: string;
}

export interface ScoreDynamicsEntry {
  momentum: number;
  acceleration: number;
  trend: string;
  percentileRank: number;
  sectorPercentile: number;
  volatility: number;
}

export interface DRSInput {
  assetId: string;
  symbol: string;
  name: string;
  type: AssetType;
  region?: string | null;
  scoreDynamics: Record<string, ScoreDynamicsEntry> | null;
  latestScores: Record<string, number>;
  peerMedians: Record<string, number>;
  regimeAlignment: { arcsScore: number; transitionProbability: number; transitionDirection: string } | null;
  etfLookthrough: { concentration?: { hhi: number; level: string }; lookthroughScores?: { matchRate: number } } | null;
  signalStrength: { score: number; label: string } | null;
  lastSyncAge: number;
}

// ─── Weight Configuration ───────────────────────────────────────────────────

interface WeightConfig {
  scoreInflection: number;
  peerDivergence: number;
  regimeRelevance: number;
  sentimentShift: number;
  structuralSignal: number;
}

const DEFAULT_WEIGHTS: WeightConfig = {
  scoreInflection: 0.30,
  peerDivergence: 0.25,
  regimeRelevance: 0.20,
  sentimentShift: 0.15,
  structuralSignal: 0.10,
};

function getWeightsForType(type: AssetType): WeightConfig {
  // ETFs have structural signal from lookthrough; others redistribute to other components
  if (type === "ETF") return DEFAULT_WEIGHTS;

  // No structural signal for non-ETF types — redistribute 0.10 proportionally
  return {
    scoreInflection: 0.333,
    peerDivergence: 0.278,
    regimeRelevance: 0.222,
    sentimentShift: 0.167,
    structuralSignal: 0.0,
  };
}

// ─── Suppression Lists ──────────────────────────────────────────────────────


// ─── Component Calculators ──────────────────────────────────────────────────

/**
 * Score Inflection: magnitude of score changes across all engines.
 * Reads from scoreDynamics.momentum (pre-computed 1-week delta).
 */
function computeScoreInflection(
  scoreDynamics: DRSInput["scoreDynamics"],
): { score: number; inflections: ScoreInflection[] } {
  if (!scoreDynamics || Object.keys(scoreDynamics).length === 0) {
    return { score: 0, inflections: [] };
  }

  const entries = Object.entries(scoreDynamics);
  const inflections: ScoreInflection[] = [];
  let totalMagnitude = 0;

  for (const [scoreType, dynamics] of entries) {
    const magnitude = Math.abs(dynamics.momentum);
    totalMagnitude += magnitude;

    if (magnitude > 1) {
      inflections.push({
        scoreType,
        momentum: dynamics.momentum,
        trend: dynamics.trend,
        percentileRank: dynamics.percentileRank,
      });
    }
  }

  // Average absolute momentum across engines, normalized to 0-100
  // Actual data: p50=0.44, p75=3.9, p90=30, max=70
  // Use logarithmic scaling: small moves still register, large moves don't all saturate
  const avgMagnitude = totalMagnitude / entries.length;
  const score = avgMagnitude <= 0 ? 0
    : avgMagnitude < 1 ? avgMagnitude * 15          // 0-1 → 0-15 (noise zone)
    : avgMagnitude < 5 ? 15 + (avgMagnitude - 1) * 10  // 1-5 → 15-55 (meaningful)
    : avgMagnitude < 30 ? 55 + (avgMagnitude - 5) * 1.2 // 5-30 → 55-85 (strong)
    : clamp(85 + (avgMagnitude - 30) * 0.375, 85, 100); // 30+ → 85-100 (extreme)

  // Sort inflections by magnitude descending
  inflections.sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum));

  return { score, inflections };
}

/**
 * Peer Divergence: how far this asset's scores deviate from type median.
 * Uses z-score approach: (asset_score - peer_median) / expected_spread.
 */
function computePeerDivergence(
  latestScores: Record<string, number>,
  peerMedians: Record<string, number>,
): number {
  const scoreTypes = Object.keys(latestScores).filter((k) => k in peerMedians);
  if (scoreTypes.length === 0) return 0;

  let totalDivergence = 0;
  for (const type of scoreTypes) {
    const diff = Math.abs(latestScores[type] - peerMedians[type]);
    // Normalize: 20-point divergence = high signal
    totalDivergence += diff;
  }

  // Actual data: avg divergence 7-35 points depending on engine
  // 10-point divergence = moderate (50), 25+ = strong (80+)
  const avgDivergence = totalDivergence / scoreTypes.length;
  return avgDivergence <= 0 ? 0
    : avgDivergence < 5 ? avgDivergence * 4            // 0-5 → 0-20 (noise)
    : avgDivergence < 15 ? 20 + (avgDivergence - 5) * 4 // 5-15 → 20-60 (moderate)
    : avgDivergence < 30 ? 60 + (avgDivergence - 15) * 2 // 15-30 → 60-90 (strong)
    : clamp(90 + (avgDivergence - 30) * 0.5, 90, 100);  // 30+ → 90-100 (extreme)
}

/**
 * Regime Relevance: ARCS score × regime transition probability.
 * Higher when regime is shifting AND asset is well-aligned.
 */
function computeRegimeRelevance(
  regimeAlignment: DRSInput["regimeAlignment"],
): number {
  if (!regimeAlignment) return 10; // low default — no regime data isn't discovery-worthy

  const { arcsScore, transitionProbability } = regimeAlignment;

  // Regime relevance is only high when regime is ACTIVELY transitioning
  // transitionProbability is stored as 0-100 (percentage scale)
  // Compatibility alone (arcsScore) is not a discovery signal — it's static
  if (transitionProbability <= 20) {
    // No meaningful transition — regime relevance is low regardless of ARCS
    return clamp(arcsScore * 0.15, 0, 25);
  }

  // Active transition: transition probability × ARCS modifier
  // tp=55 with arcs=80 → 55 * 0.8 = 44
  const arcsModifier = arcsScore / 100; // 0-1 multiplier
  return clamp(Math.round(transitionProbability * arcsModifier), 0, 100);
}

/**
 * Sentiment Shift: delta in SENTIMENT engine score from scoreDynamics.
 * Large positive or negative shifts = high relevance.
 */
function computeSentimentShift(
  scoreDynamics: DRSInput["scoreDynamics"],
): number {
  if (!scoreDynamics) return 0;

  const sentiment = scoreDynamics["SENTIMENT"];
  if (!sentiment) return 0;

  // Actual data: SENTIMENT momentum ranges 29-70 (large swings common)
  // Use percentile-calibrated curve: 5=low, 30=moderate, 50+=strong
  const magnitude = Math.abs(sentiment.momentum);
  return magnitude <= 0 ? 0
    : magnitude < 5 ? magnitude * 4                    // 0-5 → 0-20 (minor)
    : magnitude < 20 ? 20 + (magnitude - 5) * 2        // 5-20 → 20-50 (notable)
    : magnitude < 50 ? 50 + (magnitude - 20) * 1.17    // 20-50 → 50-85 (significant)
    : clamp(85 + (magnitude - 50) * 0.75, 85, 100);    // 50+ → 85-100 (extreme)
}

/**
 * Structural Signal: type-gated.
 * ETF: concentration anomaly + lookthrough match rate.
 * Others: 0 (weight redistributed).
 */
function computeStructuralSignal(
  type: AssetType,
  etfLookthrough: DRSInput["etfLookthrough"],
): number {
  if (type !== "ETF" || !etfLookthrough) return 0;

  let score = 0;

  // High concentration = structural concern worth surfacing
  if (etfLookthrough.concentration) {
    const { hhi, level } = etfLookthrough.concentration;
    if (level === "high") score += 60;
    else if (level === "moderate") score += 30;
    else score += hhi * 100; // low HHI still has some signal
  }

  // Low match rate = lookthrough quality concern
  if (etfLookthrough.lookthroughScores) {
    const { matchRate } = etfLookthrough.lookthroughScores;
    if (matchRate < 50) score += 30;
    else if (matchRate < 70) score += 15;
  }

  return clamp(score, 0, 100);
}

// ─── Archetype Detection ────────────────────────────────────────────────────

const ARCHETYPE_PRIORITY: Record<DiscoveryArchetype, number> = {
  score_inflection: 0,
  peer_divergence: 1,
  structural_anomaly: 2,
  regime_sensitive: 3,
  sentiment_shift: 4,
  cross_asset_pattern: 5,
};

function detectArchetype(
  inflectionScore: number,
  peerScore: number,
  regimeScore: number,
  sentimentScore: number,
  structuralScore: number,
  type: AssetType,
): DiscoveryArchetype {
  const scores: [DiscoveryArchetype, number][] = [
    ["score_inflection", inflectionScore],
    ["peer_divergence", peerScore],
    ["regime_sensitive", regimeScore],
    ["sentiment_shift", sentimentScore],
  ];

  if (type === "ETF" && structuralScore > 0) {
    scores.push(["structural_anomaly", structuralScore]);
  }

  scores.sort((a, b) => b[1] - a[1] || ARCHETYPE_PRIORITY[a[0]] - ARCHETYPE_PRIORITY[b[0]]);
  return scores[0][0];
}

// ─── Suppression Rules ──────────────────────────────────────────────────────

function checkSuppression(
  input: DRSInput,
  drs: number,
): { suppressed: boolean; reason?: string } {
  const region = (input.region ?? "US").toUpperCase();
  const noiseThreshold = region === "IN" ? 18 : 25;
  const staleHours = 72; // 3 days for both US and IN (now that NSE sync works)

  // DRS below threshold → noise
  if (drs < noiseThreshold) {
    return {
      suppressed: true,
      reason: `Below noise threshold (DRS < ${noiseThreshold})`,
    };
  }

  // Stale data (region-aware cadence)
  if (input.lastSyncAge > staleHours) {
    return { suppressed: true, reason: `Stale data (last sync ${Math.round(input.lastSyncAge)}h ago)` };
  }

  // Price-only change with truly zero score movement (no data at all)
  if (input.scoreDynamics) {
    const allZero = Object.values(input.scoreDynamics).every(
      (d) => d.momentum === 0 && d.acceleration === 0,
    );
    if (allZero) {
      return { suppressed: true, reason: "No score movement data available" };
    }
  }

  return { suppressed: false };
}

// ─── Main DRS Computation ───────────────────────────────────────────────────

export function computeDRS(input: DRSInput): Omit<DRSResult, "headline" | "context"> {
  const weights = getWeightsForType(input.type);

  // Compute each component
  const { score: inflectionScore, inflections } = computeScoreInflection(input.scoreDynamics);
  const peerScore = computePeerDivergence(input.latestScores, input.peerMedians);
  const regimeScore = computeRegimeRelevance(input.regimeAlignment);
  const sentimentScore = computeSentimentShift(input.scoreDynamics);
  const structuralScore = computeStructuralSignal(input.type, input.etfLookthrough);

  // Weighted sum
  const drs = clamp(
    Math.round(
      weights.scoreInflection * inflectionScore +
      weights.peerDivergence * peerScore +
      weights.regimeRelevance * regimeScore +
      weights.sentimentShift * sentimentScore +
      weights.structuralSignal * structuralScore,
    ),
    0,
    100,
  );

  // Detect dominant archetype
  const archetype = detectArchetype(
    inflectionScore, peerScore, regimeScore, sentimentScore, structuralScore, input.type,
  );

  // Check suppression
  const { suppressed, reason } = checkSuppression(input, drs);

  // Elite gating: cross_asset_pattern is Elite only
  const isEliteOnly = archetype === "cross_asset_pattern";

  return {
    assetId: input.assetId,
    symbol: input.symbol,
    name: input.name,
    type: input.type,
    drs,
    archetype,
    inflections,
    isEliteOnly,
    isSuppressed: suppressed,
    suppressionReason: reason,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
