import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { PROMO_ERROR_MESSAGE, redeemPrelaunchCoupon } from "@/lib/prelaunch-access";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "prelaunch-redeem-api" });

const RedeemCouponSchema = z.object({
  coupon: z.string().trim().min(1).max(32),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    // Rate limit: prevent coupon brute-force enumeration
    const rl = await rateLimitGeneral(`prelaunch_redeem_${userId}`, userId);
    if (rl) return rl;

    const body = await req.json();
    const parsed = RedeemCouponSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(PROMO_ERROR_MESSAGE, 400);
    }

    const result = await redeemPrelaunchCoupon(userId, parsed.data.coupon);
    if (!result.success) {
      return apiError(result.error ?? "Not found", 404);
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to redeem prelaunch coupon");
    return apiError(PROMO_ERROR_MESSAGE, 500);
  }
}
