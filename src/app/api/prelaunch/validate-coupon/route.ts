import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { isAllowedPrelaunchCoupon, normalizePrelaunchCoupon } from "@/lib/config/prelaunch";
import { getClientIp } from "@/lib/rate-limit/utils";
import { rateLimitGeneral } from "@/lib/rate-limit";

const logger = createLogger({ service: "validate-coupon-api" });

const ValidateCouponSchema = z.object({
  code: z.string().trim().min(1).max(32),
});

/**
 * Public pre-auth endpoint — no authentication required.
 * Placed under /api/prelaunch/ (not /api/auth/) to bypass the auth proxy.
 *
 * Validates against two sources:
 *  1. Hardcoded ALLOWED_COUPONS in prelaunch.ts (ELITE15, ELITE30)
 *  2. PromoCode table in the database
 *
 * Returns { valid: true } or { valid: false } only.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimitResponse = await rateLimitGeneral(`prelaunch_validate_${ip}`);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const parsed = ValidateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ valid: false });
    }

    const code = normalizePrelaunchCoupon(parsed.data.code);
    if (!code) {
      return NextResponse.json({ valid: false });
    }

    // 1. Check hardcoded prelaunch codes first (ELITE15, ELITE30, etc.)
    if (isAllowedPrelaunchCoupon(code)) {
      return NextResponse.json({ valid: true });
    }

    // 2. Fall through to DB promo codes
    const promo = await prisma.promoCode.findUnique({
      where: { code },
      select: {
        isActive: true,
        expiresAt: true,
        maxUses: true,
        usedCount: true,
      },
    });

    const valid = Boolean(
      promo &&
        promo.isActive &&
        (!promo.expiresAt || promo.expiresAt > new Date()) &&
        (!promo.maxUses || promo.usedCount < promo.maxUses),
    );

    return NextResponse.json({ valid });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to validate coupon");
    return NextResponse.json({ valid: false });
  }
}
