/**
 * backdate-market-regime.ts
 *
 * Backfills MarketRegime table with 1 year of historical data derived from:
 * - Benchmark price action (SPY for US, NIFTYBEES.NS/ICICIB22.NS for IN)
 * - AssetScore aggregates (breadth, volatility, momentum)
 *
 * Run: npx tsx scripts/backdate-market-regime.ts [--region US|IN] [--force]
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const REGION = args.includes("--region") ? args[args.indexOf("--region") + 1] : "US";
const FORCE = args.includes("--force");
const DAYS = args.includes("--days") ? parseInt(args[args.indexOf("--days") + 1], 10) : 0; // 0 = all available

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function deriveRegimeState(
  ret5d: number,
  ret20d: number,
  breadth: number,
  volatility: number,
): string {
  // Strong Risk-On: positive momentum + broad participation + low vol
  if (ret20d > 4 && breadth > 65 && volatility < 50) return "STRONG_RISK_ON";
  // Risk-On: positive trend, decent breadth
  if (ret20d > 1.5 && breadth > 55) return "RISK_ON";
  // Risk-Off: sharp drawdown + high vol
  if (ret20d < -4 && volatility > 65) return "RISK_OFF";
  // Defensive: negative trend, moderate vol
  if (ret20d < -1.5 || (ret5d < -2 && volatility > 60)) return "DEFENSIVE";
  // Neutral
  return "NEUTRAL";
}

/**
 * Build a full MarketContextSnapshot JSON string — same shape as calculateMarketContext().
 * This makes backdated rows readable by getLatestMarketContext, API routes, and
 * calculateMultiHorizonRegime (which needs 60+ valid JSON rows).
 */
function buildContextJson(
  regimeState: string,
  breadth: number,
  volatility: number,
  ret5d: number,
  ret20d: number,
  benchSymbol: string,
): string {
  // Volatility state score = 100 - raw vol score (higher = more stable)
  const volStateScore = Math.round(100 - volatility);

  type VolatilityState = "SUPPRESSED" | "STABLE" | "NORMAL" | "ELEVATED" | "STRESS";
  type LiquidityCondition = "VERY_STRONG" | "STRONG" | "ADEQUATE" | "THIN" | "FRAGILE";
  type RiskSentiment = "RISK_EMBRACING" | "RISK_SEEKING" | "BALANCED" | "CAUTIOUS" | "RISK_AVERSION";
  type MarketBreadth = "VERY_BROAD" | "BROAD" | "MIXED" | "WEAK" | "NARROW";

  let volLabel: VolatilityState = "NORMAL";
  if (volStateScore >= 75) volLabel = "SUPPRESSED";
  else if (volStateScore >= 60) volLabel = "STABLE";
  else if (volStateScore <= 30) volLabel = "STRESS";
  else if (volStateScore <= 45) volLabel = "ELEVATED";

  let breadthLabel: MarketBreadth = "MIXED";
  if (breadth >= 75) breadthLabel = "VERY_BROAD";
  else if (breadth >= 60) breadthLabel = "BROAD";
  else if (breadth <= 30) breadthLabel = "NARROW";
  else if (breadth <= 45) breadthLabel = "WEAK";

  // Liquidity proxy: derived from breadth (broad market = better liquidity)
  const liqScore = Math.round(breadth * 0.6 + volStateScore * 0.4);
  let liqLabel: LiquidityCondition = "ADEQUATE";
  if (liqScore >= 75) liqLabel = "VERY_STRONG";
  else if (liqScore >= 60) liqLabel = "STRONG";
  else if (liqScore <= 30) liqLabel = "FRAGILE";
  else if (liqScore <= 45) liqLabel = "THIN";

  // Risk sentiment proxy: derived from 5d return momentum + breadth
  const riskScore = Math.round(Math.min(100, Math.max(0, 50 + ret5d * 3 + (breadth - 50) * 0.4)));
  let riskLabel: RiskSentiment = "BALANCED";
  if (riskScore >= 75) riskLabel = "RISK_EMBRACING";
  else if (riskScore >= 60) riskLabel = "RISK_SEEKING";
  else if (riskScore <= 30) riskLabel = "RISK_AVERSION";
  else if (riskScore <= 45) riskLabel = "CAUTIOUS";

  // Regime composite score (mirrors calculateMarketContext formula)
  const regimeScore = Math.round(breadth * 0.4 + volStateScore * 0.3 + riskScore * 0.3);

  const snapshot = {
    regime: {
      score: regimeScore,
      label: regimeState,
      confidence: "medium" as const,
      drivers: [
        regimeState === "STRONG_RISK_ON" ? "Broad participation with suppressed volatility"
          : regimeState === "RISK_ON" ? "Positive trend structure with stable participation"
          : regimeState === "RISK_OFF" ? "Systemic trend breakdown with elevated stress"
          : regimeState === "DEFENSIVE" ? "Narrowing breadth and cautious sentiment"
          : "Mixed signals across dimensions",
        `5d: ${ret5d.toFixed(1)}% | 20d: ${ret20d.toFixed(1)}% via ${benchSymbol}`,
      ],
    },
    risk: {
      score: riskScore,
      label: riskLabel,
      confidence: "medium" as const,
      drivers: [
        riskLabel === "RISK_EMBRACING" ? "Aggressive sentiment and momentum alignment"
          : riskLabel === "RISK_AVERSION" ? "Widespread capital preservation bias"
          : "Balanced risk appetite",
      ],
    },
    volatility: {
      score: volStateScore,
      label: volLabel,
      confidence: "high" as const,
      drivers: [`Realized volatility score: ${Math.round(volatility)} (inverted to ${volStateScore})`],
    },
    breadth: {
      score: Math.round(breadth),
      label: breadthLabel,
      confidence: "high" as const,
      drivers: [`${Math.round(breadth)}% of trading days in rolling window maintained positive return`],
    },
    liquidity: {
      score: liqScore,
      label: liqLabel,
      confidence: "medium" as const,
      drivers: ["Estimated from breadth and volatility proxy"],
    },
    lastUpdated: new Date().toISOString(),
  };

  return JSON.stringify(snapshot);
}

