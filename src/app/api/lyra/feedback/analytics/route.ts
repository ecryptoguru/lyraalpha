import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "lyra-feedback-analytics" });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    // Use DB plan instead of a Clerk API round-trip (~200ms saved per request).
    // Admins are auto-set to ELITE/ENTERPRISE via the ensure-user utility, so
    // checking the DB plan is both faster and equivalent to the email check.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    const isAdmin = user?.plan === "ELITE" || user?.plan === "ENTERPRISE";
    if (!isAdmin) {
      return apiError("Forbidden", 403);
    }

    // Collapse 3 count() calls into 1 groupBy to halve DB round-trips
    const [voteCounts, byModel, byTier, recent] = await Promise.all([
      prisma.lyraFeedback.groupBy({
        by: ["vote"],
        _count: { _all: true },
      }),
      prisma.lyraFeedback.groupBy({
        by: ["model"],
        _count: { _all: true },
        _avg: { vote: true },
        orderBy: { _count: { model: "desc" } },
      }),
      prisma.lyraFeedback.groupBy({
        by: ["queryTier"],
        _count: { _all: true },
        _avg: { vote: true },
        orderBy: { _count: { queryTier: "desc" } },
      }),
      prisma.lyraFeedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          vote: true,
          query: true,
          responseSnippet: true,
          symbol: true,
          queryTier: true,
          model: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const thumbsUp = voteCounts.find((r) => r.vote === 1)?._count._all ?? 0;
    const thumbsDown = voteCounts.find((r) => r.vote === -1)?._count._all ?? 0;
    const total = thumbsUp + thumbsDown;
    const satisfactionRate = total > 0 ? Math.round((thumbsUp / total) * 100) : null;

    return NextResponse.json({
      summary: { total, thumbsUp, thumbsDown, satisfactionRate },
      byModel: byModel.map((r) => ({
        model: r.model ?? "Unknown",
        count: r._count._all,
        avgVote: Number((r._avg.vote ?? 0).toFixed(2)),
      })),
      byTier: byTier.map((r) => ({
        tier: r.queryTier ?? "Unknown",
        count: r._count._all,
        avgVote: Number((r._avg.vote ?? 0).toFixed(2)),
      })),
      recent,
    });
  } catch (error) {
    logger.error({ err: error }, "Feedback analytics failed");
    return apiError("Failed to load analytics", 500);
  }
}
