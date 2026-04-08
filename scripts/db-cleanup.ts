#!/usr/bin/env tsx
/**
 * Database Cleanup & Optimization
 * ================================
 * Prunes stale data to keep the DB lean and fast.
 * 
 * What it cleans:
 *   1. AssetScore: Keep only last 30 days (scores accumulate 6 per asset per sync)
 *   2. InstitutionalEvent: Keep only last 90 days
 *   3. PriceHistory: Keep only last 365 days
 *   4. LyraAnalysis: Keep only last 30 daily briefs
 *   5. MarketRegime: Keep only last 90 days
 *   6. SectorRegime: Keep only last 90 days
 *   7. MultiHorizonRegime: Keep only last 90 days
 *   8. Evidence: Keep only last 90 days
 *   9. Orphaned records: ChatSource/QuestionSource with no references
 * 
 * Usage:
 *   npx tsx scripts/db-cleanup.ts           # Dry run (shows what would be deleted)
 *   npx tsx scripts/db-cleanup.ts --execute  # Actually delete
 */

import { directPrisma as prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const execute = args.includes("--execute");

const DAYS_30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const DAYS_90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const DAYS_365 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

interface CleanupResult {
  table: string;
  count: number;
}

async function main() {
  console.log(`\n🧹 Database Cleanup ${execute ? "(EXECUTING)" : "(DRY RUN)"}\n`);

  const results: CleanupResult[] = [];

  // 1. AssetScore — keep last 30 days
  const oldScores = await prisma.assetScore.count({ where: { date: { lt: DAYS_30 } } });
  results.push({ table: "AssetScore (>30d)", count: oldScores });
  if (execute && oldScores > 0) {
    await prisma.assetScore.deleteMany({ where: { date: { lt: DAYS_30 } } });
  }

  // 2. InstitutionalEvent — keep last 90 days
  const oldEvents = await prisma.institutionalEvent.count({ where: { date: { lt: DAYS_90 } } });
  results.push({ table: "InstitutionalEvent (>90d)", count: oldEvents });
  if (execute && oldEvents > 0) {
    await prisma.institutionalEvent.deleteMany({ where: { date: { lt: DAYS_90 } } });
  }

  // 3. PriceHistory — keep last 365 days
  const oldHistory = await prisma.priceHistory.count({ where: { date: { lt: DAYS_365 } } });
  results.push({ table: "PriceHistory (>365d)", count: oldHistory });
  if (execute && oldHistory > 0) {
    await prisma.priceHistory.deleteMany({ where: { date: { lt: DAYS_365 } } });
  }

  // 4. MarketRegime — keep last 90 days
  const oldRegimes = await prisma.marketRegime.count({ where: { date: { lt: DAYS_90 } } });
  results.push({ table: "MarketRegime (>90d)", count: oldRegimes });
  if (execute && oldRegimes > 0) {
    await prisma.marketRegime.deleteMany({ where: { date: { lt: DAYS_90 } } });
  }

  // 5. SectorRegime — keep last 90 days
  const oldSectorRegimes = await prisma.sectorRegime.count({ where: { date: { lt: DAYS_90 } } });
  results.push({ table: "SectorRegime (>90d)", count: oldSectorRegimes });
  if (execute && oldSectorRegimes > 0) {
    await prisma.sectorRegime.deleteMany({ where: { date: { lt: DAYS_90 } } });
  }

  // 7. MultiHorizonRegime — keep last 90 days
  const oldMHR = await prisma.multiHorizonRegime.count({ where: { date: { lt: DAYS_90 } } });
  results.push({ table: "MultiHorizonRegime (>90d)", count: oldMHR });
  if (execute && oldMHR > 0) {
    await prisma.multiHorizonRegime.deleteMany({ where: { date: { lt: DAYS_90 } } });
  }

  // 8. Evidence — keep last 90 days
  const oldEvidence = await prisma.evidence.count({ where: { createdAt: { lt: DAYS_90 } } });
  results.push({ table: "Evidence (>90d)", count: oldEvidence });
  if (execute && oldEvidence > 0) {
    await prisma.evidence.deleteMany({ where: { createdAt: { lt: DAYS_90 } } });
  }

  // 9. AIRequestLog — keep last 30 days
  const oldLogs = await prisma.aIRequestLog.count({ where: { createdAt: { lt: DAYS_30 } } });
  results.push({ table: "AIRequestLog (>30d)", count: oldLogs });
  if (execute && oldLogs > 0) {
    await prisma.aIRequestLog.deleteMany({ where: { createdAt: { lt: DAYS_30 } } });
  }

  // Print results
  const totalDeletable = results.reduce((sum, r) => sum + r.count, 0);
  console.log("┌──────────────────────────────────┬──────────┐");
  console.log("│ Table                            │   Rows   │");
  console.log("├──────────────────────────────────┼──────────┤");
  for (const r of results) {
    console.log(`│ ${r.table.padEnd(32)} │ ${String(r.count).padStart(8)} │`);
  }
  console.log("├──────────────────────────────────┼──────────┤");
  console.log(`│ TOTAL                            │ ${String(totalDeletable).padStart(8)} │`);
  console.log("└──────────────────────────────────┴──────────┘");

  if (!execute && totalDeletable > 0) {
    console.log("\n⚠️  Run with --execute to actually delete these rows.");
  } else if (execute) {
    console.log("\n✅ Cleanup complete.");
  } else {
    console.log("\n✅ Database is clean — nothing to prune.");
  }

  // Table sizes summary
  console.log("\n📊 Current table sizes:");
  const [assets, scores, events, history, regimes] = await Promise.all([
    prisma.asset.count(),
    prisma.assetScore.count(),
    prisma.institutionalEvent.count(),
    prisma.priceHistory.count(),
    prisma.marketRegime.count(),
  ]);
  console.log(`   Assets: ${assets} | Scores: ${scores} | Events: ${events} | History: ${history} | Regimes: ${regimes}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Cleanup failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
