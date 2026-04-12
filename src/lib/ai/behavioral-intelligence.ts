/**
 * Phase 3 Step 3.5: Behavioral Intelligence Layer
 * 
 * Detects user behavioral patterns from query history and surfaces risk mentoring.
 * Helps identify concentrated interest, recency bias, and other behavioral risks.
 */

// Configuration constants
const MIN_QUERIES_FOR_ANALYSIS = 5;
const CONCENTRATION_THRESHOLD_MODERATE = 0.6;
const CONCENTRATION_THRESHOLD_HIGH = 0.8;
const RECENCY_WINDOW_DAYS = 7;
const RECENCY_BIAS_THRESHOLD = 0.7;
const HIGH_VOLATILITY_THRESHOLD = 70;
const EXTREME_VOLATILITY_THRESHOLD = 85;
const FOMO_TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const FOMO_PATTERN_THRESHOLD = 0.3;
const DIVERSIFICATION_THRESHOLD = 0.4;
const MIN_UNIQUE_SYMBOLS_FOR_DIVERSIFICATION = 6;  // Crypto-only platform: diversification across tokens, not asset types

export type BehavioralPattern =
  | "CONCENTRATION_RISK"
  | "RECENCY_BIAS"
  | "VOLATILITY_SEEKING"
  | "FOMO_PATTERN"
  | "DIVERSIFICATION_HEALTHY";

export interface BehavioralInsight {
  pattern: BehavioralPattern;
  severity: "low" | "moderate" | "high";
  description: string;
  recommendation: string;
  affectedAssets: string[];
}

export interface UserBehaviorProfile {
  userId: string;
  queryCount: number;
  assetInterest: Map<string, number>; // symbol -> query count
  assetTypeDistribution: Record<string, number>;
  volatilityPreference: number; // 0-100
  patterns: BehavioralInsight[];
  lastAnalyzed: Date;
}

/**
 * Analyze user query history to detect behavioral patterns.
 */
