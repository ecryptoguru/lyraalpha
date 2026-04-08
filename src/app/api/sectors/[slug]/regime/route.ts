import { NextRequest, NextResponse } from "next/server";
import { getLatestSectorRegime } from "@/lib/engines/sector-regime";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "sector-regime-api" });

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Find sector by slug
    const sector = await prisma.sector.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!sector) {
      return apiError("Sector not found", 404);
    }

    // Get latest sector regime
    const regimeData = await getLatestSectorRegime(sector.id);

    if (!regimeData) {
      return NextResponse.json(
        { error: "Sector regime data not available" },
        { status: 404 },
      );
    }

    const response = NextResponse.json({
      sector: {
        id: sector.id,
        name: sector.name,
        slug: sector.slug,
      },
      regime: regimeData.regime,
      regimeScore: regimeData.regimeScore,
      metrics: {
        participationRate: regimeData.participationRate,
        relativeStrength: regimeData.relativeStrength,
        rotationMomentum: regimeData.rotationMomentum,
        leadershipScore: regimeData.leadershipScore,
      },
      drivers: regimeData.drivers,
      interpretation: interpretSectorRegime(regimeData),
    });

    // Cache for 1 hour
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=59",
    );

    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Sector regime API failed");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * Generate human-readable interpretation
 */
function interpretSectorRegime(data: {
  regime: string;
  regimeScore: number;
  participationRate: number;
  relativeStrength: number;
  rotationMomentum: number;
  leadershipScore: number;
}): string {
  const parts: string[] = [];

  // Regime interpretation
  if (data.regime === "STRONG_RISK_ON") {
    parts.push("Sector showing strong bullish momentum");
  } else if (data.regime === "RISK_ON") {
    parts.push("Sector in positive trend");
  } else if (data.regime === "DEFENSIVE") {
    parts.push("Sector showing defensive characteristics");
  } else if (data.regime === "RISK_OFF") {
    parts.push("Sector under pressure");
  } else {
    parts.push("Sector in neutral state");
  }

  // Participation
  if (data.participationRate >= 70) {
    parts.push("with broad participation");
  } else if (data.participationRate <= 30) {
    parts.push("with narrow participation");
  }

  // Relative strength
  if (data.relativeStrength > 5) {
    parts.push("and outperforming the market");
  } else if (data.relativeStrength < -5) {
    parts.push("and underperforming the market");
  }

  // Leadership
  if (data.leadershipScore >= 70) {
    parts.push(". Sector is leading the market.");
  } else if (data.leadershipScore <= 30) {
    parts.push(". Sector is lagging.");
  } else {
    parts.push(".");
  }

  return parts.join(" ");
}
