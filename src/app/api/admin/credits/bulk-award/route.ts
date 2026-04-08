import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-bulk-credits" });

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;
  const adminId = check.userId;

  try {
    const body = await req.json();
    const userIds: string[] = Array.isArray(body.userIds)
      ? Array.from(new Set(body.userIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)))
      : [];
    const amount = body.amount;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return apiError("userIds array required", 400);
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return apiError("Valid positive amount required", 400);
    }

    if (!reason || typeof reason !== "string") {
      return apiError("Reason required", 400);
    }

    const results = await Promise.allSettled(
      userIds.map((userId) =>
        prisma.$transaction(async (tx) => {
          await grantCreditsInTransaction(tx, userId, amount, "ADJUSTMENT" as never, reason);
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    logger.info({ adminId, userCount: userIds.length, amount, reason, successful, failed }, "Bulk credits awarded");

    return NextResponse.json({
      success: true,
      awarded: successful,
      failed,
      totalCredits: amount * successful,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Bulk credit award failed");
    return apiError("Internal error", 500);
  }
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, credits: true, plan: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ users });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch users");
    return apiError("Internal error", 500);
  }
}
