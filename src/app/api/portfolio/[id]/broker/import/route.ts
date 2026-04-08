import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { BrokerNormalizationResultSchema } from "@/lib/schemas";
import { dashboardHomeCachePrefix } from "@/lib/cache-keys";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { computeAndStorePortfolioHealth } from "@/lib/services/portfolio.service";
import { applyBrokerNormalizationResultToPortfolio } from "@/lib/services/broker-import.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

const BrokerImportRequestSchema = z.object({
  snapshot: BrokerNormalizationResultSchema,
  replaceExisting: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id: portfolioId } = await params;
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: { id: true },
    });

    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }

    const validation = BrokerImportRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid broker snapshot", issues: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const summary = await applyBrokerNormalizationResultToPortfolio({
      portfolioId: portfolio.id,
      snapshot: validation.data.snapshot,
      replaceExisting: validation.data.replaceExisting,
    });

    await computeAndStorePortfolioHealth(portfolio.id).catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "Broker import health recompute failed (non-fatal)");
    });

    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    return NextResponse.json({ summary });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to import broker snapshot");
    return apiError("Failed to import broker snapshot", 500);
  }
}
