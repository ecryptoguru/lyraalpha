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
 * Crypto sync (every 6 hours):
 * - Market data via CoinGecko
 * - Crypto news via CryptoPanic/Finnhub
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

export async function GET(request: Request) {
  return POST(request);
}
