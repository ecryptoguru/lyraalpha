import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "sector-movers-api" });

export const dynamic = "force-dynamic";

/**
 * GET /api/stocks/[symbol]/sector-movers
 * Returns top 5 assets from the same sector/type ordered by changePercent desc.
 * Excludes the current symbol itself.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    const cacheKey = `sector-movers:${upperSymbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const asset = await prisma.asset.findUnique({
      where: { symbol: upperSymbol },
      select: { sector: true, type: true, region: true },
    });

    if (!asset) {
      return NextResponse.json({ movers: [] });
    }

    const where = asset.sector
      ? { sector: asset.sector, region: asset.region, symbol: { not: upperSymbol }, price: { not: null }, changePercent: { not: null } }
      : { type: asset.type, region: asset.region, symbol: { not: upperSymbol }, price: { not: null }, changePercent: { not: null } };

    const select = {
      symbol: true,
      name: true,
      type: true,
      price: true,
      changePercent: true,
      currency: true,
      sector: true,
      compatibilityScore: true,
    };

    // Fetch top gainers + top losers then pick 5 by highest absolute magnitude
    const [gainers, losers] = await Promise.all([
      prisma.asset.findMany({ where, orderBy: [{ changePercent: "desc" }], take: 10, select }),
      prisma.asset.findMany({ where, orderBy: [{ changePercent: "asc" }], take: 10, select }),
    ]);

    const seen = new Set<string>();
    const candidates = [...gainers, ...losers].filter((a) => {
      if (seen.has(a.symbol)) return false;
      seen.add(a.symbol);
      return true;
    });

    const movers = candidates
      .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
      .slice(0, 5);

    const payload = { movers, groupedBy: asset.sector ? "sector" : "type", label: asset.sector ?? asset.type };
    await setCache(cacheKey, payload, 300).catch(() => {});

    return NextResponse.json(payload);
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Sector movers API failed");
    return NextResponse.json({ movers: [] });
  }
}
