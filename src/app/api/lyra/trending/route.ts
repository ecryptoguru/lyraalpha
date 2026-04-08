import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis";
import { TrendingQuestionService } from "@/lib/services/trending-question.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "lyra-trending-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

const CACHE_KEY = "lyra:trending";
// Feature flag: ENABLE_TRENDING_FALLBACK=true → 24h TTL + curated fallback on failure
const FALLBACK_ENABLED = process.env.ENABLE_TRENDING_FALLBACK === "true";
const CACHE_TTL = FALLBACK_ENABLED ? 86400 : 600; // 24h when fallback enabled, else 10 min
const CACHE_CONTROL_HEADER = FALLBACK_ENABLED
  ? "public, s-maxage=3600, stale-while-revalidate=86400"
  : "public, s-maxage=600, stale-while-revalidate=60";

/**
 * GET /api/lyra/trending
 * Returns 6 active trending questions ordered by displayOrder.
 * With ENABLE_TRENDING_FALLBACK=true: 24h Redis TTL + curated fallback on failure.
 */
export async function GET() {
  try {
    const cached = await getCache(CACHE_KEY);
    if (cached) {
      const response = NextResponse.json(cached);
      response.headers.set("Cache-Control", CACHE_CONTROL_HEADER);
      return response;
    }

    let questions = await prisma.trendingQuestion.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
      take: 6,
      select: {
        id: true,
        question: true,
        category: true,
        displayOrder: true,
      },
    });

    if (questions.length === 0) {
      questions = TrendingQuestionService.getCuratedFallback();
      void TrendingQuestionService.refreshTrendingQuestions().catch((refreshErr) => {
        logger.warn({ err: sanitizeError(refreshErr) }, "Async LLM refresh failed");
      });
    }

    // If still empty after refresh attempt, use curated fallback (when enabled)
    if (questions.length === 0 && FALLBACK_ENABLED) {
      logger.info("Returning curated fallback trending questions");
      questions = TrendingQuestionService.getCuratedFallback();
    }

    const payload = { success: true, questions };
    await setCache(CACHE_KEY, payload, CACHE_TTL);

    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", CACHE_CONTROL_HEADER);
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch trending questions");

    // Last-resort fallback: return curated questions even on total failure
    if (FALLBACK_ENABLED) {
      const fallback = TrendingQuestionService.getCuratedFallback();
      return NextResponse.json({ success: true, questions: fallback, fallback: true });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trending questions",
      },
      { status: 500 },
    );
  }
}
