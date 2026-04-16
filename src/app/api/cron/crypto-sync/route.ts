import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-crypto-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/crypto-sync
 * Crypto sync (every 12 hours):
 * - Market data via CoinGecko
 * - Crypto news via NewsData.io
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "crypto-sync" },
    async () => {
      await MarketSyncService.runCryptoMarketSync();
      return NextResponse.json({
        success: true,
        message: "Crypto market + news sync completed",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

/**
 * GET is intentionally not a sync trigger. QStash uses POST, and exposing the heavy
 * 300s sync on GET makes it a target for accidental link prefetchers, browser history,
 * and casual curl-ing. GET now returns a lightweight status payload only.
 */
export async function GET() {
  return NextResponse.json(
    { job: "crypto-sync", trigger: "POST", status: "idle" },
    { status: 200 },
  );
}
