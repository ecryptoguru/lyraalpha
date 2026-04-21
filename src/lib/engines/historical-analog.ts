import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAzureEmbeddingDeployment, getEmbeddingClient } from "@/lib/ai/config";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "historical-analog" });

const EMBEDDING_DIMS = 1536;
const SIMILARITY_THRESHOLD = 0.82;
const TOP_K = 5;
const CACHE_TTL = 3600; // 1 hour

export interface HistoricalAnalogResult {
  id: string;
  windowStart: string;
  windowEnd: string;
  regimeState: string;
  breadthScore: number;
  similarity: number;
  forwardReturns: {
    fwd5d: number | null;
    fwd20d: number | null;
    fwd60d: number | null;
  };
  maxDrawdown20d: number | null;
  recoveryDays: number | null;
  topSectors: string[];
  label: string;
}

export interface AnalogSearchResult {
  analogs: HistoricalAnalogResult[];
  currentFingerprint: MarketFingerprint;
  medianFwd5d: number | null;
  medianFwd20d: number | null;
  medianFwd60d: number | null;
  worstDrawdown: number | null;
  analogCount: number;
}

export interface MarketFingerprint {
  regimeState: string;
  breadthScore: number;
  volatilityLevel: number;
  crossSectorCorr: number;
  avgTrend: number;
  avgMomentum: number;
  avgVolatility: number;
  avgSentiment: number;
}

function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

function fingerprintToText(fp: MarketFingerprint): string {
  return [
    `regime:${fp.regimeState}`,
    `breadth:${fp.breadthScore.toFixed(1)}`,
    `volatility:${fp.volatilityLevel.toFixed(1)}`,
    `crossSectorCorr:${fp.crossSectorCorr.toFixed(2)}`,
    `trend:${fp.avgTrend.toFixed(1)}`,
    `momentum:${fp.avgMomentum.toFixed(1)}`,
    `volScore:${fp.avgVolatility.toFixed(1)}`,
    `sentiment:${fp.avgSentiment.toFixed(1)}`,
  ].join(" ");
}

async function getEmbedding(text: string): Promise<number[]> {
  const cacheKey = `analog:emb:${createHash("sha256").update(text).digest("hex").slice(0, 32)}`;
  const cached = await getCache<number[]>(cacheKey);
  if (cached) return cached;

  const response = await getEmbeddingClient().embeddings.create({
    model: getAzureEmbeddingDeployment(),
    input: text,
    dimensions: EMBEDDING_DIMS,
    encoding_format: "float",
  });
  const embedding = response.data[0].embedding;
  await setCache(cacheKey, embedding, CACHE_TTL);
  return embedding;
}

