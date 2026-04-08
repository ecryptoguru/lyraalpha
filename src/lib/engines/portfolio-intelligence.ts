import { clamp10, formatScore10, formatRegime, parseRiskMetrics, normalizeShareText } from "./portfolio-utils";
import type { ParsedRiskMetrics } from "./portfolio-utils";

export type PortfolioIntelligenceBand = "Exceptional" | "Strong" | "Balanced" | "Fragile" | "High Risk";

export interface PortfolioIntelligenceHoldingInput {
  quantity: number;
  avgPrice: number;
  asset: {
    price: number | null;
    changePercent?: number | null;
    sector?: string | null;
    type?: string | null;
  };
}

export interface PortfolioIntelligenceSimulationInput {
  expectedReturn: number;
  medianReturn: number;
  p25Return: number;
  p75Return: number;
  var5: number;
  es5: number;
  maxDrawdownMean: number;
  fragilityMean: number;
  regimeForecast: Record<string, number>;
  pathCount: number;
  horizon: number;
  mode: string;
}

export interface PortfolioIntelligenceInput {
  healthScore: number | null;
  diversificationScore: number | null;
  concentrationScore: number | null;
  volatilityScore: number | null;
  correlationScore: number | null;
  qualityScore: number | null;
  fragilityScore: number | null;
  riskMetrics?: unknown;
  holdings: PortfolioIntelligenceHoldingInput[];
  simulation?: PortfolioIntelligenceSimulationInput | null;
  currentMarketRegime?: string | null;
}

export interface PortfolioIntelligenceComponentScores {
  diversification: number;
  resilience: number;
  overlap: number;
  concentration: number;
  performance: number;
}

export interface PortfolioIntelligenceSignal {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral";
}

export interface PortfolioIntelligenceResult {
  score: number;
  band: PortfolioIntelligenceBand;
  headline: string;
  body: string;
  nextAction: string;
  scoreLabel: string;
  scoreValue: string;
  summaryLine: string;
  shareText: string;
  components: PortfolioIntelligenceComponentScores;
  signals: PortfolioIntelligenceSignal[];
}

// ─── Band helpers ─────────────────────────────────────────────────────────────

function scoreBand(score: number): PortfolioIntelligenceBand {
  if (score >= 8.5) return "Exceptional";
  if (score >= 7) return "Strong";
  if (score >= 5.5) return "Balanced";
  if (score >= 4) return "Fragile";
  return "High Risk";
}

// ─── Component calculators ────────────────────────────────────────────────────

function calculateCurrentReturnScore(holdings: PortfolioIntelligenceHoldingInput[]): number {
  let totalValue = 0;
  let totalCost = 0;

  for (const holding of holdings) {
    const price = holding.asset.price;
    const cost = holding.quantity * holding.avgPrice;
    totalCost += cost;
    if (price !== null) {
      totalValue += holding.quantity * price;
    }
  }

  if (totalCost <= 0) return 5;
  const returnPct = ((totalValue - totalCost) / totalCost) * 100;
  // Map [-10%, +30%] → [0, 10]; clamp outside
  return clamp10((returnPct + 10) / 4);
}

function calculateDiversificationScore10(value: number | null): number {
  if (value == null) return 5;
  // value is on the 0-100 health scale
  return clamp10(value / 10);
}

function calculateConcentrationScore10(value: number | null): number {
  if (value == null) return 5;
  return clamp10(value / 10);
}

function calculateResilienceScore10(input: PortfolioIntelligenceInput): number {
  const health = calculateDiversificationScore10(input.healthScore);
  // fragilityScore is 0-100 where higher = more fragile → invert
  const fragility = clamp10(10 - (input.fragilityScore ?? 50) / 10);
  // volatilityScore is 0-100 where higher = more volatile → invert
  // Use explicit null check; do NOT fall back to healthScore as they are unrelated
  const rawVol = input.volatilityScore ?? null;
  const volatility = rawVol !== null ? clamp10(10 - rawVol / 10) : 5;
  return clamp10(health * 0.5 + fragility * 0.35 + volatility * 0.15);
}

