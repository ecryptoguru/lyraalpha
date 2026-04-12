import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { addCredits } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "restore-credits" });

/**
 * POST /api/admin/restore-credits
 * One-time endpoint to restore monthly credits for users affected by the reset-credits bug.
 * Requires admin authentication. Grants 1500 credits to ELITE/ENTERPRISE users.
 */
export async function POST(req: Request) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;
  const adminId = check.userId;

  try {
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || adminId;

    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { plan: true, credits: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan !== "ELITE" && user.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: "Only ELITE/ENTERPRISE users are eligible for credit restore" },
        { status: 403 }
      );
    }

    const amount = 1500;
    const newBalance = await addCredits(
      targetUserId,
      amount,
      CreditTransactionType.ADJUSTMENT,
      "Monthly credit restore - April 2026 (bug fix)"
    );

    logger.info({ adminId, targetUserId, email: user.email, plan: user.plan, amount, newBalance }, "Credits restored");

    return NextResponse.json({
      success: true,
      granted: amount,
      newBalance,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), adminId }, "Failed to restore credits");
    return NextResponse.json(
      { error: "Failed to restore credits" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
