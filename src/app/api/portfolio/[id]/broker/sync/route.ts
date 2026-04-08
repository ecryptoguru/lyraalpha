import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { dashboardHomeCachePrefix } from "@/lib/cache-keys";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { computeAndStorePortfolioHealth } from "@/lib/services/portfolio.service";
import { applyBrokerNormalizationResultToPortfolio } from "@/lib/services/broker-import.service";
import { getConnector } from "@/lib/connectors";
import { BrokerNormalizationResultSchema } from "@/lib/schemas";
import type { BrokerProvider, BrokerSyncScope } from "@/lib/types/broker";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "broker-sync" });

export const dynamic = "force-dynamic";

const BrokerSyncRequestSchema = z.object({
  provider: z.string(),
  credentials: z.record(z.string(), z.string()),
  scope: z.array(z.string()).optional(),
  replaceExisting: z.boolean().optional().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const { id: portfolioId } = await params;

  try {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: { id: true, region: true },
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

    const validation = BrokerSyncRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { provider, credentials, scope, replaceExisting } = validation.data;

    let connector;
    try {
      connector = getConnector(provider as BrokerProvider);
    } catch {
      return apiError(`Unknown broker provider: ${provider}`, 400);
    }

    // Authenticate
    let authHandle;
    try {
      authHandle = await connector.authenticate(credentials as Record<string, string>);
    } catch (err) {
      logger.warn({ err: sanitizeError(err), provider, portfolioId }, "Broker authentication failed");
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Authentication failed" },
        { status: 401 },
      );
    }

    // Fetch and normalize
    let normalizationResult;
    try {
      normalizationResult = await connector.fetchAndNormalize(
        authHandle,
        scope as BrokerSyncScope[] | undefined,
      );
    } catch (err) {
      logger.warn({ err: sanitizeError(err), provider, portfolioId }, "Broker fetch/normalize failed");
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to fetch broker data" },
        { status: 502 },
      );
    }

    // Validate result shape
    const resultValidation = BrokerNormalizationResultSchema.safeParse(normalizationResult);
    if (!resultValidation.success) {
      logger.error(
        { issues: resultValidation.error.flatten(), provider, portfolioId },
        "Connector returned invalid normalization result",
      );
      return apiError("Connector produced invalid data shape", 500);
    }

    // Apply to portfolio
    const summary = await applyBrokerNormalizationResultToPortfolio({
      portfolioId,
      snapshot: resultValidation.data,
      replaceExisting,
    });

    // Recompute health (non-fatal)
    await computeAndStorePortfolioHealth(portfolioId).catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "Broker sync health recompute failed (non-fatal)");
    });

    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    logger.info({ portfolioId, provider, summary }, "Broker sync completed");

    return NextResponse.json({ summary, warnings: normalizationResult.warnings });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId, portfolioId }, "Broker sync failed");
    return apiError("Broker sync failed", 500);
  }
}
