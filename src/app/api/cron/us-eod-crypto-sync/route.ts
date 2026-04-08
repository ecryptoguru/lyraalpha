import { NextResponse } from "next/server";
import { MarketSyncService } from "@/lib/services/market-sync.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-us-eod-crypto-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "us-eod-crypto-sync" },
    async () => {
      const startMs = Date.now();

      try {
        await MarketSyncService.runCryptoMarketSync();
        return NextResponse.json({
          success: true,
          assetType: "crypto",
          region: "GLOBAL",
          durationMs: Date.now() - startMs,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err: sanitizeError(err) }, "US EOD crypto sync failed");
        return NextResponse.json(
          {
            success: false,
            assetType: "crypto",
            region: "GLOBAL",
            error: "US EOD crypto sync failed",
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
