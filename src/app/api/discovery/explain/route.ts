import { NextRequest } from "next/server";
import { LyraService } from "@/lib/services/lyra.service";
import { consumeCredits, getUserCredits } from "@/lib/services/credit.service";
import { auth } from "@/lib/auth";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/rate-limit/utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiSuccess, apiError } from "@/lib/api-response";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";

const logger = createLogger({ service: "discovery-api" });

export const maxDuration = 60;
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  try {
    // Auth + rate limiting — this endpoint triggers LLM calls
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const isTest = isRateLimitBypassEnabled();
    if (!isTest) {
      const identifier = userId || getClientIp(req);
      const rateLimitError = await rateLimitGeneral(identifier, userId || undefined);
      if (rateLimitError) return rateLimitError;
    }

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");
    const sectorId = searchParams.get("sectorId");

    if (!assetId || !sectorId) {
      return apiError("assetId and sectorId are required", 400);
    }

    // Pre-check credit balance (don't consume yet — deduct only after success)
    const balance = await getUserCredits(userId);
    if (balance < 1) {
      return apiError("Insufficient credits to generate this insight.", 403);
    }

    const explanation = await LyraService.explainInclusion(assetId, sectorId);

    // Deduct 1 credit only after successful generation
    const creditResult = await consumeCredits(userId, 1, "Lyra Research Insight");
    if (!creditResult.success) {
      logger.warn({ userId }, "Credit consumption failed after successful generation — balance may have changed concurrently");
    }

    const response = apiSuccess({ explanation, remaining: creditResult.remaining });
    // Include remaining credits so frontend can update instantly
    response.headers.set("X-Credits-Remaining", String(creditResult.remaining));
    // Cache explanations for 24 hours
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    return response;
  } catch (error: unknown) {
    logger.error({ err: sanitizeError(error) }, "Explanation API failed");
    return apiError("Internal Server Error", 500);
  }
}
