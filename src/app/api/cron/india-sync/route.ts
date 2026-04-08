import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-india-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/india-sync
 * Dedicated sync for Indian market assets (stocks + ETFs + mutual funds).
 * Runs during Indian market hours (9:15 AM - 4:00 PM IST).
 * Schedule: Every hour during market hours.
 * 
 * Pipeline: Harvest (IN MF + NSE equities) → Compute (IN analytics)
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "india-sync" },
    async () => {
      // Determine sync type based on IST hour (uses Intl to avoid server timezone dependency)
      const now = new Date();
      const istHour = Number(
        new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now),
      );
      const syncType = istHour >= 15 ? "EOD" : istHour >= 12 ? "MIDDAY" : "MORNING";

      logger.info({ syncType }, "Starting Indian market sync");

      await MarketSyncService.runInMarketDataSync();

      return NextResponse.json({
        success: true,
        message: `Indian market sync completed (${syncType})`,
        syncType,
        timestamp: now.toISOString(),
      });
    },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
