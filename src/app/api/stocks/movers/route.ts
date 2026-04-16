import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitMarketData } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit/utils";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getUserPlan, canAccessRegion } from "@/lib/middleware/plan-gate";
import { StocksMoversSchema, parseSearchParams } from "@/lib/schemas";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "stocks-movers-api" });

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const parsed = parseSearchParams(new URL(req.url).searchParams, StocksMoversSchema);
    if (!parsed.success) {
      return apiError("Invalid parameters", 400);
    }
    const { region } = parsed.data;

    // Auth + plan (for region access policy)
    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    if (!canAccessRegion(plan, region)) {
      return NextResponse.json(
        { error: "Starter and Pro plans support IN/US markets only." },
        { status: 403 },
      );
    }

    // Rate limiting
    const isTest = isRateLimitBypassEnabled();
    if (!isTest) {
      const identifier = userId || getClientIp(req);
      const rateLimitError = await rateLimitMarketData(identifier, userId || undefined);
      if (rateLimitError) return rateLimitError;
    }

    const cacheKey = `movers:${region}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      const response = NextResponse.json(cached);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    // Crypto assets are global (region: null) — include them alongside the requested region.
    const regionFilter = { OR: [{ region }, { region: null }] };
    const moverSelect = { symbol: true, name: true, price: true, changePercent: true, type: true } as const;

    const [gainers, losers] = await Promise.all([
      prisma.asset.findMany({
        where: { ...regionFilter, changePercent: { gt: 0 }, price: { gt: 0 } },
        take: 5,
        orderBy: { changePercent: "desc" },
        select: moverSelect,
      }),
      prisma.asset.findMany({
        where: { ...regionFilter, changePercent: { lt: 0 }, price: { gt: 0 } },
        take: 5,
        orderBy: { changePercent: "asc" },
        select: moverSelect,
      }),
    ]);

    const payload = {
      topGainers: gainers.map(a => ({ symbol: a.symbol, name: a.name, price: a.price || 0, changePercent: a.changePercent || 0, type: a.type })),
      topLosers: losers.map(a => ({ symbol: a.symbol, name: a.name, price: a.price || 0, changePercent: a.changePercent || 0, type: a.type })),
    };

    await setCache(cacheKey, payload, 60);

    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Movers API failed");
    return apiError("Failed to fetch movers", 500);
  }
}
