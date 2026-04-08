import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { resetMonthlyCredits } from "@/lib/services/credit.service";

const logger = createLogger({ service: "reset-credits" });

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  return withCronAuthAndLogging(
    req,
    { logger, job: "reset-credits" },
    async () => {
      const users = await prisma.user.findMany({
        where: {
          plan: { in: ["PRO", "ELITE", "ENTERPRISE"] },
        },
        select: { id: true, plan: true },
      });

      await Promise.all(users.map((user) => resetMonthlyCredits(user.id)));

      const proCount = users.filter((user) => user.plan === "PRO").length;
      const eliteCount = users.filter((user) => user.plan === "ELITE").length;
      const enterpriseCount = users.filter((user) => user.plan === "ENTERPRISE").length;
      const resetCount = users.length;
      logger.info(
        { pro: proCount, elite: eliteCount, enterprise: enterpriseCount },
        "Monthly credits reset",
      );

      return NextResponse.json({ success: true, resetCount, pro: proCount, elite: eliteCount, enterprise: enterpriseCount, timestamp: new Date().toISOString() });
    },
  );
}

export async function GET(req: NextRequest) {
  return POST(req);
}
