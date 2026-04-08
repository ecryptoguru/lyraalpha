import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redeemXP, XP_REDEMPTIONS } from "@/lib/engines/gamification";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import type { XPRedemptionType } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "xp-redeem-api" });

const VALID_TYPES = new Set<XPRedemptionType>(XP_REDEMPTIONS.map((r) => r.type));

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();
    const { type } = body as { type: string };

    if (!type || !VALID_TYPES.has(type as XPRedemptionType)) {
      return apiError("Invalid redemption type", 400);
    }

    const result = await redeemXP(userId, type as XPRedemptionType);

    if (result.insufficientXp) {
      return NextResponse.json(
        { success: false, reason: "insufficient_xp", message: "Not enough XP to redeem this reward." },
        { status: 402 },
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, reason: "unknown", message: result.error ?? "Redemption failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      creditsAdded: result.creditsAdded,
      planGranted: result.planGranted,
      newTotalXp: result.newTotalXp,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "XP redeem failed");
    return apiError("Internal server error", 500);
  }
}
