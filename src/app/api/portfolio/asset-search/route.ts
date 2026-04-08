import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-api" });

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toUpperCase() ?? "";
  const region = req.nextUrl.searchParams.get("region")?.toUpperCase() ?? "US";

  if (!q || q.length < 1) {
    return NextResponse.json({ assets: [] });
  }

  const cacheKey = `asset-search:${region}:${q}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) return NextResponse.json(cached);
  } catch {
    // cache miss — continue
  }

  try {
    const assets = await prisma.asset.findMany({
      where: {
        AND: [
          {
            OR: [
              { symbol: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          },
          {
            OR: [
              { region },
              { region: null },
            ],
          },
        ],
      },
      select: {
        symbol: true,
        name: true,
        type: true,
        sector: true,
        price: true,
        currency: true,
        region: true,
      },
      orderBy: [
        { marketCap: { sort: "desc", nulls: "last" } },
      ],
      take: 12,
    });

    const payload = { assets };
    await setCache(cacheKey, payload, 300).catch(() => null);

    return NextResponse.json(payload);
  } catch (error) {
    logger.error({ err: sanitizeError(error), q, region }, "Asset search failed");
    return apiError("Search failed", 500);
  }
}
