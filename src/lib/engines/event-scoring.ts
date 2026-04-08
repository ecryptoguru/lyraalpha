/**
 * Event-Driven Scoring Engine (Phase 1)
 * Adjusts asset scores based on institutional events.
 * Supports bidirectional impact: bullish events boost scores, bearish events penalize.
 */

import { prisma } from "../prisma";
import { ScoreType } from "@/generated/prisma/client";

export interface EventImpact {
  adjustedScore: number;
  impactMagnitude: number;
  affectedEvents: Array<{
    type: string;
    severity: string;
    title: string;
    date: Date;
  }>;
  recentEvents: number;
  maxSeverity: string;
  explanation: string;
}

export interface InstitutionalEvent {
  id: string;
  assetId: string;
  type: string;
  title: string;
  description: string | null;
  severity: string;
  date: Date;
  metadata: unknown | null; // Use unknown for metadata to handle JsonValue safely
}

/**
 * Calculate event-adjusted score for an asset
 */
export async function calculateEventAdjustedScore(
  assetId: string,
  baseScore: number,
  scoreType: ScoreType,
  cachedEvents?: InstitutionalEvent[],
): Promise<EventImpact> {
  // Fetch recent events (last 30 days) if not provided
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentEvents = cachedEvents || await prisma.institutionalEvent.findMany({
    where: {
      assetId,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: "desc" },
  }) as InstitutionalEvent[];

  if (recentEvents.length === 0) {
    return {
      adjustedScore: baseScore,
      impactMagnitude: 0,
      affectedEvents: [],
      recentEvents: 0,
      maxSeverity: "NONE",
      explanation: "No recent institutional events",
    };
  }

  // Calculate event impact
  let totalImpact = 0;
  const affectedEvents: Array<{
    type: string;
    severity: string;
    title: string;
    date: Date;
  }> = [];

  for (const event of recentEvents) {
    // Severity multiplier (magnitude only — direction handled separately)
    const severityMap: Record<string, number> = {
      HIGH: 0.15,
      MEDIUM: 0.08,
      LOW: 0.03,
    };
    const severityMultiplier = severityMap[event.severity] || 0.05;

    // Type relevance to score type
    const typeRelevance = getTypeRelevance(event.type, scoreType);

    if (typeRelevance > 0) {
      // Decay based on recency (exponential decay over 30 days)
      const daysSinceEvent = Math.floor(
        (Date.now() - event.date.getTime()) / (1000 * 60 * 60 * 24),
      );
      const recencyFactor = Math.exp(-0.05 * daysSinceEvent); // Decay factor

      // Direction: bullish (+1) boosts scores, bearish (-1) penalizes, neutral (0) skips
      const direction = inferEventDirection(event);

      const eventImpact = direction * severityMultiplier * typeRelevance * recencyFactor;
      totalImpact += eventImpact;

      affectedEvents.push({
        type: event.type,
        severity: event.severity,
        title: event.title,
        date: event.date,
      });
    }
  }

  // Apply impact (cap at ±20% adjustment)
  const impactMagnitude = Math.min(0.2, Math.max(-0.2, totalImpact));
  const adjustedScore = Math.min(
    100,
    Math.max(0, baseScore * (1 + impactMagnitude)),
  );

  // Determine max severity
  const severityRank = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
  const maxSeverity = affectedEvents.reduce(
    (max, e) =>
      (severityRank[e.severity as keyof typeof severityRank] || 0) >
      (severityRank[max as keyof typeof severityRank] || 0)
        ? e.severity
        : max,
    "NONE",
  );

  // Generate explanation
  const explanation = generateEventExplanation(affectedEvents, impactMagnitude);

  return {
    adjustedScore: Math.round(adjustedScore * 10) / 10,
    impactMagnitude: Math.round(impactMagnitude * 1000) / 10, // As percentage
    affectedEvents,
    recentEvents: affectedEvents.length,
    maxSeverity,
    explanation,
  };
}

/**
 * Infer event direction from metadata, title keywords, or type defaults.
 * Returns +1 (bullish/positive), -1 (bearish/negative), or 0 (neutral/no impact).
 *
 * Priority: metadata.sentiment > title keywords > type default
 */
function inferEventDirection(event: InstitutionalEvent): 1 | -1 | 0 {
  // 1. Explicit sentiment in metadata (set by event generators)
  const meta = (event.metadata || {}) as Record<string, unknown>;
  const explicit = meta.sentiment as string | undefined;
  if (explicit === "bullish" || explicit === "positive") return 1;
  if (explicit === "bearish" || explicit === "negative") return -1;
  if (explicit === "neutral") return 0;

  // 2. Title-based keyword inference
  const title = event.title.toLowerCase();
  const bullishKeywords = ["breakout", "upgrade", "beat", "surge", "accumulation", "mispricing", "recovery"];
  const bearishKeywords = ["breakdown", "downgrade", "miss", "warning", "shift", "decoupling", "deterioration", "risk", "sell-off"];

  if (bullishKeywords.some(k => title.includes(k))) return 1;
  if (bearishKeywords.some(k => title.includes(k))) return -1;

  // 3. Type-based defaults
  const typeDefaults: Record<string, 1 | -1 | 0> = {
    TECHNICAL: 1,     // Momentum Breakout — bullish
    FUNDAMENTAL: 1,   // Value Mispricing — bullish (opportunity)
    MARKET: -1,       // Benchmark Shift — bearish (regime risk)
    NEWS: 0,          // Unknown sentiment without NLP — neutral
  };

  return typeDefaults[event.type] ?? 0;
}

