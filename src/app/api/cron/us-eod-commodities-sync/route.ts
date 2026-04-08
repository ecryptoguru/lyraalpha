import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-us-eod-commodities-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "us-eod-commodities-sync" },
    async () => {
      const startMs = Date.now();

      try {
        await MarketSyncService.runUsCommoditySync();
        return NextResponse.json({
          success: true,
          assetType: "commodities",
          region: "US",
          durationMs: Date.now() - startMs,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "US EOD commodity sync failed");
        return NextResponse.json(
          {
            success: false,
            assetType: "commodities",
            region: "US",
            error: "US EOD commodity sync failed",
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
