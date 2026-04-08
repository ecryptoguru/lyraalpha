import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/market-data";
import { rateLimitMarketData } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit/utils";
import { prisma } from "@/lib/prisma";
import { getUserPlan, canAccessAssetType } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { StocksQuotesSchema, parseSearchParams } from "@/lib/schemas";

const logger = createLogger({ service: "stocks-api" });

export const dynamic = "force-dynamic"; // Ensure not cached statically

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseSearchParams(searchParams, StocksQuotesSchema);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid symbols parameter" },
        { status: 400 },
      );
    }
    const { symbols } = parsed.data;

    // Rate limiting
    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    // Enforce market access policy: Starter/Pro cannot request crypto quotes
    if (!canAccessAssetType(plan, "CRYPTO")) {
      const records = await prisma.asset.findMany({
        where: { symbol: { in: symbols } },
        select: { symbol: true, type: true },
      });
      const blockedSymbols = records
        .filter((record) => record.type === "CRYPTO")
        .map((record) => record.symbol);

      if (blockedSymbols.length > 0) {
        return NextResponse.json(
          {
            error: "Upgrade to Elite to access crypto market quotes.",
            blockedSymbols,
          },
          { status: 403 },
        );
      }
    }

    const identifier = userId || getClientIp(req);
    const rateLimitError = await rateLimitMarketData(
      identifier,
      userId || undefined,
    );
    if (rateLimitError) {
      return rateLimitError;
    }

    const data = await getQuotes(symbols);

    const response = NextResponse.json(data);
    // Cache for 1 minute with 30s stale-while-revalidate
    response.headers.set(
      "Cache-Control",
      "private, no-store",
    );
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Quotes API failed");
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 },
    );
  }
}