function buildCorrelationMetrics(
  regimeState: string,
  breadth: number,
  volatility: number,
  crossSectorCorr: number,
): Record<string, unknown> {
  const dispersion = Math.round((1 - crossSectorCorr) * 100);
  return {
    crossSector: {
      regime: regimeState,
      avgCorrelation: Math.round(crossSectorCorr * 100) / 100,
      trend: breadth > 60 ? "RISING" : breadth < 40 ? "FALLING" : "FLAT",
      sectorDispersionIndex: dispersion,
      guidance: regimeState.includes("RISK_ON")
        ? "High correlation — sector rotation limited, broad exposure preferred"
        : regimeState === "RISK_OFF"
        ? "Defensive rotation — reduce equity exposure, favor bonds/gold"
        : "Mixed signals — selective positioning, monitor breadth",
      implications: `Breadth: ${breadth.toFixed(0)} | Vol: ${volatility.toFixed(0)} | Dispersion: ${dispersion}`,
    },
  } satisfies Prisma.InputJsonValue;
}

async function backdateRegion(region: string) {
  console.log(`\n[${region}] Starting MarketRegime backdate...`);

  // Check existing
  const existing = await prisma.marketRegime.count({ where: { region } });
  console.log(`[${region}] Existing MarketRegime rows: ${existing}`);

  if (existing > 20 && !FORCE) {
    console.log(`[${region}] Already has ${existing} rows. Use --force to re-backdate.`);
    return;
  }

  const cutoffDate = DAYS > 0 ? new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000) : null;
  if (cutoffDate) console.log(`[${region}] Limiting to last ${DAYS} days (since ${cutoffDate.toISOString().slice(0, 10)})`);

  // Find benchmark
  const benchmarkSymbols =
    region === "IN"
      ? ["NIFTYBEES.NS", "ICICIB22.NS", "^NSEI", "NIFTY50"]
      : ["SPY", "VOO", "IVV"];

  const benchmark = await prisma.asset.findFirst({
    where: { symbol: { in: benchmarkSymbols }, region },
    select: { id: true, symbol: true },
  });

  if (!benchmark) {
    // Fallback: any ETF
    const fallback = await prisma.asset.findFirst({
      where: { type: "ETF", region },
      orderBy: { avgTrendScore: "desc" },
      select: { id: true, symbol: true },
    });
    if (!fallback) {
      console.log(`[${region}] No benchmark found — skipping`);
      return;
    }
    console.log(`[${region}] Using fallback benchmark: ${fallback.symbol}`);
  }

  const bench = benchmark ?? (await prisma.asset.findFirst({
    where: { type: "ETF", region },
    orderBy: { avgTrendScore: "desc" },
    select: { id: true, symbol: true },
  }))!;

  console.log(`[${region}] Benchmark: ${bench.symbol}`);

  // Load all price history
  const prices = await prisma.priceHistory.findMany({
    where: { assetId: bench.id },
    orderBy: { date: "asc" },
    select: { date: true, close: true },
  });

  if (prices.length < 25) {
    console.log(`[${region}] Not enough price history (${prices.length} rows)`);
    return;
  }

  // Build price map
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    priceMap.set(p.date.toISOString().slice(0, 10), p.close);
  }

  function getPriceNear(targetDate: Date, lookback = false): number | null {
    for (let offset = 0; offset <= 5; offset++) {
      const d = addDays(targetDate, lookback ? -offset : offset);
      const p = priceMap.get(d.toISOString().slice(0, 10));
      if (p !== undefined) return p;
    }
    return null;
  }

  // Pre-compute daily returns array for rolling calculations
  const dailyReturns: number[] = [0];
  for (let i = 1; i < prices.length; i++) {
    dailyReturns.push((prices[i].close - prices[i - 1].close) / prices[i - 1].close * 100);
  }

  // Compute 20-day realized volatility (annualized, scaled to 0-100)
  function getRealizedVol(idx: number, window = 20): number {
    const start = Math.max(1, idx - window + 1);
    const slice = dailyReturns.slice(start, idx + 1);
    if (slice.length < 3) return 50;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const annualizedVol = Math.sqrt(variance * 252); // annualized %
    // Scale: 10% annualized vol → score 30, 30% → score 70, 50%+ → score 90
    return Math.min(95, Math.max(10, 10 + annualizedVol * 1.6));
  }

  // Breadth proxy: % of last 20 days that were positive (0-100)
  function getBreadthProxy(idx: number, window = 20): number {
    const start = Math.max(1, idx - window + 1);
    const slice = dailyReturns.slice(start, idx + 1);
    if (slice.length === 0) return 50;
    const positiveDays = slice.filter(r => r > 0).length;
    return Math.round((positiveDays / slice.length) * 100);
  }

  // Cross-sector correlation proxy: rolling return autocorrelation (momentum persistence)
  function getCrossCorr(idx: number, window = 20): number {
    const start = Math.max(1, idx - window + 1);
    const slice = dailyReturns.slice(start, idx + 1);
    if (slice.length < 5) return 0.5;
    // Positive autocorrelation → trending/correlated market
    let sameSign = 0;
    for (let j = 1; j < slice.length; j++) {
      if (Math.sign(slice[j]) === Math.sign(slice[j - 1])) sameSign++;
    }
    return Math.round((sameSign / (slice.length - 1)) * 100) / 100;
  }

  // Delete existing rows if force
  if (FORCE && existing > 0) {
    await prisma.marketRegime.deleteMany({ where: { region } });
    console.log(`[${region}] Deleted ${existing} existing rows`);
  }

  // Generate one regime row per day (skip weekends)
  let inserted = 0;
  let skipped = 0;

  for (let i = 25; i < prices.length; i++) {
    const currentDate = prices[i].date;
    const dayOfWeek = currentDate.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends
    if (cutoffDate && currentDate < cutoffDate) continue; // skip rows outside requested window

    const currentPrice = prices[i].close;

    // 5d and 20d returns
    const price5dAgo = getPriceNear(addDays(currentDate, -5), true);
    const price20dAgo = getPriceNear(addDays(currentDate, -20), true);
    const ret5d = price5dAgo ? ((currentPrice - price5dAgo) / price5dAgo) * 100 : 0;
    const ret20d = price20dAgo ? ((currentPrice - price20dAgo) / price20dAgo) * 100 : 0;

    // Price-derived breadth, volatility, and cross-sector correlation
    const breadth = getBreadthProxy(i);
    const volatility = getRealizedVol(i);
    const crossSectorCorr = getCrossCorr(i);

    const regimeState = deriveRegimeState(ret5d, ret20d, breadth, volatility);
    const correlationMetrics = buildCorrelationMetrics(regimeState, breadth, volatility, crossSectorCorr);

    const contextJson = buildContextJson(regimeState, breadth, volatility, ret5d, ret20d, bench.symbol);

    try {
      await prisma.marketRegime.upsert({
        where: { date_region: { date: currentDate, region } },
        create: {
          date: currentDate,
          region,
          state: regimeState,
          breadthScore: Math.round(breadth * 10) / 10,
          vixValue: Math.round(volatility * 10) / 10,
          context: contextJson,
          correlationMetrics: correlationMetrics as Prisma.InputJsonValue,
        },
        update: {
          state: regimeState,
          breadthScore: Math.round(breadth * 10) / 10,
          vixValue: Math.round(volatility * 10) / 10,
          context: contextJson,
          correlationMetrics: correlationMetrics as Prisma.InputJsonValue,
        },
      });
      inserted++;
    } catch {
      skipped++;
    }
  }

  console.log(`[${region}] ✓ Inserted/updated ${inserted} MarketRegime rows (skipped: ${skipped})`);
}

async function main() {
  console.log(`\n=== MarketRegime Backdater ===`);
  console.log(`Region: ${REGION} | Force: ${FORCE}`);

  if (REGION === "BOTH") {
    await backdateRegion("US");
    await backdateRegion("IN");
  } else {
    await backdateRegion(REGION);
  }

  console.log("\nNote: context field now written as MarketContextSnapshot JSON (parseable by all consumers).");

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
