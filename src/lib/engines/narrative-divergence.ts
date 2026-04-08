/**
 * Phase 3 Step 3.2: Narrative Divergence Engine
 * 
 * Compares media sentiment vs engine sentiment to detect narrative-reality gaps.
 * Helps identify when market narrative diverges from fundamental data.
 */

export type DivergenceDirection = "ALIGNED" | "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE";

export interface NarrativeDivergenceResult {
  narrativeStrength: number; // 0-100
  engineSentiment: number; // 0-100
  divergenceScore: number; // 0-100, higher = more divergence
  direction: DivergenceDirection;
  explanation: string;
  signal: "CAUTION" | "NEUTRAL" | "CONFIRMATION";
}

/**
 * Calculate narrative divergence between media sentiment and engine sentiment.
 */
export function calculateNarrativeDivergence(
  mediaSentiment: number, // 0-100 from news analysis
  engineSentiment: number, // 0-100 from DSE Sentiment Engine
  newsVolume: number = 1, // Number of news items (weight factor)
): NarrativeDivergenceResult {
  // Normalize inputs
  const normalizedMedia = Math.max(0, Math.min(100, mediaSentiment));
  const normalizedEngine = Math.max(0, Math.min(100, engineSentiment));

  // Calculate raw divergence
  const rawDivergence = Math.abs(normalizedMedia - normalizedEngine);
  
  // Weight divergence by news volume (more news = higher confidence in narrative)
  const volumeWeight = Math.min(1, newsVolume / 10); // Cap at 10 news items
  const divergenceScore = Math.round(rawDivergence * (0.5 + volumeWeight * 0.5));

  // Determine direction
  let direction: DivergenceDirection;
  if (divergenceScore < 15) {
    direction = "ALIGNED";
  } else if (normalizedMedia > normalizedEngine) {
    direction = "BULLISH_DIVERGENCE";
  } else {
    direction = "BEARISH_DIVERGENCE";
  }

  // Generate signal
  let signal: "CAUTION" | "NEUTRAL" | "CONFIRMATION";
  if (divergenceScore < 15) {
    signal = "CONFIRMATION";
  } else if (divergenceScore > 40) {
    signal = "CAUTION";
  } else {
    signal = "NEUTRAL";
  }

  // Generate explanation
  const explanation = generateExplanation(direction, divergenceScore);

  return {
    narrativeStrength: normalizedMedia,
    engineSentiment: normalizedEngine,
    divergenceScore,
    direction,
    explanation,
    signal,
  };
}

function generateExplanation(
  direction: DivergenceDirection,
  divergenceScore: number,
): string {
  if (direction === "ALIGNED") {
    return "Media narrative aligns with fundamental data. Sentiment is consistent across sources.";
  }

  if (direction === "BULLISH_DIVERGENCE") {
    if (divergenceScore > 40) {
      return "Media narrative is significantly more bullish than fundamentals suggest. Exercise caution.";
    }
    return "Media sentiment is moderately more positive than underlying data. Monitor for confirmation.";
  }

  // BEARISH_DIVERGENCE
  if (divergenceScore > 40) {
    return "Media narrative is significantly more bearish than fundamentals suggest. Potential contrarian opportunity.";
  }
  return "Media sentiment is moderately more negative than underlying data. Watch for stabilization.";
}

/**
 * Batch calculate narrative divergence for multiple assets.
 */
export function computeBatchNarrativeDivergence(
  assets: Array<{
    symbol: string;
    mediaSentiment?: number;
    engineSentiment?: number;
    newsCount?: number;
  }>,
): Map<string, NarrativeDivergenceResult> {
  const results = new Map<string, NarrativeDivergenceResult>();

  for (const asset of assets) {
    if (asset.mediaSentiment === undefined || asset.engineSentiment === undefined) {
      continue;
    }

    const divergence = calculateNarrativeDivergence(
      asset.mediaSentiment,
      asset.engineSentiment,
      asset.newsCount ?? 1,
    );

    results.set(asset.symbol, divergence);
  }

  return results;
}

/**
 * Identify assets with significant narrative divergence (potential opportunities/risks).
 */
export function findSignificantDivergences(
  divergences: Map<string, NarrativeDivergenceResult>,
  minDivergenceScore: number = 30,
): Array<{ symbol: string; divergence: NarrativeDivergenceResult }> {
  const significant: Array<{ symbol: string; divergence: NarrativeDivergenceResult }> = [];

  for (const [symbol, divergence] of divergences.entries()) {
    if (divergence.divergenceScore >= minDivergenceScore) {
      significant.push({ symbol, divergence });
    }
  }

  // Sort by divergence score (highest first)
  return significant.sort((a, b) => b.divergence.divergenceScore - a.divergence.divergenceScore);
}