function calculateOverlapScore10(metrics: ParsedRiskMetrics, _concentrationScore10: number): number {
  void _concentrationScore10;
  // Compatibility drives overlap clarity — higher compatibility = better aligned overlap
  const compatibility = metrics.averageCompatibilityScore != null
    ? metrics.averageCompatibilityScore / 10
    : 6;
  const weakPenalty = metrics.weakCompatibilityCount * 0.55;
  const mismatchPenalty =
    metrics.regimeMismatchLabel === "High mismatch" ? 1.2
    : metrics.regimeMismatchLabel === "Moderate mismatch" ? 0.6
    : 0;
  // Removed the positive concentration bonus: a concentrated portfolio does NOT
  // have better overlap clarity — if anything the opposite is true.
  return clamp10(compatibility - weakPenalty - mismatchPenalty);
}

function calculatePerformanceScore10(
  input: PortfolioIntelligenceInput,
  metrics: ParsedRiskMetrics,
): number {
  const realizedScore = calculateCurrentReturnScore(input.holdings);
  if (!input.simulation) return realizedScore;

  // Map simulation output onto a 0-10 scale.
  // expectedReturn is a fraction (e.g. 0.08 = 8%), fragilityMean is 0-100, maxDrawdownMean is a fraction.
  const simulatedScore = clamp10(
    5
    + input.simulation.expectedReturn * 18
    - input.simulation.fragilityMean / 25
    - input.simulation.maxDrawdownMean * 12,
  );

  // Small regime-alignment boost only when the regime is explicitly known AND
  // the portfolio is at least moderately aligned (no high mismatch).
  const hasRegime = Boolean(metrics.currentMarketRegime);
  const isAligned = metrics.regimeMismatchLabel !== "High mismatch";
  const regimeBoost = hasRegime && isAligned ? 0.2 : 0;

  return clamp10(realizedScore * 0.55 + simulatedScore * 0.45 + regimeBoost);
}

// ─── Narrative ────────────────────────────────────────────────────────────────

type WeakDimension = "resilience" | "overlap" | "concentration" | "performance";

function findWeakestDimension(scores: {
  resilience: number;
  overlap: number;
  concentration: number;
  performance: number;
}): WeakDimension {
  return (Object.entries(scores) as [WeakDimension, number][])
    .sort((a, b) => a[1] - b[1])[0][0];
}

