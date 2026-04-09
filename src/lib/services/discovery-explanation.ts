/**
 * Discovery Explanation Templates — Phase 2.3
 *
 * Deterministic headline + context generation per archetype.
 * Zero AI cost — pure string interpolation from pre-computed data.
 */

import type { AssetType } from "@/generated/prisma/client";
import type { DiscoveryArchetype, ScoreInflection } from "@/lib/engines/discovery-relevance";

// ─── Asset Type Labels ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  CRYPTO: "Crypto",
};

// ─── Headline Templates ─────────────────────────────────────────────────────

export function generateHeadline(
  archetype: DiscoveryArchetype,
  symbol: string,
  name: string,
  type: AssetType,
  inflections: ScoreInflection[],
  drs: number,
  extra?: {
    peerGroup?: string;
    regimeState?: string;
    structuralDetail?: string;
  },
): string {
  const displayName = name.length > 30 ? symbol : name;

  switch (archetype) {
    case "score_inflection": {
      if (inflections.length === 0) {
        return `${displayName} showing unusual score movement`;
      }
      const top = inflections[0];
      const direction = top.momentum > 0 ? "surged" : "dropped";
      const delta = Math.abs(top.momentum).toFixed(1);
      return `${displayName}'s ${formatScoreType(top.scoreType)} ${direction} ${delta} points this week`;
    }

    case "peer_divergence": {
      const group = extra?.peerGroup || TYPE_LABELS[type] || "peer";
      const topInflection = inflections[0];
      if (topInflection) {
        const direction = topInflection.percentileRank > 70 ? "outperforming" : "lagging";
        return `${displayName} ${direction} ${group} peers — ${formatScoreType(topInflection.scoreType)} at ${topInflection.percentileRank}th percentile`;
      }
      return `${displayName} diverging from ${group} average`;
    }

    case "regime_sensitive": {
      const regime = extra?.regimeState || "current regime";
      return `${displayName} shows heightened sensitivity as market shifts toward ${formatRegime(regime)}`;
    }

    case "sentiment_shift": {
      const sentimentInflection = inflections.find((i) => i.scoreType === "SENTIMENT");
      if (sentimentInflection) {
        const direction = sentimentInflection.momentum > 0 ? "positive" : "negative";
        const delta = Math.abs(sentimentInflection.momentum).toFixed(1);
        return `${displayName} sentiment shifted ${direction} by ${delta} points — volume-price divergence detected`;
      }
      return `Unusual sentiment activity around ${displayName}`;
    }

    case "structural_anomaly": {
      const detail = extra?.structuralDetail || "structural change detected";
      return `${displayName}: ${detail}`;
    }

    case "cross_asset_pattern": {
      return `Cross-asset correlation pattern detected involving ${displayName}`;
    }

    default:
      return `${displayName} surfaced with DRS ${drs}`;
  }
}

// ─── Context Templates ──────────────────────────────────────────────────────

export function generateContext(
  archetype: DiscoveryArchetype,
  type: AssetType,
  inflections: ScoreInflection[],
  drs: number,
  extra?: {
    peerGroup?: string;
    regimeState?: string;
    transitionDirection?: string;
    structuralDetail?: string;
    signalLabel?: string;
  },
): string {
  switch (archetype) {
    case "score_inflection": {
      const improving = inflections.filter((i) => i.trend === "IMPROVING");
      const deteriorating = inflections.filter((i) => i.trend === "DETERIORATING");

      if (improving.length > deteriorating.length) {
        const engines = improving.map((i) => formatScoreType(i.scoreType)).join(", ");
        return `Multiple engines improving (${engines}). Score dynamics suggest strengthening conditions across ${improving.length} dimensions.`;
      } else if (deteriorating.length > 0) {
        const engines = deteriorating.map((i) => formatScoreType(i.scoreType)).join(", ");
        return `Deterioration detected in ${engines}. Score dynamics signal weakening conditions — monitor for further breakdown.`;
      }
      return `Mixed score movements detected across ${inflections.length} engines. Review individual score trends for directional clarity.`;
    }

    case "peer_divergence": {
      const group = extra?.peerGroup || TYPE_LABELS[type] || "peer";
      const topOutperformers = inflections.filter((i) => i.percentileRank > 70);
      const topUnderperformers = inflections.filter((i) => i.percentileRank < 30);

      if (topOutperformers.length > 0) {
        return `Outperforming ${group} median across ${topOutperformers.length} score dimensions. Top percentile ranks suggest relative strength vs sector.`;
      } else if (topUnderperformers.length > 0) {
        return `Underperforming ${group} median across ${topUnderperformers.length} dimensions. Relative weakness may signal rotation risk.`;
      }
      return `Diverging from ${group} consensus — score profile differs meaningfully from type median.`;
    }

    case "regime_sensitive": {
      const direction = extra?.transitionDirection || "shifting";
      const signal = extra?.signalLabel || "moderate";
      return `Market regime ${direction}. This asset's regime compatibility and signal strength (${signal}) make it particularly relevant in the current transition.`;
    }

    case "sentiment_shift": {
      const sentimentDelta = inflections.find((i) => i.scoreType === "SENTIMENT");
      if (sentimentDelta && Math.abs(sentimentDelta.momentum) > 3) {
        const direction = sentimentDelta.momentum > 0 ? "accumulation" : "distribution";
        return `Volume-price analysis indicates ${direction} pattern. Sentiment engine detected a ${Math.abs(sentimentDelta.momentum).toFixed(1)}-point shift — unusual relative to recent history.`;
      }
      return `Sentiment engine flagged unusual activity. Volume-price dynamics diverging from recent baseline.`;
    }

    case "structural_anomaly": {
      return extra?.structuralDetail
        ? `Structural analysis flagged: ${extra.structuralDetail}. Review lookthrough data for detailed breakdown.`
        : `Structural characteristics changed meaningfully. Review concentration, factor exposure or lookthrough metrics.`;
    }

    case "cross_asset_pattern": {
      return `Cross-asset correlation analysis detected an unusual pattern. This is an Elite-tier insight — review correlated assets for portfolio implications.`;
    }

    default:
      return `Discovery Relevance Score: ${drs}/100. Review asset page for detailed analysis.`;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatScoreType(type: string): string {
  const map: Record<string, string> = {
    TREND: "Trend",
    MOMENTUM: "Momentum",
    VOLATILITY: "Volatility",
    SENTIMENT: "Sentiment",
    LIQUIDITY: "Liquidity",
    TRUST: "Trust",
  };
  return map[type] || type;
}

function formatRegime(regime: string): string {
  return regime
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
