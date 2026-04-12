import { NextRequest, NextResponse } from "next/server";
import { fetchAssetData } from "@/lib/market-data";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlan, canAccessAssetType } from "@/lib/middleware/plan-gate";

const logger = createLogger({ service: "stocks-api" });

import { StockHistorySchema } from "@/lib/schemas";
import { apiError } from "@/lib/api-response";

const RANGE_TTL: Record<string, number> = {
  "1d": 60,
  "5d": 120,
  "1mo": 300,
  "3mo": 600,
  "6mo": 900,
  "1y": 1800,
  "5y": 3600,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = {
      symbol: searchParams.get("symbol"),
      range: searchParams.get("range"),
    };

    const validation = StockHistorySchema.safeParse(params);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const { symbol, range } = validation.data;

    if (!symbol || symbol.toLowerCase() === "undefined" || symbol.toLowerCase() === "null") {
      return apiError("Valid symbol required", 400);
    }

    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    const assetTypeRecord = await prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
      select: { type: true },
    });

    if (assetTypeRecord && !canAccessAssetType(plan, assetTypeRecord.type)) {
      return NextResponse.json(
        { error: "Upgrade to Elite to access crypto market history." },
        { status: 403 },
      );
    }

    const cacheKey = `history:${symbol}:${range}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      const response = NextResponse.json(cached);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const data = await fetchAssetData(symbol, range);

    if (data && typeof data === "object" && "error" in data) {
      return NextResponse.json(data, { status: 404 });
    }

    const ttl = RANGE_TTL[range] || 300;
    await setCache(cacheKey, data, ttl);

    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Asset history API failed");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
