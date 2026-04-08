import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { delCache, invalidateCacheByPrefix } from "@/lib/redis";
import { dashboardHomeCachePrefix, personalBriefingCacheKey } from "@/lib/cache-keys";
import { z } from "zod";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "watchlist-api" });

export const dynamic = "force-dynamic";

const AddWatchlistSchema = z.object({
  symbol: z.string().min(1).max(20),
  region: z.enum(["US", "IN"]).optional(),
});

const RemoveWatchlistSchema = z.object({
  symbol: z.string().min(1).max(20),
});

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const region = req.nextUrl.searchParams.get("region") || undefined;

    const where: { userId: string; region?: string } = { userId };
    if (region && (region === "US" || region === "IN")) {
      where.region = region;
    }

    const items = await prisma.watchlistItem.findMany({
      where,
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
            marketCap: true,
            sector: true,
            fundHouse: true,
            scoreDynamics: true,
            compatibilityScore: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch watchlist");
    return apiError("Failed to fetch watchlist", 500);
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = AddWatchlistSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const { symbol, region } = validation.data;
    const normalizedSymbol = symbol.trim().toUpperCase();

    const asset = await prisma.asset.findUnique({
      where: { symbol: normalizedSymbol },
      select: { id: true, region: true },
    });

    if (!asset) {
      return apiError("Asset not found", 404);
    }

    const item = await prisma.watchlistItem.upsert({
      where: {
        userId_assetId: { userId, assetId: asset.id },
      },
      create: {
        userId,
        assetId: asset.id,
        symbol: normalizedSymbol,
        region: region || asset.region || "US",
      },
      update: {},
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
          },
        },
      },
    });

    await delCache(personalBriefingCacheKey(userId));
    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to add to watchlist");
    return apiError("Failed to add to watchlist", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = RemoveWatchlistSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const { symbol } = validation.data;
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Single query: deleteMany with nested asset filter avoids the findUnique round-trip.
    const { count } = await prisma.watchlistItem.deleteMany({
      where: { userId, asset: { symbol: normalizedSymbol } },
    });

    if (count === 0) {
      return apiError("Asset not found in watchlist", 404);
    }

    await delCache(personalBriefingCacheKey(userId));
    await invalidateCacheByPrefix(dashboardHomeCachePrefix(userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to remove from watchlist");
    return apiError("Failed to remove from watchlist", 500);
  }
}