function chooseHeadline(args: {
  score: number;
  metrics: ParsedRiskMetrics;
  resilience: number;
  overlap: number;
  concentration: number;
  performance: number;
  regimeLabel: string | null;
}): { headline: string; body: string; nextAction: string } {
  const weakDimension = findWeakestDimension({
    resilience: args.resilience,
    overlap: args.overlap,
    concentration: args.concentration,
    performance: args.performance,
  });

  if (args.score >= 8.5) {
    return {
      headline: "Your portfolio is in strong shape",
      body: args.regimeLabel
        ? `The current ${args.regimeLabel} backdrop still looks supportive, and the portfolio is carrying only a few meaningful weak spots.`
        : "The portfolio is broadly balanced, with only a few small areas worth tightening.",
      nextAction: "Use the simulation card to test what would actually break first.",
    };
  }

  if (args.score >= 7) {
    return {
      headline: `Your portfolio looks good, but ${weakDimension} is still limiting the upside`,
      body: args.metrics.portfolioScoreBody
        ?? (args.regimeLabel
          ? `Most of the mix looks usable for the current ${args.regimeLabel} backdrop, but the weakest component is still dragging the story down.`
          : "Most of the mix looks workable, but one component still deserves a closer look."),
      nextAction: args.metrics.portfolioScoreAction
        ?? "Open the diagnostics below and fix the weakest component first.",
    };
  }

  if (args.score >= 5.5) {
    return {
      headline: "Your portfolio is usable, but the hidden trade-offs matter now",
      body: args.metrics.regimeMismatchReason
        ?? (args.regimeLabel
          ? `The ${args.regimeLabel} backdrop is exposing a few weak areas that can quietly erode resilience.`
          : "A few weak areas are starting to matter more than the headline score suggests."),
      nextAction: "Start with concentration and overlap before chasing performance.",
    };
  }

  if (args.score >= 4) {
    return {
      headline: "Your portfolio is leaning fragile",
      body: args.metrics.regimeMismatchReason
        ?? (args.regimeLabel
          ? `The current ${args.regimeLabel} backdrop is exposing more risk than the portfolio can comfortably absorb.`
          : "The portfolio is carrying too much hidden risk relative to its resilience."),
      nextAction: "Reduce the weakest exposure and rerun the shock test.",
    };
  }

  return {
    headline: "Your portfolio needs attention before the next market turn",
    body: args.regimeLabel
      ? `The ${args.regimeLabel} backdrop is exposing the weakest links, and the mix is no longer absorbing shocks cleanly.`
      : "The mix is too brittle right now; the next market shock could create a much worse outcome than the headline suggests.",
    nextAction: "Cut concentration, verify overlap, then rerun the Monte Carlo simulation.",
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function buildPortfolioIntelligence(input: PortfolioIntelligenceInput): PortfolioIntelligenceResult {
  const metrics = parseRiskMetrics(input.riskMetrics);
  const regimeLabel = formatRegime(metrics.currentMarketRegime ?? input.currentMarketRegime);

  const diversification = calculateDiversificationScore10(input.diversificationScore);
  const resilience = calculateResilienceScore10(input);
  const concentration = calculateConcentrationScore10(input.concentrationScore);
  const overlap = calculateOverlapScore10(metrics, concentration);
  const performance = calculatePerformanceScore10(input, metrics);

  const score = clamp10(
    diversification * 0.3
    + resilience * 0.25
    + overlap * 0.2
    + concentration * 0.15
    + performance * 0.1,
  );

  const headlineScore = input.simulation ? score : (metrics.portfolioScore ?? score);
  const band = input.simulation
    ? scoreBand(headlineScore)
    : (metrics.portfolioScoreBand ?? scoreBand(headlineScore));

  const freshNarrative = chooseHeadline({
    score: headlineScore,
    metrics,
    resilience,
    overlap,
    concentration,
    performance,
    regimeLabel,
  });

  const headline = input.simulation
    ? freshNarrative.headline
    : (metrics.portfolioScoreHeadline ?? freshNarrative.headline);
  const body = input.simulation
    ? freshNarrative.body
    : (metrics.portfolioScoreBody ?? freshNarrative.body);
  const nextAction = input.simulation
    ? freshNarrative.nextAction
    : (metrics.portfolioScoreAction ?? freshNarrative.nextAction);

  const signals: PortfolioIntelligenceSignal[] = [
    {
      label: "Resilience",
      value: formatScore10(resilience),
      tone: resilience >= 7 ? "positive" : resilience >= 5.5 ? "neutral" : "warning",
    },
    {
      label: "Overlap clarity",
      value: formatScore10(overlap),
      tone: overlap >= 7 ? "positive" : overlap >= 5.5 ? "neutral" : "warning",
    },
    {
      label: "Concentration",
      value: formatScore10(concentration),
      tone: concentration >= 7 ? "positive" : concentration >= 5.5 ? "neutral" : "warning",
    },
    {
      label: "Performance",
      value: formatScore10(performance),
      tone: performance >= 7 ? "positive" : performance >= 5.5 ? "neutral" : "warning",
    },
  ];

  if (input.simulation) {
    signals.push({
      label: "Monte Carlo",
      value: `${input.simulation.expectedReturn >= 0 ? "+" : ""}${(input.simulation.expectedReturn * 100).toFixed(1)}% expected`,
      tone: input.simulation.fragilityMean <= 35 ? "positive"
        : input.simulation.fragilityMean <= 60 ? "neutral"
        : "warning",
    });
  }

  if (regimeLabel) {
    signals.unshift({
      label: "Market regime",
      value: regimeLabel,
      tone: metrics.regimeMismatchLabel === "High mismatch" ? "warning"
        : metrics.regimeMismatchLabel === "Aligned" ? "positive"
        : "neutral",
    });
  }

  const scoreValue = formatScore10(headlineScore);

  return {
    score: Math.round(headlineScore * 10) / 10,
    band,
    headline,
    body,
    nextAction,
    scoreLabel: "Portfolio",
    scoreValue,
    summaryLine: normalizeShareText(`${headline}. ${body}`),
    shareText: normalizeShareText(`${headline}. ${body} Portfolio score: ${scoreValue}.`),
    components: { diversification, resilience, overlap, concentration, performance },
    signals,
  };
}
