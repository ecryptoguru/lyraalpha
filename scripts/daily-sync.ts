#!/usr/bin/env tsx
/**
 * Daily Sync — Complete idempotent sync for all 669 assets.
 *
 * Runs ONCE per day. Each step is idempotent: checks staleness before
 * fetching, never overwrites fresh data. Designed to be called by cron
 * or manually. Replaces master-sync.ts for production use.
 *
 * Pipeline (in order):
 *   Phase 1  — Market prices + history (US stocks/ETFs/commodities via Yahoo)
 *   Phase 2  — Indian stocks + ETFs via NSE India
 *   Phase 3  — Crypto prices + metadata via CoinGecko
 *   Phase 4  — Indian Mutual Funds NAV via MFAPI (MF-only targeted sync)
 *   Phase 5  — Commodity prices via Metals.Dev (Gold/Silver INR/USD)
 *   Phase 6  — Finnhub: news, insider, analyst, financials, ETF data
 *   Phase 7  — Compute analytics (scores, regimes, dynamics) — US
 *   Phase 8  — Compute analytics (scores, regimes, dynamics) — IN
 *   Phase 9  — MF return calculations from NAV history
 *   Phase 10 — Discovery feed computation
 *   Phase 11 — Daily Market Briefing (US + IN)
 *   Phase 12 — Lyra trending questions (once/day window)
 *   Phase 13 — Lyra daily brief (generate-lyra-intel)
 *   Phase 14 — Housekeeping: prune stale intelligence events
 *   Phase 15 — MF holdings via Moneycontrol scraping (monthly, skipped daily)
 *
 * Staleness rules:
 *   - Prices/scores: stale if not updated today (UTC)
 *   - Finnhub news/analyst: stale if > 6h old
 *   - Finnhub financials: stale if > 7 days old
 *   - Finnhub ETF/peers: stale if > 30 days old
 *   - MF holdings (MC): stale if > 28 days old (run monthly via separate cron)
 *   - Lyra questions/brief: stale if > 20h old
 *
 * Usage:
 *   npx tsx scripts/daily-sync.ts                  # full daily sync
 *   npx tsx scripts/daily-sync.ts --region US       # US only
 *   npx tsx scripts/daily-sync.ts --region IN       # IN only
 *   npx tsx scripts/daily-sync.ts --force           # force all steps
 *   npx tsx scripts/daily-sync.ts --skip-lyra       # skip AI content
 *   npx tsx scripts/daily-sync.ts --phase 1,2,6     # specific phases only
 *   npx tsx scripts/daily-sync.ts --dry-run         # log what would run, no writes
 */

import "dotenv/config";
import { MarketSyncService } from "../src/lib/services/market-sync.service";
import { TrendingQuestionService } from "../src/lib/services/trending-question.service";
import { FinnhubSyncService } from "../src/lib/services/finnhub-sync.service";
import { DailyBriefingService } from "../src/lib/services/daily-briefing.service";
import { IntelligenceEventsService } from "../src/lib/services/intelligence-events.service";
import { syncCommodityPrices } from "../src/lib/services/metals-dev.service";
import { Prisma } from "../src/generated/prisma/client";
import { generateLyraIntel } from "./generate-lyra-intel";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/logger/utils";
import { createLogger } from "../src/lib/logger";

