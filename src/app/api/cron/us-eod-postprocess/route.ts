import { NextResponse } from "next/server";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { MarketNarrativesService } from "@/lib/services/market-narratives.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-us-eod-postprocess" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "us-eod-postprocess" },
    async () => {
      const startMs = Date.now();

      try {
        const briefing = await DailyBriefingService.generateBriefingForRegion("US");
        const narratives = await MarketNarrativesService.warmNarratives(["US"]);

        return NextResponse.json({
          success: true,
          region: "US",
          briefing,
          narratives,
          durationMs: Date.now() - startMs,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "US EOD post-process failed");
        return NextResponse.json(
          {
            success: false,
            region: "US",
            error: "US EOD post-process failed",
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
