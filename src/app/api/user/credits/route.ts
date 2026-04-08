import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCreditPackages, getUserCredits } from "@/lib/services/credit.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "user-credits-api" });

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    // Fetch packages + current balance in parallel
    const [packages, balance] = await Promise.all([
      getCreditPackages(),
      getUserCredits(userId),
    ]);

    return NextResponse.json({ packages, balance });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch credit packages");
    return apiError("Failed to fetch packages", 500);
  }
}
