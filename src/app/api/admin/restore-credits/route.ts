import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addCredits } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "restore-credits" });

/**
 * POST /api/admin/restore-credits
 * One-time endpoint to restore monthly credits for users affected by the reset-credits bug.
 * Requires authentication. Grants 1500 credits to ELITE/ENTERPRISE users.
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is ELITE or ENTERPRISE
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, credits: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan !== "ELITE" && user.plan !== "ENTERPRISE") {
      return NextResponse.json(
        { error: `Only ELITE/ENTERPRISE can restore credits. Your plan: ${user.plan}` },
        { status: 403 }
      );
    }

    const amount = 1500;
    const newBalance = await addCredits(
      userId,
      amount,
      CreditTransactionType.ADJUSTMENT,
      "Monthly credit restore - April 2026 (bug fix)"
    );

    logger.info({ userId, email: user.email, plan: user.plan, amount, newBalance }, "Credits restored");

    return NextResponse.json({
      success: true,
      previousBalance: user.credits,
      granted: amount,
      newBalance,
      plan: user.plan,
    });
  } catch (error) {
    logger.error({ error, userId: "unknown" }, "Failed to restore credits");
    return NextResponse.json(
      { error: "Failed to restore credits", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
