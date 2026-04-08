import { NextResponse } from "next/server";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { MarketNarrativesService } from "@/lib/services/market-narratives.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-in-eod-postprocess" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "in-eod-postprocess" },
    async () => {
      const startMs = Date.now();

      try {
        const briefing = await DailyBriefingService.generateBriefingForRegion("IN");
        const narratives = await MarketNarrativesService.warmNarratives(["IN"]);

        return NextResponse.json({
          success: true,
          region: "IN",
          briefing,
          narratives,
          durationMs: Date.now() - startMs,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "IN EOD post-process failed");
        return NextResponse.json(
          {
            success: false,
            region: "IN",
            error: "IN EOD post-process failed",
            durationMs: Date.now() - startMs,
            timestamp: new Date().toISOString(),
          },
          { status: 500 },
        );
      }
    },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
