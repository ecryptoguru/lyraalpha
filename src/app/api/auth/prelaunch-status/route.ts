import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getPrelaunchAccessStatus } from "@/lib/prelaunch-access";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "prelaunch-status-api" });

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const rl = await rateLimitGeneral(`prelaunch_status_${userId}`, userId);
    if (rl) return rl;

    const status = await getPrelaunchAccessStatus(userId);
    return NextResponse.json(status);
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch prelaunch access status");
    return apiError("Failed to fetch prelaunch access status", 500);
  }
}

