import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getUserPlan, isElitePlan } from "@/lib/middleware/plan-gate";
import { SimulatePortfolioSchema } from "@/lib/schemas";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

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
    const plan = await getUserPlan(userId);

    if (plan === "STARTER") {
      return NextResponse.json(
        { error: "Upgrade to Pro or Elite to run Monte Carlo simulations.", gated: true },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validation = SimulatePortfolioSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid simulation parameters", 400);
    }

    const { mode, horizon, paths: requestedPaths } = validation.data;

    // Enforce mode gating: Pro gets A+B only, Elite gets all 4 modes
    const allowedModes = isElitePlan(plan) ? ["A", "B", "C", "D"] : ["A", "B"];
    if (!allowedModes.includes(mode)) {
      return NextResponse.json(
        { error: `Simulation mode ${mode} requires Elite plan.`, gated: true },
        { status: 403 },
      );
    }

    // Enforce path limits: Pro max 5000, Elite max 20000
    const maxPaths = isElitePlan(plan) ? 20000 : 5000;
    const paths = Math.min(requestedPaths, maxPaths);

    // Single query: ownership check + holdings fetch combined
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: {
        id: true,
        region: true,
        holdings: {
          include: {
            asset: {
              select: {
                symbol: true,
                avgVolatilityScore: true,
                avgLiquidityScore: true,
                avgTrustScore: true,
                factorAlignment: true,
                correlationData: true,
                compatibilityScore: true,
              },
            },
          },
        },
      },
    });
    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    const { holdings } = portfolio;
    if (holdings.length < 2) {
      return NextResponse.json(
        { error: "At least 2 holdings are required to run a simulation." },
        { status: 422 },
      );
    }

    // Engine is imported lazily to avoid cold-start cost when not needed
    const { runMonteCarloSimulation } = await import("@/lib/engines/portfolio-monte-carlo");

    const result = await runMonteCarloSimulation({ holdings, mode, horizon, paths, region: portfolio.region ?? "US" });

    return NextResponse.json({ simulation: result, paths, mode, horizon });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to run Monte Carlo simulation");
    return apiError("Failed to run simulation", 500);
  }
}
