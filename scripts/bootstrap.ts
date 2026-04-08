#!/usr/bin/env tsx
/**
 * SCRIPT 1: Full Bootstrap
 * ========================
 * Run this ONCE when initializing a new environment or after a DB reset.
 * 
 * Steps:
 *   1. Seed DB (sectors, themes, asset definitions, trending questions)
 *   2. Full crypto data harvest from CoinGecko with force=true
 *   3. Full crypto engine computation with force=true
 * 
 * Usage:
 *   npx tsx scripts/bootstrap.ts
 *   npx tsx scripts/bootstrap.ts --skip-seed    # Skip seeding (assets already exist)
 *   npx tsx scripts/bootstrap.ts --region US    # Bootstrap only US assets
 *   npx tsx scripts/bootstrap.ts --region IN    # Bootstrap only IN assets
 * 
 * Duration: ~10-15 minutes for 669 assets
 * 
 * For incremental updates (scheduler), use the crypto cron endpoints instead.
 */

import { execSync } from "child_process";
import { MarketSyncService } from "../src/lib/services/market-sync.service";
import { directPrisma as prisma } from "../src/lib/prisma";
import { createLogger } from "../src/lib/logger";
import { sanitizeError } from "../src/lib/logger/utils";

const logger = createLogger({ service: "bootstrap" });

const args = process.argv.slice(2);
const skipSeed = args.includes("--skip-seed");
const regionIdx = args.indexOf("--region");
const region = regionIdx !== -1 ? args[regionIdx + 1]?.toUpperCase() : undefined;

async function main() {
  const startTime = Date.now();
  logger.info({ skipSeed, region: region || "ALL" }, "🚀 Starting Full Bootstrap");

  // ─── Phase 1: Seed Database ───
  if (!skipSeed) {
    logger.info("📦 Phase 1: Seeding database (sectors, themes, assets)...");
    try {
      execSync("npm run db:seed", {
        cwd: process.cwd(),
        stdio: "inherit",
        env: { ...process.env },
      });
      logger.info("✅ Phase 1: Database seeded.");
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "❌ Seed failed — continuing with existing data");
    }
  } else {
    logger.info("⏭️  Phase 1: Skipping seed (--skip-seed)");
  }

  // Verify assets exist
  const assetCount = await prisma.asset.count();
  if (assetCount === 0) {
    logger.error("No assets in database. Seed must run first. Aborting.");
    process.exit(1);
  }
  logger.info({ assetCount }, "Asset universe verified");

  // ─── Phase 2: Full Crypto Harvest ───
  logger.info("📡 Phase 2: Full crypto data harvest (force=true)...");
  await MarketSyncService.runCryptoMarketSync();
  logger.info("✅ Phase 2: Crypto harvest complete.");

  // ─── Phase 3: Full Crypto Engine Computation ───
  logger.info("⚙️  Phase 3: Running crypto engine computation (force=true)...");
  await MarketSyncService.computeFullAnalytics(true, undefined);
  logger.info("✅ Phase 3: Crypto computation complete.");

  // ─── Phase 4: Verification ───
  logger.info("🔍 Phase 4: Verification...");
  const [totalAssets, withScores, withPerformance, withDynamics] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.count({ where: { avgTrendScore: { not: null } } }),
    prisma.asset.count({ where: { performanceData: { not: { equals: null } } } }),
    prisma.asset.count({ where: { scoreDynamics: { not: { equals: null } } } }),
  ]);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info({
    totalAssets,
    withScores,
    withPerformance,
    withDynamics,
    duration: `${duration}s`,
  }, "✅ Bootstrap Complete");

  console.log(`
┌─────────────────────────────────────────┐
│          BOOTSTRAP COMPLETE             │
├─────────────────────────────────────────┤
│  Total Assets:      ${String(totalAssets).padStart(6)}              │
│  With Scores:       ${String(withScores).padStart(6)}              │
│  With Performance:  ${String(withPerformance).padStart(6)}              │
│  With Dynamics:     ${String(withDynamics).padStart(6)}              │
│  Duration:          ${String(duration + "s").padStart(6)}              │
├─────────────────────────────────────────┤
│  Scheduler will handle incremental      │
│  updates via cron endpoints.            │
└─────────────────────────────────────────┘
`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error({ err: sanitizeError(err) }, "❌ Bootstrap failed");
  await prisma.$disconnect();
  process.exit(1);
});
