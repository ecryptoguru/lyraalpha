import { NextRequest, NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-in-market-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/in-market-sync
 * India market sync for stocks + ETFs + mutual funds.
 */
export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "in-market-sync" },
    async () => {
      await MarketSyncService.runInMarketDataSync();
      return NextResponse.json({
        success: true,
        message: "IN market sync completed",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