/**
 * Determine how relevant an event type is to a score type
 */
function getTypeRelevance(eventType: string, scoreType: ScoreType): number {
  const relevanceMatrix: Record<string, Partial<Record<ScoreType, number>>> = {
    TECHNICAL: {
      TREND: 1.0,
      MOMENTUM: 1.0,
      VOLATILITY: 0.8,
      LIQUIDITY: 0.5,
      SENTIMENT: 0.3,
      TRUST: 0.2,
    },
    FUNDAMENTAL: {
      TRUST: 1.0,
      SENTIMENT: 0.9,
      TREND: 0.6,
      MOMENTUM: 0.4,
      VOLATILITY: 0.3,
      LIQUIDITY: 0.2,
    },
    MARKET: {
      TREND: 0.8,
      MOMENTUM: 0.8,
      VOLATILITY: 1.0,
      LIQUIDITY: 0.9,
      SENTIMENT: 0.7,
      TRUST: 0.5,
    },
    NEWS: {
      TREND: 0.4,
      MOMENTUM: 0.6,
      VOLATILITY: 0.7, // News often drives volatility
      LIQUIDITY: 0.3,
      SENTIMENT: 1.0, // Primary driver
      TRUST: 0.8,
    },
  };

  return relevanceMatrix[eventType]?.[scoreType] || 0.5;
}

/**
 * Generate human-readable explanation of event impact
 */
function generateEventExplanation(
  events: Array<{ type: string; severity: string; title: string; date: Date }>,
  impactMagnitude: number,
): string {
  if (events.length === 0) {
    return "No recent institutional events affecting this score";
  }

  const highSeverityCount = events.filter((e) => e.severity === "HIGH").length;
  const recentCount = events.filter(
    (e) => Date.now() - e.date.getTime() < 7 * 24 * 60 * 60 * 1000,
  ).length;

  if (impactMagnitude > 5) {
    return `Positive impact from ${events.length} recent event(s), including ${highSeverityCount} high-severity signal(s)`;
  } else if (impactMagnitude < -5) {
    return `Negative impact from ${events.length} recent event(s), including ${highSeverityCount} high-severity concern(s)`;
  } else {
    return `Minimal impact from ${recentCount} recent event(s)`;
  }
}

/**
 * Batch calculate event-adjusted scores for all score types.
 * Optimized: single query for all latest scores + single event fetch,
 * instead of 6 sequential score queries + 6 sequential event queries.
 */
export async function calculateAllEventAdjustedScores(
  assetId: string,
): Promise<Record<ScoreType, EventImpact>> {
  const scoreTypes: ScoreType[] = [
    "TREND",
    "MOMENTUM",
    "VOLATILITY",
    "SENTIMENT",
    "LIQUIDITY",
    "TRUST",
  ];

  // Batch: fetch all latest scores in one query
  const latestScores = await prisma.assetScore.findMany({
    where: { assetId, type: { in: scoreTypes } },
    orderBy: { date: "desc" },
    distinct: ["type"],
  });

  // Batch: fetch events once, share across all score types
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cachedEvents = await prisma.institutionalEvent.findMany({
    where: { assetId, date: { gte: thirtyDaysAgo } },
    orderBy: { date: "desc" },
  }) as InstitutionalEvent[];

  const results: Partial<Record<ScoreType, EventImpact>> = {};

  // Now compute adjustments in parallel (no more DB calls inside)
  await Promise.all(
    latestScores.map(async (score) => {
      results[score.type] = await calculateEventAdjustedScore(
        assetId,
        score.value,
        score.type,
        cachedEvents,
      );
    })
  );

  return results as Record<ScoreType, EventImpact>;
}

/**
 * Get event summary for an asset
 */
export async function getEventSummary(assetId: string): Promise<{
  totalEvents: number;
  highSeverityEvents: number;
  recentEvents: number;
  dominantType: string;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const allEvents = await prisma.institutionalEvent.findMany({
    where: { assetId, date: { gte: thirtyDaysAgo } },
  });

  const highSeverityEvents = allEvents.filter(
    (e) => e.severity === "HIGH",
  ).length;
  const recentEvents = allEvents.filter((e) => e.date >= sevenDaysAgo).length;

  // Determine dominant event type
  const typeCounts: Record<string, number> = {};
  allEvents.forEach((e) => {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  });

  const dominantType =
    Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "NONE";

  return {
    totalEvents: allEvents.length,
    highSeverityEvents,
    recentEvents,
    dominantType,
  };
}
