import { NextRequest, NextResponse } from "next/server";
import { DiscoveryService } from "@/lib/services/discovery.service";
import { auth } from "@/lib/auth";
import { getUserPlan, canAccessRegion } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "discovery-sectors-api" });

export async function GET(req: NextRequest) {
  try {
    const region = req.nextUrl.searchParams.get("region")?.toUpperCase() || undefined;

    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    if (region && !canAccessRegion(plan, region)) {
      return NextResponse.json(
        { error: "Starter and Pro plans support IN/US markets only." },
        { status: 403 },
      );
    }

    const sectors = await DiscoveryService.getAllSectors(region);

    const response = NextResponse.json(sectors);
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    return response;
  } catch (error: unknown) {
    logger.error(
      { err: sanitizeError(error) },
      "Discovery sectors list API failed",
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
