import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { consumeCredits } from "@/lib/services/credit.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiSuccess, apiError } from "@/lib/api-response";

const logger = createLogger({ service: "explore-credits-api" });

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }
    const { action, symbol, id } = body as { action: "ASSET" | "SECTOR"; symbol?: string; id?: string };

    if (!action || (action !== "ASSET" && action !== "SECTOR")) {
      return apiError("Action must be ASSET or SECTOR", 400);
    }

    const description = action === "ASSET" 
      ? `Asset exploration: ${symbol || "unknown"}` 
      : `Sector exploration: ${id || "unknown"}`;

    // [CREDIT_UPDATE] Deduct 1 credit for exploration
    const { success, remaining } = await consumeCredits(userId, 1, description);
    const response = apiSuccess({ success, remaining });
    response.headers.set("X-Credits-Remaining", String(remaining));
    return response;
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Explore credits API failed");
    return apiError("Internal error", 500);
  }
}
