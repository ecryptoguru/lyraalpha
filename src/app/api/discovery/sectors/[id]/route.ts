import { NextRequest, NextResponse } from "next/server";
import { DiscoveryService } from "@/lib/services/discovery.service";
import { DiscoverySectorDTO } from "@/lib/types/discovery.dto";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "discovery-api" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;
    const region = req.nextUrl.searchParams.get("region") ?? undefined;
    const data = await DiscoveryService.getClusteredStocks(id, region);

    if (!data) {
      return apiError("Sector not found", 404);
    }

    // Mapping to DTO
    const dto: DiscoverySectorDTO = {
      slug: data.sector.slug,
      name: data.sector.name,
      description: data.sector.description,
      rationale: data.sector.rationale,
      drivers: data.sector.drivers,
      sectorId: data.sector.id,
      marketContext: data.marketContext,
      tiers: {
        Strong: data.tiers.Strong.map(DiscoveryService.mapToDTO),
        Moderate: data.tiers.Moderate.map(DiscoveryService.mapToDTO),
        Emerging: data.tiers.Emerging.map(DiscoveryService.mapToDTO),
        Peripheral: data.tiers.Peripheral.map(DiscoveryService.mapToDTO),
      },
    };

    const response = NextResponse.json(dto);
    // Cache heavily as sector data changes rarely
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    return response;
  } catch (error: unknown) {
    logger.error({ err: sanitizeError(error) }, "Discovery sector API failed");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
