import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/rate-limit/utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { IntelligenceFeedSchema, parseSearchParams } from "@/lib/schemas";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";
import type { Prisma } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "api-intelligence-feed" });

const DB_TIMEOUT_MS = 3000;

class FeedTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Intelligence feed timed out after ${timeoutMs}ms`);
    this.name = "FeedTimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new FeedTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

/**
 * GET /api/intelligence/feed
 * Fetches latest institutional events across the entire universe
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting — open data but protect against abuse
    const { userId } = await auth();
    const isTest = isRateLimitBypassEnabled();
    if (!isTest) {
      const identifier = userId || getClientIp(request);
      const rateLimitError = await rateLimitGeneral(identifier, userId || undefined);
      if (rateLimitError) return rateLimitError;
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(searchParams, IntelligenceFeedSchema);
    if (!parsed.success) {
      return apiError("Invalid parameters", 400);
    }
    const { limit, type, severity, region, assetType } = parsed.data;
    const types = type ? type.split(",").map((t: string) => t.trim()) : [];
    const cacheKey = `intel:feed:${region}:${assetType || "ALL"}:${type || "ALL"}:${severity || "ALL"}:${limit}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      const response = NextResponse.json(cached);
      response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
      return response;
    }

    const eventFilter: Prisma.InstitutionalEventWhereInput = {};
    if (types.length === 1) {
      eventFilter.type = types[0];
    } else if (types.length > 1) {
      eventFilter.type = { in: types };
    }
    if (severity) {
      eventFilter.severity = severity;
    }

    const where: Prisma.InstitutionalEventWhereInput = {
      ...eventFilter,
      asset: {
        region,
        ...(assetType ? { type: assetType } : {}),
      },
    };

    const [events, availableTypeGroups] = await withTimeout(
      Promise.all([
        prisma.institutionalEvent.findMany({
          where,
          take: limit,
          orderBy: { date: "desc" },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            severity: true,
            date: true,
            metadata: true,
            asset: {
              select: {
                symbol: true,
                name: true,
                type: true,
                region: true,
              },
            },
          },
        }),
        prisma.asset.groupBy({
          by: ["type"],
          where: {
            region,
            institutionalEvents: {
              some: eventFilter,
            },
          },
          _count: {
            _all: true,
          },
        }),
      ]),
      DB_TIMEOUT_MS,
    );

    const availableAssetTypes = availableTypeGroups.reduce<Record<string, number>>((acc, group) => {
      acc[group.type] = group._count._all;
      return acc;
    }, {});

    const payload = {
      success: true,
      events,
      availableAssetTypes,
      region,
      timestamp: new Date().toISOString(),
    };

    await setCache(cacheKey, payload, 300);

    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    return response;
  } catch (error) {
    if (error instanceof FeedTimeoutError) {
      logger.warn({ timeoutMs: error.timeoutMs }, "Intelligence feed timed out");
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable" },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }

    logger.error({ err: sanitizeError(error) }, "Failed to fetch global intelligence feed");
    return NextResponse.json(
      { success: false, error: "Failed to fetch intelligence feed" },
      { status: 500 },
    );
  }
}
