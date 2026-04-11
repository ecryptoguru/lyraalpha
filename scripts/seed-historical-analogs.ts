/**
 * seed-historical-analogs.ts
 *
 * One-time script: builds 30-day sliding windows from PriceHistory + MarketRegime,
 * computes a market fingerprint per window, embeds it, and stores in HistoricalAnalog.
 *
 * Run: npx tsx scripts/seed-historical-analogs.ts [--region US|IN] [--force]
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import OpenAI from "openai";
import {
  getAzureEmbeddingDeployment,
  getAzureOpenAIApiKey,
  getAzureOpenAIBaseURL,
} from "../src/lib/ai/config";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

const openai = new OpenAI({
  apiKey: getAzureOpenAIApiKey(),
  baseURL: getAzureOpenAIBaseURL(),
});

const EMBEDDING_MODEL = getAzureEmbeddingDeployment() || "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const WINDOW_DAYS = 30;
const STEP_DAYS = 7;
const BATCH_SIZE = 20;

const args = process.argv.slice(2);
const REGION = args.includes("--region") ? args[args.indexOf("--region") + 1] : "US";
const FORCE = args.includes("--force");

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMS,
    encoding_format: "float",
  });
  return response.data.map((d) => d.embedding);
}

interface WindowData {
  windowStart: Date;
  windowEnd: Date;
  regimeState: string;
  breadthScore: number;
  volatilityLevel: number;
  crossSectorCorr: number;
  avgTrend: number;
  avgMomentum: number;
  avgVolatility: number;
  avgSentiment: number;
  fwdReturn5d: number | null;
  fwdReturn20d: number | null;
  fwdReturn60d: number | null;
  maxDrawdown20d: number | null;
  recoveryDays: number | null;
  topSectors: string[];
}

async function buildWindows(region: string): Promise<WindowData[]> {
  // Load MarketRegime history (now populated via backdate-market-regime.ts)
  const regimes = await prisma.marketRegime.findMany({
    where: { region },
    orderBy: { date: "asc" },
    select: { date: true, state: true, breadthScore: true, vixValue: true, correlationMetrics: true },
  });

  if (regimes.length < 2) {
    console.log(`[${region}] Not enough MarketRegime data (${regimes.length} rows). Run backdate-market-regime.ts first.`);
    return [];
  }

  const earliest = regimes[0].date;
  const latest = regimes[regimes.length - 1].date;
  console.log(`[${region}] MarketRegime: ${earliest.toISOString().slice(0, 10)} → ${latest.toISOString().slice(0, 10)} (${regimes.length} rows)`);

  // Find benchmark for forward return calculation
  const benchmarkSymbols = region === "IN"
    ? ["NIFTYBEES.NS", "ICICIB22.NS", "^NSEI", "NIFTY50"]
    : ["SPY", "IVV", "VOO"];

  const benchmarkAsset = await prisma.asset.findFirst({
    where: { symbol: { in: benchmarkSymbols }, region },
    select: { id: true, symbol: true },
  });

  const benchmark = benchmarkAsset ?? await prisma.asset.findFirst({
    where: { type: "CRYPTO", region },
    orderBy: { avgTrendScore: "desc" },
    select: { id: true, symbol: true },
  });

  if (!benchmark) {
    console.log(`[${region}] No benchmark asset found`);
    return [];
  }
  console.log(`[${region}] Benchmark: ${benchmark.symbol}`);

  // Load full price history for benchmark
  const allPrices = await prisma.priceHistory.findMany({
    where: { assetId: benchmark.id },
    orderBy: { date: "asc" },
    select: { date: true, close: true },
  });

  const priceMap = new Map<string, number>();
  for (const p of allPrices) {
    priceMap.set(p.date.toISOString().slice(0, 10), p.close);
  }

  function getPriceNear(targetDate: Date): number | null {
    for (let offset = 0; offset <= 5; offset++) {
      const d = addDays(targetDate, offset);
      const p = priceMap.get(d.toISOString().slice(0, 10));
      if (p !== undefined) return p;
    }
    return null;
  }


  const windows: WindowData[] = [];
  let cursor = new Date(earliest);

  while (addDays(cursor, WINDOW_DAYS + 62) <= latest) {
    const windowStart = new Date(cursor);
    const windowEnd = addDays(cursor, WINDOW_DAYS);
    const fwdEnd5d = addDays(windowEnd, 5);
    const fwdEnd20d = addDays(windowEnd, 20);
    const fwdEnd60d = addDays(windowEnd, 60);

    // Get MarketRegime rows within this window — use the midpoint row
    const regimesInWindow = regimes.filter(
      (r) => r.date >= windowStart && r.date <= windowEnd,
    );
    if (regimesInWindow.length === 0) {
      cursor = addDays(cursor, STEP_DAYS);
      continue;
    }
    const midRegime = regimesInWindow[Math.floor(regimesInWindow.length / 2)];

    // Derive scores from MarketRegime rows in this window
    // breadthScore → avgTrend proxy, vixValue → volatility proxy
    const breadthVals = regimesInWindow.map((r) => r.breadthScore ?? 50);
    const vixVals = regimesInWindow.map((r) => r.vixValue ?? 50);
    const avgBreadth = breadthVals.reduce((a, b) => a + b, 0) / breadthVals.length;
    const avgVix = vixVals.reduce((a, b) => a + b, 0) / vixVals.length;

    // Extract cross-sector correlation from correlationMetrics
    const corrMetrics = midRegime.correlationMetrics as Record<string, unknown> | null;
    const cs = corrMetrics?.crossSector as { avgCorrelation?: number; sectorDispersionIndex?: number } | undefined;
    const crossSectorCorr = cs?.avgCorrelation ?? 0.5;

    // Derive score proxies from regime data
    // breadth → trend proxy, inverse vix → momentum proxy, vix → volatility, dispersion → sentiment
    const dispersion = cs?.sectorDispersionIndex ?? 50;
    const avgTrend = avgBreadth;
    const avgMomentum = Math.max(0, 100 - avgVix);  // inverse volatility = momentum proxy
    const avgVolatility = avgVix;
    const avgSentiment = Math.max(0, 100 - dispersion); // low dispersion = high sentiment

    // Forward returns from benchmark price history
    const basePrice = getPriceNear(windowEnd);
    const fwdReturn5d = basePrice && getPriceNear(fwdEnd5d)
      ? ((getPriceNear(fwdEnd5d)! - basePrice) / basePrice) * 100 : null;
    const fwdReturn20d = basePrice && getPriceNear(fwdEnd20d)
      ? ((getPriceNear(fwdEnd20d)! - basePrice) / basePrice) * 100 : null;
    const fwdReturn60d = basePrice && getPriceNear(fwdEnd60d)
      ? ((getPriceNear(fwdEnd60d)! - basePrice) / basePrice) * 100 : null;

    // Max drawdown over 20d forward window
    let maxDrawdown20d: number | null = null;
    if (basePrice) {
      // Collect prices first (avoid double-calling getPriceNear)
      const fwdPrices: number[] = [basePrice];
      const seenDates = new Set<string>();
      seenDates.add(windowEnd.toISOString().slice(0, 10));
      for (let d = 1; d <= 22; d++) {
        const target = addDays(windowEnd, d);
        const key = target.toISOString().slice(0, 10);
        if (seenDates.has(key)) continue;
        const p = getPriceNear(target);
        if (p !== null && p > 0) { fwdPrices.push(p); seenDates.add(key); }
      }
      // Need at least 5 forward prices for a meaningful drawdown
      if (fwdPrices.length < 5) {
        maxDrawdown20d = null;
      } else {
        let peak = fwdPrices[0];
        let maxDD = 0;
        for (const p of fwdPrices) {
          if (p > peak) peak = p;
          const dd = ((p - peak) / peak) * 100;
          if (dd < maxDD) maxDD = dd;
        }
        maxDrawdown20d = maxDD;
      }
    }

    windows.push({
      windowStart,
      windowEnd,
      regimeState: midRegime.state,
      breadthScore: avgBreadth,
      volatilityLevel: avgVolatility,
      crossSectorCorr,
      avgTrend,
      avgMomentum,
      avgVolatility,
      avgSentiment,
      fwdReturn5d,
      fwdReturn20d,
      fwdReturn60d,
      maxDrawdown20d,
      recoveryDays: null,
      topSectors: [],  // AssetScore history not available; populated on live sync
    });

    cursor = addDays(cursor, STEP_DAYS);
  }

  console.log(`[${region}] Built ${windows.length} windows`);
  return windows;
}

function fingerprintToText(w: WindowData): string {
  return [
    `regime:${w.regimeState}`,
    `breadth:${w.breadthScore.toFixed(1)}`,
    `volatility:${w.volatilityLevel.toFixed(1)}`,
    `crossSectorCorr:${w.crossSectorCorr.toFixed(2)}`,
    `trend:${w.avgTrend.toFixed(1)}`,
    `momentum:${w.avgMomentum.toFixed(1)}`,
    `volScore:${w.avgVolatility.toFixed(1)}`,
    `sentiment:${w.avgSentiment.toFixed(1)}`,
  ].join(" ");
}

async function seed() {
  console.log(`\n=== Historical Analog Seeder ===`);
  console.log(`Region: ${REGION} | Force: ${FORCE}`);

  if (FORCE) {
    const deleted = await prisma.$executeRaw`DELETE FROM "HistoricalAnalog" WHERE region = ${REGION}`;
    console.log(`Deleted ${deleted} existing records for ${REGION}`);
  }

  const existing = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM "HistoricalAnalog" WHERE region = ${REGION}
  `;
  const existingCount = Number(existing[0].cnt);
  if (existingCount > 0 && !FORCE) {
    console.log(`${existingCount} records already exist. Use --force to re-seed.`);
    await prisma.$disconnect();
    return;
  }

  const windows = await buildWindows(REGION);
  if (windows.length === 0) {
    console.log("No windows to seed.");
    await prisma.$disconnect();
    return;
  }

  let inserted = 0;
  const batches: WindowData[][] = [];
  for (let i = 0; i < windows.length; i += BATCH_SIZE) {
    batches.push(windows.slice(i, i + BATCH_SIZE));
  }

  for (const [batchIdx, batch] of batches.entries()) {
    const texts = batch.map(fingerprintToText);
    console.log(`Embedding batch ${batchIdx + 1}/${batches.length} (${batch.length} windows)...`);

    const embeddings = await getEmbeddings(texts);

    for (const [i, w] of batch.entries()) {
      const vectorString = `[${embeddings[i].join(",")}]`;
      const topSectorsJson = JSON.stringify(w.topSectors);

      await prisma.$executeRaw`
        INSERT INTO "HistoricalAnalog" (
          id, "windowStart", "windowEnd", region,
          "regimeState", "breadthScore", "volatilityLevel", "crossSectorCorr",
          "avgTrend", "avgMomentum", "avgVolatility", "avgSentiment",
          "fwdReturn5d", "fwdReturn20d", "fwdReturn60d",
          "maxDrawdown20d", "recoveryDays", "topSectors",
          embedding, "createdAt"
        )
        VALUES (
          gen_random_uuid()::text,
          ${w.windowStart}, ${w.windowEnd}, ${REGION},
          ${w.regimeState}, ${w.breadthScore}, ${w.volatilityLevel}, ${w.crossSectorCorr},
          ${w.avgTrend}, ${w.avgMomentum}, ${w.avgVolatility}, ${w.avgSentiment},
          ${w.fwdReturn5d}, ${w.fwdReturn20d}, ${w.fwdReturn60d},
          ${w.maxDrawdown20d}, ${w.recoveryDays}, ${topSectorsJson}::jsonb,
          ${vectorString}::vector, NOW()
        )
        ON CONFLICT DO NOTHING;
      `;
      inserted++;
    }

    console.log(`  → Batch ${batchIdx + 1} done. Total inserted: ${inserted}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n✓ Seeded ${inserted} historical analog windows for ${REGION}`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
