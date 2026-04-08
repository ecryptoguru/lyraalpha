import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { MarketNarrativesService } from "@/lib/services/market-narratives.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-in-eod-pipeline" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/in-eod-pipeline
 *
 * India EOD pipeline — runs 30 min after NSE/BSE close (10:00 UTC → fires at 10:30 UTC, Mon–Fri).
 * Sequential steps so each stage reads freshly-synced data:
 *   1. Sync IN market data (stocks + ETFs + mutual funds)
 *   2. Generate IN daily briefing (AI synthesis over fresh EOD data)
 *   3. Warm IN market narratives (fire-and-forget — does not block response)
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "in-eod-pipeline" },
    async () => {
      const startMs = Date.now();

      // ── Step 1: Sync IN market data ──────────────────────────────────────
      try {
        await MarketSyncService.runInMarketDataSync();
        logger.info({ durationMs: Date.now() - startMs }, "IN market data sync complete");
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "IN market data sync failed — continuing to briefing");
      }

      // ── Step 2: Generate IN daily briefing ───────────────────────────────
      const briefingResult = await DailyBriefingService.generateBriefingForRegion("IN");
      logger.info({ briefingResult }, "IN daily briefing generated");

      // ── Step 3: Warm IN narratives (non-blocking) ─────────────────────────
      MarketNarrativesService.warmNarratives(["IN"]).catch((err) =>
        logger.warn({ err: sanitizeError(err) }, "IN narrative warm failed (non-blocking)")
      );

      return NextResponse.json({
        success: true,
        region: "IN",
        briefing: briefingResult,
        durationMs: Date.now() - startMs,
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
