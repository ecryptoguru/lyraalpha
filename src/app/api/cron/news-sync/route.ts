import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { NewsDataCryptoService } from "@/lib/services/newsdata.service";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-news-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/news-sync
 * Crypto news sync (every 12 hours):
 * - NewsData.io crypto endpoint
 */
export async function POST(request: Request) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "news-sync" },
    async () => {
      const articles = await NewsDataCryptoService.getTrendingNews(10);
      return NextResponse.json({
        success: true,
        message: "Crypto news sync completed via NewsData.io",
        fetched: articles.length,
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: Request) {
  return POST(request);
}
