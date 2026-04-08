import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "correlation-stress-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

type JsonObj = Record<string, unknown>;

/** Safely extract a typed field from an untyped JSON object. */
function pick(obj: JsonObj | null | undefined, key: string, type: "string"): string | null;
function pick(obj: JsonObj | null | undefined, key: string, type: "number"): number | null;
function pick(obj: JsonObj | null | undefined, key: string, type: "string" | "number") {
  if (!obj) return null;
  return typeof obj[key] === type ? (obj[key] as never) : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get("region");
    const region = regionParam === "IN" ? "IN" : "US";

    const cacheKey = `market:correlation:${region}`;

    const payload = await withCache(
      cacheKey,
      async () => {
        const latest = await prisma.marketRegime.findFirst({
          where: { region },
          orderBy: { date: "desc" },
          select: { date: true, correlationMetrics: true },
        });

        const m = (latest?.correlationMetrics as JsonObj | null) ?? null;
        const cs = (m?.crossSector as JsonObj | undefined) ?? null;

        return {
          region,
          computedAt: latest?.date?.toISOString() ?? new Date().toISOString(),
          correlation: {
            avgCorrelation: pick(m, "avgCorrelation", "number"),
            dispersion:     pick(m, "dispersion",     "number"),
            trend:          pick(m, "trend",          "string"),
            regime:         pick(m, "regime",         "string"),
            implications:   pick(m, "implications",   "string"),
            confidence:     pick(m, "confidence",     "string"),
          },
          crossSector: cs ? {
            avgCorrelation:       pick(cs, "avgCorrelation",       "number"),
            regime:               pick(cs, "regime",               "string"),
            trend:                pick(cs, "trend",                "string"),
            sectorDispersionIndex: pick(cs, "sectorDispersionIndex", "number"),
            guidance:             pick(cs, "guidance",             "string"),
            implications:         pick(cs, "implications",         "string"),
          } : null,
        };
      },
      3600, // 1 hour TTL — correlation metrics change only on sync
    );

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
    return res;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Correlation stress API failed");
    return apiError("Internal Server Error", 500);
  }
}
