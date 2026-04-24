import { getCache, setCache } from "@/lib/redis";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/rate-limit/utils";
import { NextRequest, NextResponse } from "next/server";

// Lightweight public ticker — data sourced from asset table sync.
// Returns a cached snapshot; never fails the landing page.

const CACHE_KEY = "ticker:public:v1";
const CACHE_TTL = 60; // seconds

const FALLBACK_TICKER = [
  { symbol: "BTC", name: "Bitcoin", price: 68234.12, change24h: 2.14 },
  { symbol: "ETH", name: "Ethereum", price: 3541.88, change24h: -0.82 },
  { symbol: "SOL", name: "Solana", price: 148.56, change24h: 4.21 },
  { symbol: "BNB", name: "BNB", price: 592.30, change24h: 1.05 },
  { symbol: "XRP", name: "XRP", price: 0.6234, change24h: -1.23 },
  { symbol: "ADA", name: "Cardano", price: 0.4589, change24h: 0.67 },
  { symbol: "AVAX", name: "Avalanche", price: 35.12, change24h: 3.45 },
  { symbol: "LINK", name: "Chainlink", price: 14.23, change24h: 1.89 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.1234, change24h: 5.12 },
  { symbol: "DOT", name: "Polkadot", price: 7.34, change24h: -0.45 },
];

interface TickerPayload {
  assets: Array<{ symbol: string; name: string; price: number; change24h: number }>;
  source: string;
  timestamp: number;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitResponse = await rateLimitGeneral(ip);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const cached = await getCache<TickerPayload>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch {
    // Redis failure — fall through to fetch or fallback
  }

  try {
    // Attempt to build from DB if available via lazy import (no top-level prisma init)
    const { directPrisma } = await import("@/lib/prisma");
    const assets = await directPrisma.asset.findMany({
      where: { type: "CRYPTO" },
      select: {
        symbol: true,
        name: true,
        price: true,
        changePercent: true,
      },
      orderBy: { marketCap: "desc" },
      take: 10,
    });

    if (assets && assets.length > 0) {
      const payload: TickerPayload = {
        assets: assets.map((a) => ({
          symbol: a.symbol,
          name: a.name,
          price: Number(a.price ?? 0),
          change24h: Number(a.changePercent ?? 0),
        })),
        source: "db",
        timestamp: Date.now(),
      };
      // Best-effort cache
      try {
        await setCache(CACHE_KEY, payload, CACHE_TTL);
      } catch {
        // fail-open
      }
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "max-age=30, stale-while-revalidate=60" },
      });
    }
  } catch {
    // DB unavailable — return fallback
  }

  const payload: TickerPayload = {
    assets: FALLBACK_TICKER,
    source: "static",
    timestamp: Date.now(),
  };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "max-age=60" },
  });
}