function median(values: number[]): number | null {
  const valid = values.filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatPeriodLabel(start: Date, end: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = new Date(start);
  const e = new Date(end);
  return `${months[s.getMonth()]} ${s.getFullYear()} – ${months[e.getMonth()]} ${e.getFullYear()}`;
}

export async function getCurrentMarketFingerprint(region = "US"): Promise<MarketFingerprint | null> {
  try {
    const [regime, scores] = await Promise.all([
      prisma.marketRegime.findFirst({
        where: { region },
        orderBy: { date: "desc" },
        select: { state: true, breadthScore: true, correlationMetrics: true },
      }),
      prisma.assetScore.groupBy({
        by: ["type"],
        where: {
          asset: { region, type: "CRYPTO" },
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _avg: { value: true },
      }),
    ]);

    if (!regime) return null;

    const scoreMap: Record<string, number> = {};
    for (const s of scores) {
      scoreMap[s.type] = s._avg?.value ?? 50;
    }

    const corrMetrics = regime.correlationMetrics as Record<string, unknown> | null;
    const crossSectorCorr =
      (corrMetrics?.crossSector as { avgCorrelation?: number } | undefined)?.avgCorrelation ?? 0.5;

    return {
      regimeState: regime.state,
      breadthScore: regime.breadthScore ?? 50,
      volatilityLevel: scoreMap["VOLATILITY"] ?? 50,
      crossSectorCorr,
      avgTrend: scoreMap["TREND"] ?? 50,
      avgMomentum: scoreMap["MOMENTUM"] ?? 50,
      avgVolatility: scoreMap["VOLATILITY"] ?? 50,
      avgSentiment: scoreMap["SENTIMENT"] ?? 50,
    };
  } catch (e) {
    logger.error({ err: e }, "Failed to build current market fingerprint");
    return null;
  }
}

export async function findHistoricalAnalogs(
  region = "US",
  topK = TOP_K,
): Promise<AnalogSearchResult | null> {
  const cacheKey = `analog:search:${region}:${topK}`;
  const cached = await getCache<AnalogSearchResult>(cacheKey);
  if (cached) return cached;

  const fingerprint = await getCurrentMarketFingerprint(region);
  if (!fingerprint) return null;

  const text = fingerprintToText(fingerprint);
  const embedding = await getEmbedding(text);
  const vectorString = toPgVectorLiteral(embedding);

  type RawAnalog = {
    id: string;
    windowStart: Date;
    windowEnd: Date;
    regimeState: string;
    breadthScore: number;
    fwdReturn5d: number | null;
    fwdReturn20d: number | null;
    fwdReturn60d: number | null;
    maxDrawdown20d: number | null;
    recoveryDays: number | null;
    topSectors: unknown;
    similarity: number;
  };

  try {
    const rows = await prisma.$queryRawUnsafe<RawAnalog[]>(`
      SELECT
        id,
        "windowStart",
        "windowEnd",
        "regimeState",
        "breadthScore",
        "fwdReturn5d",
        "fwdReturn20d",
        "fwdReturn60d",
        "maxDrawdown20d",
        "recoveryDays",
        "topSectors",
        1 - (embedding <=> $1::vector) AS similarity
      FROM "HistoricalAnalog"
      WHERE region = $2
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3
        AND "windowEnd" < NOW() - INTERVAL '60 days'
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $4;
    `, vectorString, region, SIMILARITY_THRESHOLD, topK);

    if (rows.length === 0) {
      return null;
    }

    const analogs: HistoricalAnalogResult[] = rows.map((r) => ({
      id: r.id,
      windowStart: r.windowStart.toISOString(),
      windowEnd: r.windowEnd.toISOString(),
      regimeState: r.regimeState,
      breadthScore: r.breadthScore,
      similarity: Math.round(r.similarity * 100) / 100,
      forwardReturns: {
        fwd5d: r.fwdReturn5d,
        fwd20d: r.fwdReturn20d,
        fwd60d: r.fwdReturn60d,
      },
      maxDrawdown20d: r.maxDrawdown20d,
      recoveryDays: r.recoveryDays,
      topSectors: Array.isArray(r.topSectors) ? (r.topSectors as string[]) : [],
      label: formatPeriodLabel(r.windowStart, r.windowEnd),
    }));

    const result: AnalogSearchResult = {
      analogs,
      currentFingerprint: fingerprint,
      medianFwd5d: median(analogs.map((a) => a.forwardReturns.fwd5d).filter((v): v is number => v !== null)),
      medianFwd20d: median(analogs.map((a) => a.forwardReturns.fwd20d).filter((v): v is number => v !== null)),
      medianFwd60d: median(analogs.map((a) => a.forwardReturns.fwd60d).filter((v): v is number => v !== null)),
      worstDrawdown: analogs.reduce<number | null>((worst, a) => {
        if (a.maxDrawdown20d === null) return worst;
        return worst === null ? a.maxDrawdown20d : Math.min(worst, a.maxDrawdown20d);
      }, null),
      analogCount: analogs.length,
    };

    await setCache(cacheKey, result, CACHE_TTL);
    return result;
  } catch (e) {
    logger.error({ err: e }, "Historical analog search failed");
    return null;
  }
}

export function formatAnalogContext(result: AnalogSearchResult, riskRewardRatio?: string): string {
  const { analogs, medianFwd5d, medianFwd20d, medianFwd60d, worstDrawdown } = result;
  if (analogs.length === 0) return "";

  // 1. Calculate Regime Change Probability
  const transitionCounts: Record<string, number> = {};
  for (const a of analogs) {
    transitionCounts[a.regimeState] = (transitionCounts[a.regimeState] || 0) + 1;
  }
  
  const currentRegime = result.currentFingerprint.regimeState;
  const probabilities = Object.entries(transitionCounts)
    .map(([regime, count]) => {
      const prob = (count / analogs.length) * 100;
      return `${currentRegime} → ${regime}: ${prob.toFixed(0)}%`;
    })
    .join(" | ");

  const lines: string[] = [
    `[HISTORICAL_ANALOGS] ${analogs.length} similar market periods found (similarity ≥ ${Math.round(SIMILARITY_THRESHOLD * 100)}%)`,
    `Current regime: ${currentRegime} | Breadth: ${result.currentFingerprint.breadthScore.toFixed(0)}`,
    `Regime Transition Probabilities: ${probabilities}`,
  ];
  
  if (riskRewardRatio) {
    lines.push(`Risk/Reward Asymmetry: ${riskRewardRatio}`);
  }

  lines.push("", "Matched periods:");

  for (const a of analogs) {
    const fwd20 = a.forwardReturns.fwd20d !== null ? `${a.forwardReturns.fwd20d > 0 ? "+" : ""}${a.forwardReturns.fwd20d.toFixed(1)}%` : "N/A";
    const dd = a.maxDrawdown20d !== null ? `DD:${a.maxDrawdown20d.toFixed(1)}%` : "";
    lines.push(`  • ${a.label} (${a.regimeState}, sim:${(a.similarity * 100).toFixed(0)}%) → 20d fwd: ${fwd20} ${dd}`);
  }

  lines.push("");
  if (medianFwd5d !== null) lines.push(`Median forward returns: 5d ${medianFwd5d > 0 ? "+" : ""}${medianFwd5d.toFixed(1)}% | 20d ${medianFwd20d !== null ? (medianFwd20d > 0 ? "+" : "") + medianFwd20d.toFixed(1) + "%" : "N/A"} | 60d ${medianFwd60d !== null ? (medianFwd60d > 0 ? "+" : "") + medianFwd60d.toFixed(1) + "%" : "N/A"}`);
  if (worstDrawdown !== null) lines.push(`Worst 20d drawdown across analogs: ${worstDrawdown.toFixed(1)}%`);

  return lines.join("\n");
}