export function analyzeBehavioralPatterns(
  queries: Array<{
    assetSymbol?: string;
    assetType?: string;
    volatility?: number;
    timestamp: Date;
  }>,
): BehavioralInsight[] {
  // Input validation
  if (!queries || queries.length < MIN_QUERIES_FOR_ANALYSIS) {
    return [];
  }

  const insights: BehavioralInsight[] = [];

  // Calculate asset concentration
  const assetCounts = new Map<string, number>();
  const assetTypes = new Map<string, number>();
  let totalVolatility = 0;
  let volatilityCount = 0;

  for (const query of queries) {
    if (query.assetSymbol) {
      assetCounts.set(query.assetSymbol, (assetCounts.get(query.assetSymbol) || 0) + 1);
    }
    if (query.assetType) {
      assetTypes.set(query.assetType, (assetTypes.get(query.assetType) || 0) + 1);
    }
    if (query.volatility !== undefined) {
      totalVolatility += query.volatility;
      volatilityCount++;
    }
  }

  // Pattern 1: Concentration Risk
  const topAssets = Array.from(assetCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const topAssetConcentration = topAssets.reduce((sum, [, count]) => sum + count, 0) / queries.length;

  if (topAssetConcentration > CONCENTRATION_THRESHOLD_MODERATE && topAssets.length > 0) {
    insights.push({
      pattern: "CONCENTRATION_RISK",
      severity: topAssetConcentration > CONCENTRATION_THRESHOLD_HIGH ? "high" : "moderate",
      description: `${Math.round(topAssetConcentration * 100)}% of queries focused on ${topAssets.length} asset${topAssets.length > 1 ? "s" : ""}`,
      recommendation: "Consider diversifying research across different assets and sectors to reduce concentration risk.",
      affectedAssets: topAssets.map(([symbol]) => symbol),
    });
  }

  // Pattern 2: Recency Bias
  if (assetCounts.size === 0) {
    return insights; // No assets to analyze
  }

  const recencyWindowMs = RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentQueries = queries.filter(
    (q) => Date.now() - q.timestamp.getTime() < recencyWindowMs
  );
  const recentAssets = new Set(recentQueries.map((q) => q.assetSymbol).filter(Boolean));

  if (recentAssets.size > 0 && recentAssets.size / assetCounts.size > RECENCY_BIAS_THRESHOLD) {
    insights.push({
      pattern: "RECENCY_BIAS",
      severity: "moderate",
      description: "Majority of research focused on recently viewed assets",
      recommendation: "Review your full watchlist periodically to avoid recency bias in decision-making.",
      affectedAssets: Array.from(recentAssets) as string[],
    });
  }

  // Pattern 3: Volatility Seeking
  if (volatilityCount > 0) {
    const avgVolatility = totalVolatility / volatilityCount;

    if (avgVolatility > HIGH_VOLATILITY_THRESHOLD) {
      insights.push({
        pattern: "VOLATILITY_SEEKING",
        severity: avgVolatility > EXTREME_VOLATILITY_THRESHOLD ? "high" : "moderate",
        description: `Average volatility of researched assets: ${Math.round(avgVolatility)}`,
        recommendation: "High-volatility assets carry significant risk. Consider balancing with stable, lower-volatility positions.",
        affectedAssets: [],
      });
    }
  }

  // Pattern 4: FOMO Pattern (rapid successive queries on trending assets)
  // Only evaluate when queries have distinct timestamps (i.e., sourced from DB history).
  // In-session synthesis assigns `new Date()` to all messages → identical timestamps →
  // timeDiff=0 for every pair → false-positive FOMO on every multi-message request.
  const hasDistinctTimestamps = queries.length >= 2 &&
    queries[0].timestamp.getTime() !== queries[queries.length - 1].timestamp.getTime();

  if (hasDistinctTimestamps) {
    const rapidQueries = queries.filter((q, i) => {
      if (i === 0) return false;
      const timeDiff = q.timestamp.getTime() - queries[i - 1].timestamp.getTime();
      return timeDiff < FOMO_TIME_WINDOW_MS;
    });

    if (rapidQueries.length > queries.length * FOMO_PATTERN_THRESHOLD) {
      insights.push({
        pattern: "FOMO_PATTERN",
        severity: "moderate",
        description: "Frequent rapid-fire queries detected, suggesting potential FOMO behavior",
        recommendation: "Take time to analyze each asset thoroughly before moving to the next. Quality over quantity.",
        affectedAssets: [],
      });
    }
  }

  // Pattern 5: Healthy Diversification (positive pattern)
  // Crypto-only platform: diversification is across distinct tokens, not asset types.
  // All assets are CRYPTO type, so assetTypes.size is always 1. Use unique symbols instead.
  if (assetCounts.size >= MIN_UNIQUE_SYMBOLS_FOR_DIVERSIFICATION && topAssetConcentration < DIVERSIFICATION_THRESHOLD) {
    insights.push({
      pattern: "DIVERSIFICATION_HEALTHY",
      severity: "low",
      description: "Research shows healthy diversification across asset types and individual positions",
      recommendation: "Continue maintaining diverse research interests to support well-rounded decision-making.",
      affectedAssets: [],
    });
  }

  return insights;
}

/**
 * Build user behavior profile from query history.
 */
export function buildBehaviorProfile(
  userId: string,
  queries: Array<{
    assetSymbol?: string;
    assetType?: string;
    volatility?: number;
    timestamp: Date;
  }>,
): UserBehaviorProfile {
  const assetInterest = new Map<string, number>();
  const assetTypeDistribution: Record<string, number> = {};
  let totalVolatility = 0;
  let volatilityCount = 0;

  for (const query of queries) {
    if (query.assetSymbol) {
      assetInterest.set(query.assetSymbol, (assetInterest.get(query.assetSymbol) || 0) + 1);
    }
    if (query.assetType) {
      assetTypeDistribution[query.assetType] = (assetTypeDistribution[query.assetType] || 0) + 1;
    }
    if (query.volatility !== undefined) {
      totalVolatility += query.volatility;
      volatilityCount++;
    }
  }

  const patterns = analyzeBehavioralPatterns(queries);
  const volatilityPreference = volatilityCount > 0 ? Math.round(totalVolatility / volatilityCount) : 50;

  return {
    userId,
    queryCount: queries.length,
    assetInterest,
    assetTypeDistribution,
    volatilityPreference,
    patterns,
    lastAnalyzed: new Date(),
  };
}

/**
 * Get mentoring message based on detected patterns.
 */
export function getMentoringMessage(insights: BehavioralInsight[]): string | null {
  const highSeverityInsights = insights.filter((i) => i.severity === "high");
  const moderateSeverityInsights = insights.filter((i) => i.severity === "moderate");

  if (highSeverityInsights.length > 0) {
    const insight = highSeverityInsights[0];
    return `⚠️ **${insight.pattern.replace(/_/g, " ")}**: ${insight.description}. ${insight.recommendation}`;
  }

  if (moderateSeverityInsights.length > 0) {
    const insight = moderateSeverityInsights[0];
    return `💡 **Insight**: ${insight.description}. ${insight.recommendation}`;
  }

  const healthyPattern = insights.find((i) => i.pattern === "DIVERSIFICATION_HEALTHY");
  if (healthyPattern) {
    return `✅ ${healthyPattern.description}`;
  }

  return null;
}
