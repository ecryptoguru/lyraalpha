import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createReferralCode, getReferralStats, getReferralLink } from "@/lib/services/referral.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "referral-api" });

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const referralCode = await createReferralCode(userId);
    const stats = await getReferralStats(userId);
    const referralLink = getReferralLink(referralCode);

    return NextResponse.json({
      referralCode,
      referralLink,
      ...stats,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Referral GET failed");
    return apiError("Internal server error", 500);
  }
}
