import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { AddHoldingSchema } from "@/lib/schemas";
import { computeAndStorePortfolioHealth } from "@/lib/services/portfolio.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

const HOLDING_LIMITS: Record<string, number> = {
  STARTER: 10,
  PRO: 30,
  ELITE: 100,
  ENTERPRISE: 100,
};

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
    const body = await req.json();
    const validation = AddHoldingSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const { symbol, quantity, avgPrice } = validation.data;
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Fetch portfolio, plan, and asset concurrently
    const [portfolio, plan, asset] = await Promise.all([
      prisma.portfolio.findFirst({
        where: { id: portfolioId, userId },
        select: { id: true, region: true, currency: true, _count: { select: { holdings: true } } },
      }),
      getUserPlan(userId),
      prisma.asset.findUnique({
        where: { symbol: normalizedSymbol },
        select: { id: true, region: true, currency: true, name: true, type: true },
      }),
    ]);

    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }
    if (!asset) {
      return apiError("Asset not found in universe", 404);
    }

    // Region check: only enforce when asset has an explicit region (null = global asset, allowed anywhere)
    if (asset.region !== null && asset.region !== portfolio.region) {
      return NextResponse.json(
        { error: `Asset region (${asset.region}) does not match portfolio region (${portfolio.region})` },
        { status: 422 },
      );
    }

    // Limit check — fetch existing holding in the same check to avoid a separate round-trip
    const existingHolding = await prisma.portfolioHolding.findUnique({
      where: { portfolioId_assetId: { portfolioId, assetId: asset.id } },
      select: { id: true },
    });
    const isNewHolding = !existingHolding;
    const limit = HOLDING_LIMITS[plan] ?? 10;
    if (isNewHolding && portfolio._count.holdings >= limit) {
      return NextResponse.json(
        { error: `Holdings limit reached. Your ${plan} plan allows up to ${limit} holdings per portfolio.`, limit },
        { status: 403 },
      );
    }

    const holding = await prisma.portfolioHolding.upsert({
      where: { portfolioId_assetId: { portfolioId, assetId: asset.id } },
      create: {
        portfolioId,
        assetId: asset.id,
        symbol: normalizedSymbol,
        quantity,
        avgPrice,
        currency: asset.currency ?? portfolio.currency,
      },
      update: { quantity, avgPrice },
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
          },
        },
      },
    });

    computeAndStorePortfolioHealth(portfolioId).catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "Post-add health recompute failed (non-fatal)");
    });

    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to add holding");
    return apiError("Failed to add holding", 500);
  }
}
