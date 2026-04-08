import { NextResponse } from "next/server";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { MarketNarrativesService } from "@/lib/services/market-narratives.service";
import { MacroResearchService } from "@/lib/services/macro-research.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "cron-daily-briefing" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/daily-briefing
 * Generates daily AI briefings for US and IN markets (runs once daily).
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "daily-briefing" },
    async () => {
      try {
        const results = await DailyBriefingService.generateBriefings();

        // Warm narratives after briefings complete — fire-and-forget so it
        // doesn't block the response or count against the cron's time budget.
        MarketNarrativesService.warmNarratives().catch((err) =>
          logger.warn({ err: sanitizeError(err) }, "Narrative warm failed (non-blocking)")
        );

        await Promise.all([
          MacroResearchService.refreshDaily("US"),
          MacroResearchService.refreshDaily("IN"),
        ]);

        return NextResponse.json({
          success: true,
          results,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "Daily briefing cron failed");
        return NextResponse.json(
          { success: false, error: "Generation failed" },
          { status: 500 },
        );
      }
    },
  );
}

export async function GET(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "daily-briefing-status" },
    async () => {
      const [us, india] = await Promise.all([
        DailyBriefingService.getBriefingStatus("US"),
        DailyBriefingService.getBriefingStatus("IN"),
      ]);

      return NextResponse.json({
        success: true,
        status: {
          us,
          in: india,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );
}
