import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { UpdatePortfolioSchema } from "@/lib/schemas";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { dashboardHomeCachePrefix } from "@/lib/cache-keys";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id } = await params;

    const portfolio = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        holdings: {
          include: {
            asset: {
              select: {
                symbol: true,
                name: true,
                type: true,
                price: true,
                changePercent: true,
                currency: true,
                region: true,
                sector: true,
                avgTrendScore: true,
                avgMomentumScore: true,
                avgVolatilityScore: true,
                avgLiquidityScore: true,
                avgTrustScore: true,
                avgSentimentScore: true,
                compatibilityScore: true,
                compatibilityLabel: true,
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
        healthSnapshots: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    return apiSuccess({ portfolio });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch portfolio");
    return apiError("Failed to fetch portfolio", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const validation = UpdatePortfolioSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const portfolio = await prisma.$transaction(async (tx) => {
      const existing = await tx.portfolio.findFirst({ where: { id, userId }, select: { id: true } });
      if (!existing) return null;
      return tx.portfolio.update({
        where: { id },
        data: validation.data,
        include: { _count: { select: { holdings: true } } },
      });
    });
    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    return apiSuccess({ portfolio });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to update portfolio");
    return apiError("Failed to update portfolio", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id } = await params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.portfolio.findFirst({ where: { id, userId }, select: { id: true } });
      if (!existing) return false;
      await tx.portfolio.delete({ where: { id } });
      return true;
    });
    if (!deleted) {
      return apiError("Portfolio not found", 404);
    }

    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to delete portfolio");
    return apiError("Failed to delete portfolio", 500);
  }
}
