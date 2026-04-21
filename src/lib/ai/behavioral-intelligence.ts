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

// Pre-compiled regexes for behavioral pattern detection (HB-1)
const LP_REGEX = /\b(lp|liquidity pool|provide liquidity|yield farm|add liquidity|amm pool)\b/;
const IL_RISK_REGEX = /\b(impermanent loss|il risk|hedge|divergence loss|price divergence|lp risk)\b/;
const MEME_REGEX = /\b(meme.?coin|dogecoin|shiba|pepe|floki|bonk|wojak|turbo)\b/;
const HYPE_REGEX = /\b(moon|100x|gem|pump|to the moon|next big|viral|hype|fomo)\b/;
const RISK_FRAMING_REGEX = /\b(risk|volatil|downside|liquidity|dump|rug|bear|crash)\b/;
const STAKING_REGEX = /\b(stake|staking|delegate|validator|node)\b/;
const FULL_COMMITMENT_REGEX = /\b(all in|100%|everything|max stake|full stake|lock up)\b/;
const LOCKUP_REGEX = /\b(90 day|180 day|1 year|2 year|locked|unbond|unstaking|cooldown)\b/;
const LIQUIDITY_MENTION_REGEX = /\b(liquid|unstake|withdraw|emergency|sell|exit|cash)\b/;
const VOL_RISK_REGEX = /\b(volatil|drawdown|risk|diversif|not all|partial|split)\b/;

export type BehavioralPattern =
  | "CONCENTRATION_RISK"
  | "RECENCY_BIAS"
  | "VOLATILITY_SEEKING"
  | "FOMO_PATTERN"
  | "DIVERSIFICATION_HEALTHY"
  | "IMPERMANENT_LOSS_IGNORANCE"
  | "MEMECOIN_APING"
  | "STAKING_LOCKUP_BLINDNESS";

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
    query?: string;
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
      recommendation: "Concentration in a few assets increases correlation risk. In crypto, most altcoins move with BTC — consider adding stablecoins or BTC itself to reduce portfolio beta, not just more altcoins.",
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
        recommendation: "High-volatility crypto assets can draw down 50-80% in bear regimes. Ensure you have stablecoin reserves and size positions so a single asset wipeout does not derail the portfolio.",
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

  // Patterns 6-8: Detect in a single pass over queries (LB-2: combine loops)
  let ilDetected = false;
  let memeDetected = false;
  let stakingDetected = false;
  for (const q of queries) {
    const text = (q.query || "").toLowerCase();
    if (!text) continue;

    // Pattern 6: Impermanent Loss Ignorance (BI-1)
    if (!ilDetected && LP_REGEX.test(text) && !IL_RISK_REGEX.test(text)) {
      insights.push({
        pattern: "IMPERMANENT_LOSS_IGNORANCE",
        severity: "moderate",
        description: "Query mentions liquidity provision without addressing impermanent loss or hedging",
        recommendation: "Providing liquidity exposes you to divergence loss when asset prices move apart. Consider IL risk, hedge directional exposure, or use concentrated-range LPs only if you understand the payoff curve.",
        affectedAssets: q.assetSymbol ? [q.assetSymbol] : [],
      });
      ilDetected = true;
    }

    // Pattern 7: Memecoin Aping (BI-2a)
    if (!memeDetected && MEME_REGEX.test(text)) {
      const hasHypeLang = HYPE_REGEX.test(text);
      const hasRiskFraming = RISK_FRAMING_REGEX.test(text);
      if (hasHypeLang || !hasRiskFraming) {
        insights.push({
          pattern: "MEMECOIN_APING",
          severity: hasHypeLang ? "high" : "moderate",
          description: hasHypeLang
            ? "Memecoin query uses hype language without risk context — social-momentum speculation"
            : "Memecoin query lacks risk framing — these assets have no fundamental floor and can retrace 80-95%",
          recommendation: "Memecoins trade on social momentum with no cash-flow or protocol backing. If you choose to participate, size positions so a total loss does not affect your core portfolio. Watch liquidity depth — thin exits mean you may not be able to sell at the price you expect.",
          affectedAssets: q.assetSymbol ? [q.assetSymbol] : [],
        });
        memeDetected = true;
      }
    }

    // Pattern 8: Staking Lockup Blindness (BI-2b)
    if (!stakingDetected && STAKING_REGEX.test(text)) {
      const mentionsFullCommitment = FULL_COMMITMENT_REGEX.test(text);
      const mentionsLockup = LOCKUP_REGEX.test(text);
      const mentionsLiquidity = LIQUIDITY_MENTION_REGEX.test(text);
      const mentionsVolRisk = VOL_RISK_REGEX.test(text);
      if ((mentionsFullCommitment || mentionsLockup) && !mentionsLiquidity && !mentionsVolRisk) {
        insights.push({
          pattern: "STAKING_LOCKUP_BLINDNESS",
          severity: mentionsFullCommitment ? "high" : "moderate",
          description: mentionsFullCommitment
            ? "Query suggests staking 100% of holdings without considering liquidity needs or volatility drawdowns"
            : "Query mentions long staking lockups without addressing emergency liquidity or unstaking risk",
          recommendation: "Locking up capital removes optionality. In crypto, 50-70% drawdowns are common in Risk-Off regimes. Keep a liquid reserve, and size lockups so forced unstaking (often with penalties or long cooldowns) does not create a crisis.",
          affectedAssets: q.assetSymbol ? [q.assetSymbol] : [],
        });
        stakingDetected = true;
      }
    }

    if (ilDetected && memeDetected && stakingDetected) break; // All patterns found
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
    query?: string;
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
 * Supports multiple insights (up to 2) for richer coaching context.
 */
export function getMentoringMessage(insights: BehavioralInsight[]): string | null {
  const highSeverityInsights = insights.filter((i) => i.severity === "high");
  const moderateSeverityInsights = insights.filter((i) => i.severity === "moderate");

  const parts: string[] = [];
  const pick = (list: BehavioralInsight[], prefix: string, count = 2) => {
    for (const insight of list.slice(0, count)) {
      parts.push(`${prefix} **${insight.pattern.replace(/_/g, " ")}**: ${insight.description}. ${insight.recommendation}`);
    }
  };

  pick(highSeverityInsights, "⚠️", 2);
  pick(moderateSeverityInsights, "💡", 2 - parts.length);

  if (parts.length > 0) {
    return parts.join("\n");
  }

  const healthyPattern = insights.find((i) => i.pattern === "DIVERSIFICATION_HEALTHY");
  if (healthyPattern) {
    return `✅ ${healthyPattern.description}`;
  }

  return null;
}
