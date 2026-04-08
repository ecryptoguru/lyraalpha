import { NextRequest, NextResponse } from "next/server";
import { trackReferralClick } from "@/lib/services/referral.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "referral-track-api" });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return apiError("Referral code required", 400);
    }

    const referrerId = await trackReferralClick(code);

    if (!referrerId) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      referrerId,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Referral track GET failed");
    return apiError("Internal server error", 500);
  }
}
