#!/usr/bin/env tsx
/**
 * Daily Sync — crypto-only scheduled sync.
 *
 * This script keeps the existing entrypoint but limits work to the crypto
 * universe and Lyra's crypto-oriented daily products.
 */

import "dotenv/config";
import { MarketSyncService } from "../src/lib/services/market-sync.service";
import { TrendingQuestionService } from "../src/lib/services/trending-question.service";
import { DailyBriefingService } from "../src/lib/services/daily-briefing.service";
import { IntelligenceEventsService } from "../src/lib/services/intelligence-events.service";
import { generateLyraIntel } from "./generate-lyra-intel";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/logger/utils";
import { createLogger } from "../src/lib/logger";

const logger = createLogger({ service: "daily-sync" });

const args = process.argv.slice(2);
const forceArg = args.includes("--force");
const skipLyra = args.includes("--skip-lyra");
const dryRun = args.includes("--dry-run");

interface PhaseResult {
  name: string;
  skipped: boolean;
  error?: string;
}

async function runPhase(name: string, fn: () => Promise<void>): Promise<PhaseResult> {
  logger.info({ name }, `▶️ ${name}`);
  if (dryRun) {
    logger.info({ name }, "🔍 DRY RUN — skipping execution");
    return { name, skipped: true };
  }

  try {
    await fn();
    logger.info({ name }, `✅ ${name} complete`);
    return { name, skipped: false };
  } catch (err) {
    const error = sanitizeError(err);
    logger.error({ name, err: error }, `❌ ${name} failed`);
    return { name, skipped: false, error: String(error) };
  }
}

async function needsCryptoRefresh(): Promise<boolean> {
  if (forceArg) return true;
  const fresh = await prisma.asset.count({
    where: { type: "CRYPTO", lastPriceUpdate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const total = await prisma.asset.count({ where: { type: "CRYPTO" } });
  return fresh < total * 0.9;
}

async function needsLyraRefresh(): Promise<boolean> {
  if (forceArg) return true;
  const recent = await prisma.trendingQuestion.findFirst({
    where: { isActive: true, updatedAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) } },
  });
  return !recent;
}

async function main() {
  const results: PhaseResult[] = [];

  logger.info({ force: forceArg, dryRun, skipLyra }, "🌅 Daily crypto sync starting");

  results.push(await runPhase("Crypto market data", async () => {
    if (!(await needsCryptoRefresh())) {
      logger.info("Crypto universe is fresh — skipping harvest");
      return;
    }
    await MarketSyncService.runCryptoMarketSync();
    await MarketSyncService.computeFullAnalytics(forceArg, undefined);
  }));

  results.push(await runPhase("Daily market briefing", async () => {
    await DailyBriefingService.generateBriefingForRegion("US");
  }));

  if (!skipLyra) {
    results.push(await runPhase("Lyra trending questions", async () => {
      if (!(await needsLyraRefresh())) {
        logger.info("Lyra questions are fresh — skipping");
        return;
      }
      await TrendingQuestionService.refreshTrendingQuestions();
    }));

    results.push(await runPhase("Lyra daily brief", async () => {
      await generateLyraIntel();
    }));
  }

  results.push(await runPhase("Housekeeping", async () => {
    await IntelligenceEventsService.pruneStaleData();
  }));

  const failed = results.filter((r) => r.error);
  logger.info(
    {
      phases: results.length,
      failed: failed.length,
      skipped: results.filter((r) => r.skipped).length,
    },
    failed.length > 0 ? "⚠️ Daily crypto sync complete with errors" : "✅ Daily crypto sync complete",
  );

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  logger.error({ err: sanitizeError(err) }, "❌ Daily sync fatal error");
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
