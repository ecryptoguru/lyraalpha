import { NextRequest, NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-us-market-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/us-market-sync
 * US market sync for stocks + ETFs + commodities.
 * Excludes all news sync.
 */
export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "us-market-sync" },
    async () => {
      await MarketSyncService.runUsMarketDataSync();

      return NextResponse.json({
        success: true,
        message: "US market data sync completed",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
