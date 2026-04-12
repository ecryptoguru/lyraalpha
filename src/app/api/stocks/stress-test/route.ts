import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import {
  getScenario,
  getBestProxyPath,
  estimateBeta,
} from "@/lib/stress-scenarios";
import type { ScenarioDefinition, SupportedStressAssetType } from "@/lib/stress-scenarios";
import { StressTestSchema } from "@/lib/schemas";
import { calculateMultiAssetAnalysisCredits, consumeCredits } from "@/lib/services/credit.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "stress-test-api" });
const MAX_STRESS_TEST_ASSETS = 3;

export const dynamic = "force-dynamic";

type StressMethod = "DIRECT" | "PROXY" | "ERROR";

type AssetRecord = {
  id: string;
  symbol: string;
  name: string;
  type: string;
  region: string | null;
  sector: string | null;
  category: string | null;
};

type PriceHistoryRow = {
  assetId: string;
  date: Date;
  close: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAssetType(assetType: string): SupportedStressAssetType {
  if (assetType === "CRYPTO" || assetType === "DEFI" || assetType === "NFTS" || assetType === "LAYER1" || assetType === "LAYER2") {
    return assetType;
  }

  return "CRYPTO";
}

function buildExplanationPayload(args: {
  asset: AssetRecord;
  scenario: ScenarioDefinition;
  method: Exclude<StressMethod, "ERROR">;
  proxyLabel?: string | null;
  normalizedType: SupportedStressAssetType;
}) {
  const adjustment = args.scenario.assetTypeAdjustments?.[args.normalizedType];
  const narrative = args.scenario.narrative;
  const fallbackHeadline = `${args.scenario.name} typically pressures ${args.asset.name} through the dominant market regime rather than a single company-specific catalyst.`;

  return {
    explanationMethod: args.method === "DIRECT" ? "historical-direct" : "historical-proxy-hybrid",
    driverSummary: narrative?.headline ?? fallbackHeadline,
    transmissionMechanism: narrative?.howItTransmits ?? args.scenario.description,
    pressurePoints: narrative?.pressurePoints ?? ["Broad equity weakness", "Higher volatility", "Risk-off positioning"],
    resilienceThemes: narrative?.resilienceThemes ?? ["Diversification", "Defensive assets", "Cash-flow resilience"],
    dominantDrivers: narrative?.dominantDrivers ?? ["Macro stress", "Cross-asset repricing"],
    rationale: adjustment?.rationale ?? `${args.asset.name} is mapped through ${args.proxyLabel ?? "the closest benchmark path"} because direct scenario history is limited.`,
  };
}

function buildDailyReturns(recentHistory: Array<{ close: number | null }>) {
  const validRecent = recentHistory
    .filter((p) => p.close != null)
    .map((p) => p.close as number)
    .reverse();

  const dailyReturns: number[] = [];
  for (let i = 1; i < validRecent.length; i++) {
    if (validRecent[i - 1] !== 0) {
      dailyReturns.push((validRecent[i] - validRecent[i - 1]) / validRecent[i - 1]);
    }
  }

  return dailyReturns;
}

function groupRecentHistory(rows: PriceHistoryRow[]) {
  const grouped = new Map<string, Array<{ date: Date; close: number | null }>>();

  for (const row of rows) {
    const current = grouped.get(row.assetId) ?? [];
    if (current.length < 252) {
      current.push({ date: row.date, close: row.close });
      grouped.set(row.assetId, current);
    }
  }

  for (const current of grouped.values()) {
    current.reverse();
  }

  return grouped;
}

function buildErrorResult(args: {
  symbol: string;
  name: string;
  type: string;
  region: string;
  scenarioId: string;
  error: string;
}) {
  return {
    symbol: args.symbol,
    name: args.name,
    type: args.type,
    region: args.region,
    scenarioId: args.scenarioId,
    method: "ERROR" as const,
    drawdown: null,
    periodReturn: null,
    maxDrawdown: null,
    dailyPath: [],
    proxyUsed: null,
    beta: null,
    confidence: 0,
    factors: null,
    scenarioSeverity: null,
    scenarioPeriod: null,
    driverSummary: null,
    transmissionMechanism: null,
    pressurePoints: [],
    resilienceThemes: [],
    dominantDrivers: [],
    rationale: null,
    explanationMethod: null,
    error: args.error,
  };
}

function buildReplayRiskMetrics(path: Array<{ day: number; drawdown: number }>) {
  if (path.length === 0) {
    return { drawdown: 0, maxDrawdown: 0, periodReturn: 0 };
  }

  let peak = 1 + path[0].drawdown;
  let maxDrawdown = 0;

  for (const point of path) {
    const value = 1 + point.drawdown;
    if (value > peak) peak = value;
    const currentDrawdown = (value - peak) / peak;
    if (currentDrawdown < maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }

  const finalValue = 1 + path[path.length - 1].drawdown;
  const endDrawdown = (finalValue - peak) / peak;

  return {
    drawdown: parseFloat(endDrawdown.toFixed(4)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
    periodReturn: parseFloat(path[path.length - 1].drawdown.toFixed(4)),
  };
}

function buildDirectReplay(validDirect: Array<{ date: Date; close: number }>, scenario: ScenarioDefinition) {
  const scenarioStart = new Date(scenario.period.start);
  const scenarioEnd = new Date(scenario.period.end);
  const startPrice = validDirect[0].close;
  const totalDays = Math.round((scenarioEnd.getTime() - scenarioStart.getTime()) / (1000 * 60 * 60 * 24));

  const dailyPath = validDirect.map((point, index) => {
    const cumulativeReturn = (point.close - startPrice) / startPrice;
    const approxDay = Math.round((index / validDirect.length) * totalDays);

    return {
      day: approxDay,
      drawdown: parseFloat(cumulativeReturn.toFixed(4)),
    };
  });

  const metrics = buildReplayRiskMetrics(dailyPath);

  return {
    drawdown: metrics.drawdown,
    periodReturn: metrics.periodReturn,
    maxDrawdown: metrics.maxDrawdown,
    dailyPath,
  };
}

function applyHybridAdjustment(args: {
  beta: number;
  asset: AssetRecord;
  scenario: ScenarioDefinition;
  normalizedType: SupportedStressAssetType;
}) {
  const baseRule = args.scenario.assetTypeAdjustments?.[args.normalizedType];
  let betaMultiplier = baseRule?.betaMultiplier ?? 1;
  let confidenceDelta = baseRule?.confidenceDelta ?? 0;

  const hintBlob = `${args.asset.symbol} ${args.asset.name} ${args.asset.sector ?? ""} ${args.asset.category ?? ""}`.toLowerCase();

  if (args.scenario.id === "tech-bubble-crash" && /tech|software|internet|semiconductor|nasdaq/.test(hintBlob)) {
    betaMultiplier += 0.08;
    confidenceDelta += 0.02;
  }

  if (args.scenario.id === "oil-spike" && /oil|energy|crude|gas/.test(hintBlob)) {
    betaMultiplier -= 0.12;
    confidenceDelta += 0.02;
  }

  if (args.scenario.id === "recession" && /bank|financial|finance|consumer discretionary|industrials/.test(hintBlob)) {
    betaMultiplier += 0.06;
  }

  if ((args.scenario.id === "recession" || args.scenario.id === "interest-rate-shock") && /gold|bullion/.test(hintBlob)) {
    betaMultiplier -= 0.1;
    confidenceDelta += 0.01;
  }

  if (!args.asset.sector && !args.asset.category && args.normalizedType !== "CRYPTO") {
    confidenceDelta -= 0.03;
  }

  return {
    adjustedBeta: clamp(args.beta * betaMultiplier, 0.2, 2.5),
    confidenceDelta,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    // Validate body FIRST — before spending any credits
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return apiError("Invalid request body", 400);
    }

    const parsed = StressTestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten() );
    }

    const { symbols, scenarioId, region } = parsed.data;

    const normalizedSymbols = Array.from(new Set(
      symbols.map((symbol: string) => symbol.trim().toUpperCase()).filter(Boolean)
    ));

    if (normalizedSymbols.length === 0) {
      return apiError("At least 1 unique symbol required", 400);
    }

    if (normalizedSymbols.length > MAX_STRESS_TEST_ASSETS) {
      return apiError(`Shock Simulator supports a maximum of ${MAX_STRESS_TEST_ASSETS} assets.`, 400);
    }

    const assets = await prisma.asset.findMany({
      where: { symbol: { in: normalizedSymbols } },
      select: { id: true, symbol: true, name: true, type: true, region: true, sector: true, category: true },
    });

    const assetsBySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));
    const missingSymbols = normalizedSymbols.filter((symbol) => !assetsBySymbol.has(symbol));
    const missingResults = missingSymbols.map((symbol) =>
      buildErrorResult({
        symbol,
        name: symbol,
        type: "UNKNOWN",
        region: region ?? "US",
        scenarioId,
        error: "Asset not found in database",
      })
    );

    const orderedAssets = normalizedSymbols
      .map((symbol) => assetsBySymbol.get(symbol))
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

    if (orderedAssets.length === 0) {
      return NextResponse.json({ results: missingResults, scenarioId });
    }

    const requiredCredits = calculateMultiAssetAnalysisCredits(orderedAssets.length);
    const { success, remaining } = await consumeCredits(userId, requiredCredits, `Stress test analysis (${normalizedSymbols.length} assets)`);
    if (!success) {
      return NextResponse.json({
        error: "Insufficient credits",
        remaining,
        message: `Stress test requires ${requiredCredits} credits. You have ${remaining}.`
      }, { status: 402 });
    }

    const assetsWithScenario = orderedAssets.map((asset) => {
      const assetRegion = (asset.region ?? region ?? "US") as "US" | "IN";
      const scenario = getScenario(scenarioId, assetRegion);

      return {
        asset,
        assetRegion,
        scenario,
      };
    });

    const recentRows = orderedAssets.length > 0
      ? await prisma.priceHistory.findMany({
          where: { assetId: { in: orderedAssets.map((asset) => asset.id) } },
          select: { assetId: true, date: true, close: true },
          orderBy: [{ assetId: "asc" }, { date: "desc" }],
        })
      : [];

    const recentHistoryByAssetId = groupRecentHistory(recentRows as PriceHistoryRow[]);

    const assetResults = await Promise.all(
      assetsWithScenario.map(async ({ asset, assetRegion, scenario }) => {
        try {
          if (!scenario) {
            return buildErrorResult({
              symbol: asset.symbol,
              name: asset.name,
              type: asset.type,
              region: assetRegion,
              scenarioId,
              error: `No scenario '${scenarioId}' for region ${assetRegion}`,
            });
          }

          const scenarioStart = new Date(scenario.period.start);
          const scenarioEnd = new Date(scenario.period.end);
          const normalizedType = normalizeAssetType(asset.type);
          const proxyPath = getBestProxyPath(scenario, asset.type, asset.symbol);

          const [directHistory] = await Promise.all([
            prisma.priceHistory.findMany({
              where: {
                assetId: asset.id,
                date: { gte: scenarioStart, lte: scenarioEnd },
              },
              select: { date: true, close: true },
              orderBy: { date: "asc" },
            }),
          ]);

          const recentHistory = recentHistoryByAssetId.get(asset.id) ?? [];
          const dailyReturns = buildDailyReturns(recentHistory);

          const rawBeta = dailyReturns.length >= 20
            ? estimateBeta(dailyReturns, proxyPath.proxy)
            : 1.0;

          const hybrid = applyHybridAdjustment({
            beta: rawBeta,
            asset,
            scenario,
            normalizedType,
          });

          const validDirect = directHistory
            .filter((p) => p.close != null)
            .map((p) => ({ date: p.date, close: p.close as number }));

          if (validDirect.length >= 30) {
            const replay = buildDirectReplay(validDirect, scenario);
            const explanation = buildExplanationPayload({
              asset,
              scenario,
              method: "DIRECT",
              normalizedType,
            });

            return {
              symbol: asset.symbol,
              name: asset.name,
              type: asset.type,
              region: assetRegion,
              scenarioId,
              method: "DIRECT" as const,
              drawdown: replay.drawdown,
              periodReturn: replay.periodReturn,
              maxDrawdown: replay.maxDrawdown,
              dailyPath: replay.dailyPath,
              proxyUsed: null,
              beta: null,
              confidence: 1.0,
              factors: scenario.factors,
              scenarioSeverity: scenario.severity ?? null,
              scenarioPeriod: scenario.period,
              driverSummary: explanation.driverSummary,
              transmissionMechanism: explanation.transmissionMechanism,
              pressurePoints: explanation.pressurePoints,
              resilienceThemes: explanation.resilienceThemes,
              dominantDrivers: explanation.dominantDrivers,
              rationale: explanation.rationale,
              explanationMethod: explanation.explanationMethod,
              dataPoints: validDirect.length,
            };
          }

          const scaledPath = proxyPath.path.map((point: { day: number; drawdown: number }) => ({
            day: point.day,
            drawdown: parseFloat((point.drawdown * hybrid.adjustedBeta).toFixed(4)),
          }));

          const replayMetrics = buildReplayRiskMetrics(scaledPath);
          const confidenceBase = dailyReturns.length >= 60 ? 0.65 : 0.45;
          const confidence = clamp(confidenceBase + hybrid.confidenceDelta, 0.2, 0.92);
          const explanation = buildExplanationPayload({
            asset,
            scenario,
            method: "PROXY",
            proxyLabel: proxyPath.label,
            normalizedType,
          });

          return {
            symbol: asset.symbol,
            name: asset.name,
            type: asset.type,
            region: assetRegion,
            scenarioId,
            method: "PROXY" as const,
            drawdown: replayMetrics.drawdown,
            periodReturn: replayMetrics.periodReturn,
            maxDrawdown: replayMetrics.maxDrawdown,
            dailyPath: scaledPath,
            proxyUsed: proxyPath.proxy,
            proxyLabel: proxyPath.label,
            beta: parseFloat(hybrid.adjustedBeta.toFixed(2)),
            confidence,
            factors: scenario.factors,
            scenarioSeverity: scenario.severity ?? null,
            driverSummary: explanation.driverSummary,
            transmissionMechanism: explanation.transmissionMechanism,
            pressurePoints: explanation.pressurePoints,
            resilienceThemes: explanation.resilienceThemes,
            dominantDrivers: explanation.dominantDrivers,
            rationale: explanation.rationale,
            explanationMethod: explanation.explanationMethod,
            dataPoints: dailyReturns.length,
            scenarioPeriod: scenario.period,
          };
        } catch (err) {
          logger.warn({ symbol: asset.symbol, err: sanitizeError(err) }, "Asset stress calc failed");
          return buildErrorResult({
            symbol: asset.symbol,
            name: asset.name,
            type: asset.type,
            region: asset.region ?? "US",
            scenarioId,
            error: "Calculation failed",
          });
        }
      }),
    );

    const resultsBySymbol = new Map([
      ...missingResults.map((result) => [result.symbol, result] as const),
      ...assetResults.map((result) => [result.symbol, result] as const),
    ]);
    const results = normalizedSymbols
      .map((symbol) => resultsBySymbol.get(symbol))
      .filter((result): result is NonNullable<typeof result> => Boolean(result));

    return NextResponse.json({ results, scenarioId });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Stress test API failed");
    return apiError("Internal error", 500);
  }
}
