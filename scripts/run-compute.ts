#!/usr/bin/env tsx
/**
 * Run Phase 2 (Compute Full Analytics) for all assets.
 * This pre-computes: performance, correlationRegime, factorAlignment, eventAdjustedScores
 * and stores them in the Asset record so the analytics API reads from DB instead of computing live.
 * 
 * Usage: npx tsx scripts/run-compute.ts [--region US|IN] [--force]
 */

import { MarketSyncService } from "../src/lib/services/market-sync.service";

const args = process.argv.slice(2);
const force = args.includes("--force");
const regionIdx = args.indexOf("--region");
const region = regionIdx !== -1 ? args[regionIdx + 1] : undefined;

async function main() {
  console.log(`\n⚙️  Running Phase 2: Compute Full Analytics`);
  console.log(`   Force: ${force}`);
  console.log(`   Region: ${region || "ALL"}\n`);

  const start = Date.now();

  if (region) {
    await MarketSyncService.computeFullAnalytics(force, region);
  } else {
    // Run for both regions
    console.log("Computing US analytics...");
    await MarketSyncService.computeFullAnalytics(force, "US");
    console.log("\nComputing IN analytics...");
    await MarketSyncService.computeFullAnalytics(force, "IN");
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Compute complete in ${elapsed}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Compute failed:", err);
  process.exit(1);
});
