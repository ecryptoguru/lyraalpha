/**
 * Engine Backtest Harness
 * 
 * Replays historical OHLCV data through all core scoring engines and measures
 * how well their signals predicted future price movement over 5, 10, and 20 day horizons.
 * 
 * Methodology:
 * - For each asset, slide a window through history
 * - At each window position, compute engine scores using only data up to that point
 * - Measure actual forward returns at 5d, 10d, 20d
 * - Correlate engine scores with forward returns
 * - Report hit rates, correlation, and signal quality
 * 
 * Usage: npx tsx src/scripts/backtest-engines.ts
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { OHLCV } from "../lib/engines/types";
import { calculateTrendScore } from "../lib/engines/trend";
import { calculateMomentumScore } from "../lib/engines/momentum";
import { calculateVolatilityScore } from "../lib/engines/volatility";
import { calculateSentimentScore } from "../lib/engines/sentiment";
// Performance engine tested implicitly via forward returns calculation

// ─── DB Setup ───────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.error("DATABASE_URL or DIRECT_URL required");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Config ─────────────────────────────────────────────────────────
const WINDOW_SIZE = 200;       // Feed 200 days of history to engines
const STEP_SIZE = 5;           // Slide window every 5 days
const FORWARD_HORIZONS = [5, 10, 20]; // Measure forward returns at these horizons
const MAX_ASSETS = 50;         // Backtest top 50 assets by data availability
const MIN_HISTORY = WINDOW_SIZE + Math.max(...FORWARD_HORIZONS) + 10;

// ─── Types ──────────────────────────────────────────────────────────
interface BacktestSample {
  symbol: string;
  date: string;
  scores: {
    trend: number;
    momentum: number;
    volatility: number;
    sentiment: number;
  };
  forwardReturns: Record<number, number>; // horizon -> return %
}

interface EngineMetrics {
  engine: string;
  samples: number;
  // Directional accuracy: did score > 50 predict positive return?
  hitRate: Record<number, number>;
  // Pearson correlation between score and forward return
  correlation: Record<number, number>;
  // Average score when forward return was positive vs negative
  avgScoreWhenPositive: Record<number, number>;
  avgScoreWhenNegative: Record<number, number>;
  // Signal quality: avg return when score > 70 vs score < 30
  avgReturnHighSignal: Record<number, number>;
  avgReturnLowSignal: Record<number, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 5) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function toOHLCV(rows: { date: Date; open: number; high: number; low: number; close: number; volume: number }[]): OHLCV[] {
  return rows.map(r => ({
    date: r.date.toISOString(),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

// ─── Main ───────────────────────────────────────────────────────────

async function runBacktest() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ENGINE BACKTEST HARNESS");
  console.log("  Window: %d days | Step: %d days | Horizons: %s", WINDOW_SIZE, STEP_SIZE, FORWARD_HORIZONS.join(", "));
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Find assets with sufficient history
  const assetCounts = await prisma.$queryRaw<{ assetId: string; symbol: string; cnt: bigint }[]>`
    SELECT a.id as "assetId", a.symbol, COUNT(ph.id)::bigint as cnt
    FROM "Asset" a
    JOIN "PriceHistory" ph ON ph."assetId" = a.id
    WHERE a.type IN ('STOCK', 'ETF', 'CRYPTO')
    GROUP BY a.id, a.symbol
    HAVING COUNT(ph.id) >= ${MIN_HISTORY}
    ORDER BY COUNT(ph.id) DESC
    LIMIT ${MAX_ASSETS}
  `;

  console.log(`Found ${assetCounts.length} assets with >= ${MIN_HISTORY} days of history\n`);

  if (assetCounts.length === 0) {
    console.log("No assets with sufficient history for backtesting.");
    await prisma.$disconnect();
    return;
  }

  const allSamples: BacktestSample[] = [];

  // 2. Process each asset
  for (const { assetId, symbol } of assetCounts) {
    process.stdout.write(`  Backtesting ${symbol.padEnd(10)} `);

    const history = await prisma.priceHistory.findMany({
      where: { assetId },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
    });

    const ohlcv = toOHLCV(history);
    let sampleCount = 0;

    // 3. Slide window through history
    for (let i = WINDOW_SIZE; i <= ohlcv.length - Math.max(...FORWARD_HORIZONS); i += STEP_SIZE) {
      const window = ohlcv.slice(i - WINDOW_SIZE, i);
      const currentPrice = window[window.length - 1].close;
      if (currentPrice <= 0) continue;

      // Compute engine scores on this window
      const trend = calculateTrendScore(window);
      const momentum = calculateMomentumScore(window);
      const volatility = calculateVolatilityScore(window, "STOCK");
      const sentiment = calculateSentimentScore(window);

      // Measure forward returns
      const forwardReturns: Record<number, number> = {};
      for (const horizon of FORWARD_HORIZONS) {
        const futureIdx = i + horizon - 1;
        if (futureIdx < ohlcv.length) {
          const futurePrice = ohlcv[futureIdx].close;
          forwardReturns[horizon] = ((futurePrice - currentPrice) / currentPrice) * 100;
        }
      }

      allSamples.push({
        symbol,
        date: window[window.length - 1].date,
        scores: {
          trend: trend.score,
          momentum: momentum.score,
          volatility: volatility.score,
          sentiment: sentiment.score,
        },
        forwardReturns,
      });
      sampleCount++;
    }

    console.log(`${sampleCount} samples`);
  }

  console.log(`\nTotal samples: ${allSamples.length}\n`);

  // 4. Analyze each engine
  const engines = ["trend", "momentum", "volatility", "sentiment"] as const;
  const results: EngineMetrics[] = [];

  for (const engine of engines) {
    const metrics: EngineMetrics = {
      engine,
      samples: allSamples.length,
      hitRate: {},
      correlation: {},
      avgScoreWhenPositive: {},
      avgScoreWhenNegative: {},
      avgReturnHighSignal: {},
      avgReturnLowSignal: {},
    };

    for (const horizon of FORWARD_HORIZONS) {
      const validSamples = allSamples.filter(s => s.forwardReturns[horizon] !== undefined);
      const scores = validSamples.map(s => s.scores[engine]);
      const returns = validSamples.map(s => s.forwardReturns[horizon]);

      // Directional hit rate
      // For trend/momentum: score > 50 should predict positive return
      // For volatility: score > 50 means HIGH vol, so we invert (high vol → negative return expected)
      const isInverse = engine === "volatility";
      let hits = 0;
      for (let i = 0; i < scores.length; i++) {
        const predictUp = isInverse ? scores[i] < 50 : scores[i] > 50;
        const actualUp = returns[i] > 0;
        if (predictUp === actualUp) hits++;
      }
      metrics.hitRate[horizon] = validSamples.length > 0 ? Math.round((hits / validSamples.length) * 10000) / 100 : 0;

      // Correlation
      metrics.correlation[horizon] = Math.round(pearson(
        isInverse ? scores.map(s => 100 - s) : scores,
        returns
      ) * 1000) / 1000;

      // Avg score when positive vs negative return
      const positiveSamples = validSamples.filter(s => s.forwardReturns[horizon] > 0);
      const negativeSamples = validSamples.filter(s => s.forwardReturns[horizon] <= 0);
      metrics.avgScoreWhenPositive[horizon] = positiveSamples.length > 0
        ? Math.round(positiveSamples.reduce((s, v) => s + v.scores[engine], 0) / positiveSamples.length * 10) / 10
        : 0;
      metrics.avgScoreWhenNegative[horizon] = negativeSamples.length > 0
        ? Math.round(negativeSamples.reduce((s, v) => s + v.scores[engine], 0) / negativeSamples.length * 10) / 10
        : 0;

      // Signal quality: avg return when high signal vs low signal
      const highSignal = validSamples.filter(s => s.scores[engine] > 70);
      const lowSignal = validSamples.filter(s => s.scores[engine] < 30);
      metrics.avgReturnHighSignal[horizon] = highSignal.length > 0
        ? Math.round(highSignal.reduce((s, v) => s + v.forwardReturns[horizon], 0) / highSignal.length * 100) / 100
        : 0;
      metrics.avgReturnLowSignal[horizon] = lowSignal.length > 0
        ? Math.round(lowSignal.reduce((s, v) => s + v.forwardReturns[horizon], 0) / lowSignal.length * 100) / 100
        : 0;
    }

    results.push(metrics);
  }

  // 5. Print results
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  BACKTEST RESULTS");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const r of results) {
    const tag = r.engine === "sentiment" ? " ⚠️  MOCK" : "";
    console.log(`┌─── ${r.engine.toUpperCase()} ENGINE${tag} ───────────────────────────────`);
    console.log(`│ Samples: ${r.samples}`);
    console.log("│");
    console.log("│  Horizon    Hit Rate    Correlation   Avg Score(+)  Avg Score(-)  Ret(>70)   Ret(<30)");
    console.log("│  ───────    ────────    ───────────   ────────────  ────────────  ────────   ────────");
    for (const h of FORWARD_HORIZONS) {
      const hr = `${r.hitRate[h]}%`.padEnd(10);
      const corr = `${r.correlation[h]}`.padEnd(13);
      const avgPos = `${r.avgScoreWhenPositive[h]}`.padEnd(13);
      const avgNeg = `${r.avgScoreWhenNegative[h]}`.padEnd(13);
      const retHigh = `${r.avgReturnHighSignal[h]}%`.padEnd(10);
      const retLow = `${r.avgReturnLowSignal[h]}%`.padEnd(10);
      console.log(`│  ${String(h).padEnd(2)}d        ${hr}  ${corr} ${avgPos} ${avgNeg} ${retHigh} ${retLow}`);
    }
    console.log("└──────────────────────────────────────────────────────────\n");
  }

  // 6. Composite analysis
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  COMPOSITE SIGNAL ANALYSIS (Trend + Momentum combined)");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const horizon of FORWARD_HORIZONS) {
    const validSamples = allSamples.filter(s => s.forwardReturns[horizon] !== undefined);

    // Composite: (trend * 0.4 + momentum * 0.3 + (100 - volatility) * 0.3)
    const compositeScores = validSamples.map(s =>
      s.scores.trend * 0.4 + s.scores.momentum * 0.3 + (100 - s.scores.volatility) * 0.3
    );
    const returns = validSamples.map(s => s.forwardReturns[horizon]);

    let hits = 0;
    for (let i = 0; i < compositeScores.length; i++) {
      if ((compositeScores[i] > 50 && returns[i] > 0) || (compositeScores[i] <= 50 && returns[i] <= 0)) hits++;
    }
    const hitRate = validSamples.length > 0 ? Math.round((hits / validSamples.length) * 10000) / 100 : 0;
    const corr = Math.round(pearson(compositeScores, returns) * 1000) / 1000;

    const highComposite = validSamples.filter((_, i) => compositeScores[i] > 65);
    const lowComposite = validSamples.filter((_, i) => compositeScores[i] < 35);
    const avgRetHigh = highComposite.length > 0
      ? Math.round(highComposite.reduce((s, v) => s + v.forwardReturns[horizon], 0) / highComposite.length * 100) / 100
      : 0;
    const avgRetLow = lowComposite.length > 0
      ? Math.round(lowComposite.reduce((s, v) => s + v.forwardReturns[horizon], 0) / lowComposite.length * 100) / 100
      : 0;

    console.log(`  ${horizon}d horizon: Hit Rate ${hitRate}% | Corr ${corr} | Ret(>65) ${avgRetHigh}% | Ret(<35) ${avgRetLow}%`);
  }

  // 7. Sentiment sanity check
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  SENTIMENT SANITY CHECK");
  console.log("═══════════════════════════════════════════════════════════\n");

  const sentScores = allSamples.map(s => s.scores.sentiment);
  const uniqueSent = new Set(sentScores);
  const sentMean = sentScores.reduce((s, v) => s + v, 0) / sentScores.length;
  const sentStd = Math.sqrt(sentScores.reduce((s, v) => s + (v - sentMean) ** 2, 0) / sentScores.length);

  console.log(`  Unique values: ${uniqueSent.size} / ${sentScores.length} samples`);
  console.log(`  Mean: ${sentMean.toFixed(1)} | StdDev: ${sentStd.toFixed(1)}`);
  console.log(`  Distribution: ${sentScores.filter(s => s > 60).length} bullish, ${sentScores.filter(s => s >= 40 && s <= 60).length} neutral, ${sentScores.filter(s => s < 40).length} bearish`);

  const sentCorr5 = pearson(
    sentScores,
    allSamples.filter(s => s.forwardReturns[5] !== undefined).map(s => s.forwardReturns[5])
  );
  console.log(`  Correlation with 5d returns: ${sentCorr5.toFixed(3)}`);
  console.log(`  Verdict: ${Math.abs(sentCorr5) < 0.05 ? "⚠️  NO PREDICTIVE POWER (expected — it's random)" : "Unexpected signal detected"}`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  BACKTEST COMPLETE");
  console.log("═══════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

runBacktest().catch(err => {
  console.error("Backtest failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
