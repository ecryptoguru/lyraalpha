import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TrendingTrackSchema } from "@/lib/schemas";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/rate-limit/utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "lyra-trending-track" });

/**
 * POST /api/lyra/trending/track
 * Track clicks on trending questions for analytics
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent click fraud (IP-based, no auth required)
    const identifier = getClientIp(request);
    const rateLimitError = await rateLimitGeneral(identifier);
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = await request.json();
    const validation = TrendingTrackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Question ID required" },
        { status: 400 },
      );
    }

    const { questionId } = validation.data;

    await prisma.trendingQuestion.update({
      where: { id: questionId },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Error tracking question click");
    return NextResponse.json(
      { success: false, error: "Failed to track click" },
      { status: 500 },
    );
  }
}