const logger = createLogger({ service: "daily-sync" });

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function nextPositional(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

const regionArg = args.find(a => a.startsWith("--region="))?.split("=")[1]?.toUpperCase()
  ?? nextPositional("--region")?.toUpperCase();
const forceArg = args.includes("--force");
const skipLyra = args.includes("--skip-lyra");
const dryRun = args.includes("--dry-run");
const phaseArg = args.find(a => a.startsWith("--phase="))?.split("=")[1]
  ?? nextPositional("--phase");
const enabledPhases = phaseArg
  ? new Set(phaseArg.split(",").map(p => parseInt(p.trim())))
  : null; // null = all phases

function shouldRun(phase: number): boolean {
  return enabledPhases === null || enabledPhases.has(phase);
}

// ─── Staleness Helpers ───────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

// ─── Phase Runner ────────────────────────────────────────────────────────────

interface PhaseResult {
  phase: number;
  name: string;
  skipped: boolean;
  duration: number;
  error?: string;
}

async function runPhase(
  phase: number,
  name: string,
  fn: () => Promise<void>,
): Promise<PhaseResult> {
  if (!shouldRun(phase)) {
    logger.info({ phase, name }, `⏭️  Phase ${phase} skipped (not in --phase list)`);
    return { phase, name, skipped: true, duration: 0 };
  }

  logger.info({ phase, name }, `▶️  Phase ${phase}: ${name}`);
  const start = Date.now();

  if (dryRun) {
    logger.info({ phase }, "🔍 DRY RUN — skipping execution");
    return { phase, name, skipped: true, duration: 0 };
  }

  try {
    await fn();
    const duration = Date.now() - start;
    logger.info({ phase, name, duration: `${(duration / 1000).toFixed(1)}s` }, `✅ Phase ${phase} complete`);
    return { phase, name, skipped: false, duration };
  } catch (err) {
    const duration = Date.now() - start;
    const error = sanitizeError(err);
    logger.error({ phase, name, err: error }, `❌ Phase ${phase} failed — continuing`);
    return { phase, name, skipped: false, duration, error: String(error) };
  }
}

// ─── Staleness Checks ────────────────────────────────────────────────────────

async function needsPriceSync(region: string): Promise<boolean> {
  if (forceArg) return true;
  const today = todayUTC();
  const [freshCount, totalCount] = await Promise.all([
    prisma.asset.count({ where: { region, lastPriceUpdate: { gte: new Date(today) } } }),
    prisma.asset.count({ where: { region } }),
  ]);
  const staleCount = totalCount - freshCount;
  logger.info({ region, fresh: freshCount, stale: staleCount, total: totalCount }, "Price staleness check");
  return staleCount > 0;
}

async function needsScoreCompute(region: string): Promise<boolean> {
  if (forceArg) return true;
  const today = todayUTC();
  const freshScores = await prisma.assetScore.count({
    where: { date: { gte: new Date(today) } },
  });
  // Expect ~6 score types × assets in region
  const assetCount = await prisma.asset.count({ where: { region } });
  const expectedMin = assetCount * 4; // at least 4 score types
  return freshScores < expectedMin;
}

async function needsLyraRefresh(): Promise<boolean> {
  if (forceArg) return true;
  const recent = await prisma.trendingQuestion.findFirst({
    where: { isActive: true, updatedAt: { gte: hoursAgo(20) } },
  });
  return !recent;
}

async function needsMFReturns(): Promise<boolean> {
  if (forceArg) return true;
  // Check if any MF has null fundPerformanceHistory
  const missing = await prisma.asset.count({
    where: {
      type: "MUTUAL_FUND",
      fundPerformanceHistory: { equals: Prisma.JsonNull },
    },
  });
  return missing > 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const globalStart = Date.now();

  logger.info({
    region: regionArg ?? "ALL",
    force: forceArg,
    skipLyra,
    dryRun,
    phases: phaseArg ?? "ALL",
  }, "🌅 Daily Sync starting");

  const results: PhaseResult[] = [];

  // ── Phase 1: US Market Data (Yahoo Finance) ──────────────────────────────
  if (!regionArg || regionArg === "US") {
    results.push(await runPhase(1, "US Market Data (Yahoo Finance)", async () => {
      const stale = await needsPriceSync("US");
      if (!stale) {
        logger.info("US prices are fresh today — skipping harvest");
        return;
      }
      await MarketSyncService.harvestUniverse(forceArg, undefined, "US", {
        excludeCrypto: true,
        skipLegacyNews: true,
      });
    }));
  }

  // ── Phase 2: Indian Stocks + ETFs (NSE India) ────────────────────────────
  if (!regionArg || regionArg === "IN") {
    results.push(await runPhase(2, "Indian Stocks + ETFs (NSE India)", async () => {
      const stale = await needsPriceSync("IN");
      if (!stale) {
        logger.info("IN prices are fresh today — skipping harvest");
        return;
      }
      await MarketSyncService.harvestUniverse(forceArg, undefined, "IN", {
        excludeCrypto: true,
        skipLegacyNews: true,
      });
      // Also run NSE direct quote refresh for better accuracy
      await MarketSyncService.harvestIndianStocks();
    }));
  }

  // ── Phase 3: Crypto prices (CoinGecko) + Crypto news (CryptoPanic/Finnhub) ─
  if (!regionArg || regionArg === "US") {
    results.push(await runPhase(3, "Crypto Market Data + News (CoinGecko + CryptoPanic)", async () => {
      if (!forceArg) {
        const freshCrypto = await prisma.asset.count({
          where: {
            type: "CRYPTO",
            lastPriceUpdate: { gte: hoursAgo(6) },
          },
        });
        const totalCrypto = await prisma.asset.count({ where: { type: "CRYPTO" } });
        if (freshCrypto >= totalCrypto * 0.9) {
          logger.info({ fresh: freshCrypto, total: totalCrypto }, "Crypto prices fresh — skipping");
          return;
        }
      }
      // Market data (prices, history)
      await MarketSyncService.runCryptoMarketSync();
      // Crypto news via CryptoPanic + Finnhub (separate from syncAll)
      await FinnhubSyncService.syncCryptoOnly();
    }));
  }

  // ── Phase 4: Indian Mutual Funds NAV (MFAPI — MF-only targeted sync) ──────
  if (!regionArg || regionArg === "IN") {
    results.push(await runPhase(4, "Indian Mutual Funds NAV (MFAPI)", async () => {
      if (!forceArg) {
        const [freshMFs, totalMFs] = await Promise.all([
          prisma.asset.count({ where: { type: "MUTUAL_FUND", lastPriceUpdate: { gte: new Date(todayUTC()) } } }),
          prisma.asset.count({ where: { type: "MUTUAL_FUND" } }),
        ]);
        if (freshMFs >= totalMFs * 0.9) {
          logger.info({ fresh: freshMFs, total: totalMFs }, "MF NAVs fresh today — skipping");
          return;
        }
      }
      // MF-targeted sync — if Phase 2 ran, MFs are already fresh and the staleness gate
      // above will have short-circuited. This phase only executes when MFs are still stale
      // (e.g. IN stocks sync failed in Phase 2 but MF NAVs still need updating).
      await MarketSyncService.harvestUniverse(forceArg, undefined, "IN", {
        excludeCrypto: true,
        skipLegacyNews: true,
        skipIndianMutualFunds: false,
      });
    }));
  }

  // ── Phase 5: Commodity Prices (Metals.Dev — INR prices for Gold/Silver) ───
  // Runs regardless of region — enriches GC=F and SI=F with LBMA/MCX/IBJA prices
  results.push(await runPhase(5, "Commodity Prices (Metals.Dev)", async () => {
    const result = await syncCommodityPrices();
    if (!result.success) logger.warn("Metals.Dev sync returned no data — API may be down");
    else logger.info({ updated: result.updated }, "Commodity prices updated");
  }));

  // ── Phase 6: Finnhub Intelligence (US news, insider, analyst, financials) ─
  if (!regionArg || regionArg === "US") {
    results.push(await runPhase(6, "Finnhub Intelligence Sync (US news + insider + analyst + financials)", async () => {
      // syncAll covers: US news, Indian RSS news, market news, earnings calendar,
      // insider transactions, analyst recommendations, basic financials, ETF data, peer data
      await FinnhubSyncService.syncAll(forceArg);
    }));
  }

  // ── Phase 7: Analytics Computation (scores, regimes, dynamics) ─────────
  if (!regionArg || regionArg === "US") {
    results.push(await runPhase(7, "US Analytics Computation", async () => {
      const stale = await needsScoreCompute("US");
      if (!stale) {
        logger.info("US scores are fresh today — skipping compute");
        return;
      }
      await MarketSyncService.computeFullAnalytics(forceArg, "US");
    }));
  }

  if (!regionArg || regionArg === "IN") {
    results.push(await runPhase(8, "IN Analytics Computation", async () => {
      const stale = await needsScoreCompute("IN");
      if (!stale) {
        logger.info("IN scores are fresh today — skipping compute");
        return;
      }
      await MarketSyncService.computeFullAnalytics(forceArg, "IN");
    }));
  }

  // ── Phase 9: MF Return Calculations ─────────────────────────────────────
  if (!regionArg || regionArg === "IN") {
    results.push(await runPhase(9, "Mutual Fund Return Calculations", async () => {
      const needed = await needsMFReturns();
      if (!needed && !forceArg) {
        logger.info("MF returns already computed — skipping");
        return;
      }
      // Run MF return computation via child process to avoid module caching issues.
      // Use spawn (async) instead of execSync to avoid blocking the event loop.
      const { spawn } = await import("child_process");
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "npx",
          ["tsx", "scripts/enrich-mutual-funds.ts"],
          { stdio: "inherit", cwd: process.cwd() },
        );
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`enrich-mutual-funds.ts exited with code ${code}`));
        });
        child.on("error", reject);
      });
    }));
  }

  // ── Phase 10: Discovery Feed ─────────────────────────────────────────────
  results.push(await runPhase(10, "Discovery Feed Computation", async () => {
    if (!forceArg) {
      const recentFeed = await prisma.discoveryFeedItem.count({
        where: { computedAt: { gte: hoursAgo(20) } },
      });
      if (recentFeed > 50) {
        logger.info({ recentFeed }, "Discovery feed is fresh — skipping");
        return;
      }
    }
    const { computeDiscoveryFeed } = await import("../src/lib/services/discovery-intelligence.service");
    const result = await computeDiscoveryFeed();
    logger.info({ surfaced: result.surfaced, total: result.total }, "Discovery feed computed");
  }));

  // ── Phase 11: Daily Market Briefing (US + IN) ───────────────────────────
  if (!skipLyra) {
    results.push(await runPhase(11, "Daily Market Briefing (US + IN)", async () => {
      if (!forceArg) {
        // Only skip when the real cached briefing exists in Upstash.
        // Live fallback briefings are useful for UI resilience but should not block
        // the scheduled cache generation job.
        const [usStatus, inStatus] = await Promise.all([
          DailyBriefingService.getBriefingStatus("US"),
          DailyBriefingService.getBriefingStatus("IN"),
        ]);
        if (usStatus.cacheAvailable && inStatus.cacheAvailable) {
          logger.info("Daily briefings are fresh — skipping");
          return;
        }
      }
      await DailyBriefingService.generateBriefings();
    }));
  }

  // ── Phase 12: Lyra AI Content (questions + daily brief) ──────────────────
  if (!skipLyra) {
    results.push(await runPhase(12, "Lyra Trending Questions", async () => {
      const needed = await needsLyraRefresh();
      if (!needed) {
        logger.info("Lyra questions are fresh — skipping");
        return;
      }
      await TrendingQuestionService.refreshTrendingQuestions();
    }));

    results.push(await runPhase(13, "Lyra Daily Brief (generate-lyra-intel)", async () => {
      if (!forceArg) {
        const { getCache } = await import("../src/lib/redis");
        const cached = await getCache("lyra:daily-briefing:US");
        if (cached) {
          logger.info("Lyra daily brief is fresh — skipping");
          return;
        }
      }
      await generateLyraIntel();
    }));
  }

  // ── Phase 14: Housekeeping — prune stale intelligence events ────────────
  results.push(await runPhase(14, "Prune stale intelligence events", async () => {
    await IntelligenceEventsService.pruneStaleData();
  }));

  // ── Phase 15: MF Holdings via Moneycontrol (monthly — skipped in daily) ──
  // This is intentionally NOT run in daily sync.
  // Run separately: npx tsx scripts/sync-mf-holdings.ts
  // Or via cron: /api/cron/mf-holdings-sync (1st of each month)
  logger.info("⏭️  Phase 15: MF Holdings (Moneycontrol) — runs monthly via separate cron");

  // ─── Summary ──────────────────────────────────────────────────────────────

  const totalDuration = ((Date.now() - globalStart) / 1000).toFixed(1);
  const failed = results.filter(r => r.error);
  const completed = results.filter(r => !r.skipped && !r.error);
  const skipped = results.filter(r => r.skipped);

  // Final consistency check
  const [assetCount, freshScores, freshPrices] = await Promise.all([
    prisma.asset.count(),
    prisma.assetScore.count({ where: { date: { gte: new Date(todayUTC()) } } }),
    prisma.asset.count({ where: { lastPriceUpdate: { gte: new Date(todayUTC()) } } }),
  ]);

  logger.info({
    totalDuration: `${totalDuration}s`,
    phases: { completed: completed.length, skipped: skipped.length, failed: failed.length },
    db: { assets: assetCount, freshPrices, freshScores },
    failures: failed.map(r => ({ phase: r.phase, name: r.name, error: r.error })),
  }, failed.length > 0 ? "⚠️  Daily Sync complete with errors" : "✅ Daily Sync complete");

  if (failed.length > 0) {
    console.error("\n❌ Failed phases:");
    for (const f of failed) {
      console.error(`   Phase ${f.phase} (${f.name}): ${f.error}`);
    }
  }

  console.log(`
┌─────────────────────────────────────────────┐
│              DAILY SYNC COMPLETE            │
├─────────────────────────────────────────────┤
│  Total Assets:      ${String(assetCount).padStart(6)}                │
│  Fresh Prices:      ${String(freshPrices).padStart(6)}                │
│  Fresh Scores:      ${String(freshScores).padStart(6)}                │
│  Phases Done:       ${String(completed.length).padStart(6)}                │
│  Phases Skipped:    ${String(skipped.length).padStart(6)}                │
│  Phases Failed:     ${String(failed.length).padStart(6)}                │
│  Duration:          ${String(totalDuration + "s").padStart(6)}                │
└─────────────────────────────────────────────┘`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  logger.error({ err: sanitizeError(err) }, "❌ Daily Sync fatal error");
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
