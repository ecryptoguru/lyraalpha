import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitMarketData } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit/utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { StocksQuotesSchema, parseSearchParams } from "@/lib/schemas";

const logger = createLogger({ service: "stocks-quotes" });

export const dynamic = "force-dynamic";

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
    // Schema already validated and transformed to string[] of safe symbols
    const symbolList = parsed.data.symbols.map((s) => s.toUpperCase());

    const { userId } = await auth();
    const identifier = userId || getClientIp(req);
    const rateLimitError = await rateLimitMarketData(identifier, userId || undefined);
    if (rateLimitError) return rateLimitError;

    const assets = await prisma.asset.findMany({
      where: { symbol: { in: symbolList } },
      select: { symbol: true, price: true, changePercent: true, name: true, type: true },
    });

    const data: Record<string, { symbol: string; price: number | null; changePercent: number | null; name: string | null; type: string }> = {};
    for (const a of assets) {
      data[a.symbol] = a;
    }

    const response = NextResponse.json(data);
    // Quotes freshness is critical — no store; Redis owns any caching above this.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Quotes API failed");
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
