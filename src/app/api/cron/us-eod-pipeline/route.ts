import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { MarketNarrativesService } from "@/lib/services/market-narratives.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-us-eod-pipeline" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/us-eod-pipeline
 *
 * US EOD pipeline — runs 30 min after NYSE/NASDAQ close (21:00 UTC → fires at 21:30 UTC, Mon–Fri).
 * Sequential steps so each stage reads freshly-synced data:
 *   1. Sync US market data (stocks + ETFs + commodities)
 *   2. Generate US daily briefing (AI synthesis over fresh EOD data)
 *   3. Warm US market narratives (fire-and-forget — does not block response)
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "us-eod-pipeline" },
    async () => {
      const startMs = Date.now();

      // ── Step 1: Sync US market data ──────────────────────────────────────
      try {
        await MarketSyncService.runUsMarketDataSync();
        logger.info({ durationMs: Date.now() - startMs }, "US market data sync complete");
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "US market data sync failed — continuing to briefing");
      }

      // ── Step 2: Generate US daily briefing ───────────────────────────────
      const briefingResult = await DailyBriefingService.generateBriefingForRegion("US");
      logger.info({ briefingResult }, "US daily briefing generated");

      // ── Step 3: Warm US narratives (non-blocking) ─────────────────────────
      MarketNarrativesService.warmNarratives(["US"]).catch((err) =>
        logger.warn({ err: sanitizeError(err) }, "US narrative warm failed (non-blocking)")
      );

      return NextResponse.json({
        success: true,
        region: "US",
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
