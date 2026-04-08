import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-full-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Extend duration for full sweep if needed
export const preferredRegion = "bom1";

/**
 * POST /api/cron/full-sync
 * Manual recovery/backfill sync.
 * Runs full platform pipeline in one call:
 * harvest + analytics + multi-source intelligence + housekeeping.
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "full-sync" },
    async () => {
      await MarketSyncService.fullSync();
      return NextResponse.json({
        success: true,
        message: "Market data sync completed successfully",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

/**
 * GET for manual testing or Vercel trigger flexibility
 */
export async function GET(request: Request) {
  return POST(request);
}
