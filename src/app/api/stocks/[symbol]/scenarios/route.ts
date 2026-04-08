import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "scenarios-api" });

export const dynamic = "force-dynamic";

/**
 * GET /api/stocks/[symbol]/scenarios
 * Returns scenario analysis data for an asset (bull/base/bear cases, VaR, fragility).
 * Data is pre-computed during market sync and cached in the database.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter is required" },
        { status: 400 },
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
      select: {
        symbol: true,
        name: true,
        type: true,
        scenarioData: true,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 },
      );
    }

    if (!asset.scenarioData) {
      return NextResponse.json(
        {
          ready: false as const,
          status: "not_ready" as const,
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          scenarios: null,
          message:
            "Scenario analysis is not ready yet for this asset. It will appear after the next analytics sync.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ready: true as const,
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        scenarios: asset.scenarioData,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Scenarios API failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
