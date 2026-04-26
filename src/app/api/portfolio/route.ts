import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getUserPlan, getPlanLimit } from "@/lib/middleware/plan-gate";
import { CreatePortfolioSchema, PortfolioQuerySchema, parseSearchParams } from "@/lib/schemas";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { dashboardHomeCachePrefix } from "@/lib/cache-keys";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const parsed = parseSearchParams(req.nextUrl.searchParams, PortfolioQuerySchema);
    if (!parsed.success) {
      return apiError("Invalid query parameters", 400);
    }

    const where: { userId: string; region?: string } = { userId };
    if (parsed.data.region) {
      where.region = parsed.data.region;
    }

    const portfolios = await prisma.portfolio.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        currency: true,
        region: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { holdings: true } },
        healthSnapshots: {
          orderBy: { date: "desc" },
          take: 1,
          select: { healthScore: true, date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ portfolios });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch portfolios");
    return apiError("Failed to fetch portfolios", 500);
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = CreatePortfolioSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const { name, description, currency, region } = validation.data;

    const plan = await getUserPlan(userId);
    const limit = getPlanLimit(plan, "portfolio_count");

    const portfolio = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.portfolio.count({ where: { userId } });
      if (existingCount >= limit) {
        return null;
      }
      return tx.portfolio.create({
        data: { userId, name, description, currency, region },
        include: { _count: { select: { holdings: true } } },
      });
    });

    if (!portfolio) {
      return apiError(
        `Portfolio limit reached. Your ${plan} plan allows up to ${limit} portfolio(s).`,
        403,
        { limit },
      );
    }

    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    return apiSuccess({ portfolio }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("A portfolio with that name already exists. Please choose a different name.", 409);
    }
    logger.error({ err: sanitizeError(error), userId }, "Failed to create portfolio");
    return apiError("Failed to create portfolio", 500);
  }
}
