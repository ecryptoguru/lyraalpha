import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCache, setCache } from "@/lib/redis";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";
import { logFireAndForgetError } from "@/lib/fire-and-forget";

const logger = createLogger({ service: "score-history-api" });

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    const upperSymbol = (symbol || "").trim().toUpperCase();
    const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("days") || "90") || 90, 1), 180);

    if (!upperSymbol) {
      return apiError("Symbol required", 400);
    }

    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    const cacheKey = `score-history:${upperSymbol}:${days}`;
    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        const res = NextResponse.json(cached);
        res.headers.set("Cache-Control", "private, max-age=300");
        return res;
      }
    } catch { /* Redis unavailable */ }

    const asset = await prisma.asset.findUnique({
      where: { symbol: upperSymbol },
      select: { id: true },
    });

    if (!asset) {
      return apiError("Asset not found", 404);
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const scores = await prisma.assetScore.findMany({
      where: {
        assetId: asset.id,
        date: { gte: since },
      },
      select: { type: true, value: true, date: true },
      orderBy: { date: "asc" },
    });

    // Group by type
    const grouped: Record<string, { date: string; value: number }[]> = {};
    for (const s of scores) {
      const key = s.type.toLowerCase();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ date: s.date.toISOString().split("T")[0], value: Math.round(s.value) });
    }

    const result = { symbol: upperSymbol, days, history: grouped };

    setCache(cacheKey, result, 300).catch((e) => logFireAndForgetError(e, "score-history-cache"));

    const res = NextResponse.json(result);
    res.headers.set("Cache-Control", "private, max-age=300");
    return res;
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Score history API failed");
    return apiError("Internal error", 500);
  }
}
