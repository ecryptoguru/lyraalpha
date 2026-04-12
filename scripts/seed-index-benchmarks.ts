/**
 * Seed Indian Index Benchmarks (Nifty 50 & Sensex) into the DB.
 * These are used as correlation benchmarks for Indian assets (IN stocks + MFs).
 * 
 * Usage: npx tsx scripts/seed-index-benchmarks.ts
 */

import YahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/prisma";
import { AssetType } from "../src/generated/prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf: any = typeof YahooFinance === 'function' ? new (YahooFinance as any)() : YahooFinance;

const INDICES = [
  {
    symbol: "^NSEI",
    name: "Nifty 50",
    type: AssetType.CRYPTO,
    region: "IN",
    currency: "INR",
  },
  {
    symbol: "^BSESN",
    name: "BSE Sensex",
    type: AssetType.CRYPTO,
    region: "IN",
    currency: "INR",
  },
];

async function seedIndex(config: (typeof INDICES)[0]) {
  console.log(`\n📊 Seeding ${config.name} (${config.symbol})...`);

  // 1. Upsert asset record
  const asset = await prisma.asset.upsert({
    where: { symbol: config.symbol },
    create: {
      symbol: config.symbol,
      name: config.name,
      type: config.type,
      region: config.region,
      currency: config.currency,
      metadata: { isIndex: true, yahooSymbol: config.symbol },
    },
    update: {
      name: config.name,
      metadata: { isIndex: true, yahooSymbol: config.symbol },
    },
  });
  console.log(`  ✅ Asset record: ${asset.id}`);

  // 2. Fetch 1 year of daily history from Yahoo Finance
  const now = Math.floor(Date.now() / 1000);
  const yearAgo = now - 365 * 24 * 60 * 60;

  console.log(`  📡 Fetching history from Yahoo Finance...`);
  const result = await yf.chart(config.symbol, {
    period1: yearAgo,
    period2: now,
    interval: "1d",
  });

   
  const quotes = (result.quotes || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => q.close && q.close > 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any) => {
      const d = new Date(q.date);
      d.setUTCHours(0, 0, 0, 0);
      return {
        assetId: asset.id,
        date: d,
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        close: q.close || 0,
        volume: q.volume || 0,
      };
    });

  console.log(`  📈 Got ${quotes.length} data points`);

  if (quotes.length === 0) {
    console.log(`  ⚠️ No data — skipping`);
    return;
  }

  // 3. Persist history (skip duplicates)
  const inserted = await prisma.priceHistory.createMany({
    data: quotes,
    skipDuplicates: true,
  });
  console.log(`  💾 Inserted ${inserted.count} new price records`);

  // 4. Update asset price + lastPriceUpdate
  const latest = quotes[quotes.length - 1];
  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      price: latest.close,
      lastPriceUpdate: latest.date,
      updatedAt: new Date(),
    },
  });
  console.log(`  💰 Latest price: ${latest.close} (${latest.date.toISOString().split("T")[0]})`);
}

async function main() {
  console.log("🚀 Seeding Indian Index Benchmarks...\n");

  for (const idx of INDICES) {
    try {
      await seedIndex(idx);
    } catch (err) {
      console.error(`  ❌ Failed to seed ${idx.symbol}:`, err);
    }
  }

  console.log("\n✅ Done!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
