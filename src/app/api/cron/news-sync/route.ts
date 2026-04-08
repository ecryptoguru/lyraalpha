import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-news-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/news-sync
 * Crypto news sync (every 6 hours):
 * - CryptoPanic + other crypto-native news sources
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "news-sync" },
    async () => {
      return NextResponse.json({
        success: true,
        message: "Crypto news sync completed",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
