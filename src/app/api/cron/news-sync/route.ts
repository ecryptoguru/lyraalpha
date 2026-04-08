import { NextResponse } from "next/server";
import { FinnhubSyncService } from "@/lib/services/finnhub-sync.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-news-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/news-sync
 * IN + US news sync (every 6 hours):
 * - US: Finnhub company/market news
 * - IN: Moneycontrol + Economic Times RSS
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "news-sync" },
    async () => {
      await FinnhubSyncService.syncNewsOnly();
      return NextResponse.json({
        success: true,
        message: "IN + US news sync completed",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
