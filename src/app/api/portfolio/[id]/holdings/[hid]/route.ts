import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { UpdateHoldingSchema } from "@/lib/schemas";
import { computeAndStorePortfolioHealth } from "@/lib/services/portfolio.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; hid: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id: portfolioId, hid } = await params;
    const body = await req.json();
    const validation = UpdateHoldingSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const holding = await prisma.portfolioHolding.findFirst({
      where: { id: hid, portfolioId, portfolio: { userId } },
      select: { id: true },
    });
    if (!holding) {
      return apiError("Holding not found", 404);
    }

    const updated = await prisma.portfolioHolding.update({
      where: { id: hid },
      data: validation.data,
      include: {
        asset: {
          select: { symbol: true, name: true, type: true, price: true, changePercent: true },
        },
      },
    });

    computeAndStorePortfolioHealth(portfolioId).catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "Post-update health recompute failed (non-fatal)");
    });

    return NextResponse.json({ holding: updated });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to update holding");
    return apiError("Failed to update holding", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; hid: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { id: portfolioId, hid } = await params;

    const holding = await prisma.portfolioHolding.findFirst({
      where: { id: hid, portfolioId, portfolio: { userId } },
      select: { id: true },
    });
    if (!holding) {
      return apiError("Holding not found", 404);
    }

    await prisma.portfolioHolding.delete({ where: { id: hid } });

    computeAndStorePortfolioHealth(portfolioId).catch((err) => {
      logger.warn({ err: sanitizeError(err), portfolioId }, "Post-delete health recompute failed (non-fatal)");
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to delete holding");
    return apiError("Failed to delete holding", 500);
  }
}
