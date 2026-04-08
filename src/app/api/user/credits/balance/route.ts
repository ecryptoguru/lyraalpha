import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserCredits } from "@/lib/services/credit.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "credits-balance-api" });

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const credits = await getUserCredits(userId);
    return NextResponse.json({ credits });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Credits balance fetch failed");
    return apiError("Failed to fetch credits", 500);
  }
}
