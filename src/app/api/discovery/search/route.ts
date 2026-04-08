import { NextRequest, NextResponse } from "next/server";
import { DiscoveryService } from "@/lib/services/discovery.service";
import { rateLimitDiscovery } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit/utils";
import { getUserPlan, canAccessAssetType } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { DiscoverySearchSchema, parseSearchParams } from "@/lib/schemas";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";

const logger = createLogger({ service: "discovery-api" });

export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = parseSearchParams(searchParams, DiscoverySearchSchema);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { q } = parsed.data;
  const region = searchParams.get("region") ?? undefined;
  const global = searchParams.get("global") === "true";

  // Rate limiting (use userId if authenticated, otherwise IP)
  const { userId } = await auth();

  // Bypass rate limit for E2E tests — ONLY in non-production
  const isTest = isRateLimitBypassEnabled();

  if (!isTest) {
    const identifier = userId || getClientIp(req);
    const rateLimitError = await rateLimitDiscovery(
      identifier,
      userId || undefined,
    );
    if (rateLimitError) {
      return rateLimitError;
    }
  }

  try {
    const plan = userId ? await getUserPlan(userId) : "STARTER";
    const results = (await DiscoveryService.search(q, region, global)) ?? { sectors: [], assets: [] };
    const gatedResults = canAccessAssetType(plan, "CRYPTO")
      ? results
      : {
          ...results,
          assets: results.assets.filter((asset) => asset.type !== "CRYPTO"),
        };
    const response = NextResponse.json(gatedResults);
    // Cache search results for 5 minutes
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60",
    );
    return response;
  } catch (error: unknown) {
    logger.error({ err: sanitizeError(error) }, "Discovery search failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
