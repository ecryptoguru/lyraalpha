import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPoints, getPointHistory, getRedemptionOptions } from "@/lib/services/points.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "points-api" });

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const [points, history] = await Promise.all([
      getUserPoints(userId),
      getPointHistory(userId),
    ]);

    return NextResponse.json(
      {
        points,
        history,
        redemptionOptions: getRedemptionOptions(),
      },
      {
        headers: {
          "Cache-Control": "private, no-cache",
        },
      },
    );
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Points GET failed");
    return apiError("Internal server error", 500);
  }
}

