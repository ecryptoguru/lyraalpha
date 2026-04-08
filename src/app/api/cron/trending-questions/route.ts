import { NextRequest, NextResponse } from "next/server";
import { TrendingQuestionService } from "@/lib/services/trending-question.service";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-trending-questions" });

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/trending-questions
 * Refreshes Lyra trending questions via AI (runs once every 24h)
 */
export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "trending-questions" },
    async () => {
      const result = await TrendingQuestionService.refreshTrendingQuestions();
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
