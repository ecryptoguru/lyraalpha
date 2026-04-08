import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardXP } from "@/lib/engines/gamification";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "award-daily-login" });
const BATCH_SIZE = 500;

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  return withCronAuthAndLogging(
    req,
    { logger, job: "award-daily-login" },
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const alreadyAwardedIds = await prisma.xPTransaction.findMany({
        where: { action: "daily_login", createdAt: { gte: today } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const excludeIds = new Set(alreadyAwardedIds.map((r) => r.userId));

      let cursor: string | undefined;
      let awarded = 0;
      let errors = 0;

      while (true) {
        const batch = await prisma.user.findMany({
          select: { id: true },
          where: { id: { notIn: [...excludeIds] } },
          take: BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: { id: "asc" },
        });

        if (batch.length === 0) break;

        const results = await Promise.allSettled(
          batch.map((u) => awardXP(u.id, "daily_login", "Daily login bonus")),
        );

        awarded += results.filter((r) => r.status === "fulfilled").length;
        errors += results.filter((r) => r.status === "rejected").length;
        cursor = batch[batch.length - 1].id;

        if (batch.length < BATCH_SIZE) break;
      }

      logger.info({ awarded, errors }, "Daily login points awarded");
      return NextResponse.json({ success: true, awarded, errors, timestamp: new Date().toISOString() });
    },
  );
}

export async function GET(req: NextRequest) {
  return POST(req);
}
