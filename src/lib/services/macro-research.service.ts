import type { MacroSnapshot, MacroResearchData, SectorSensitivity } from "@/lib/macro/types";
import { US_SECTOR_SENSITIVITY } from "@/lib/macro/sector-sensitivity/us";
import { IN_SECTOR_SENSITIVITY } from "@/lib/macro/sector-sensitivity/in";
import usSnapshot from "@/lib/macro/snapshots/us.json";
import inSnapshot from "@/lib/macro/snapshots/in.json";
import { withCache, delCache } from "@/lib/redis";
import { macroResearchCacheKey, macroResearchSectorCacheKey } from "@/lib/cache-keys";

const RESEARCH_SNAPSHOT_TTL_SECONDS = 24 * 60 * 60;
const RESEARCH_SECTOR_TTL_SECONDS = 7 * 24 * 60 * 60;

function normalizeRegion(region: string): "US" | "IN" {
  return region === "IN" ? "IN" : "US";
}

function buildSnapshot(region: "US" | "IN"): MacroSnapshot {
  return (region === "IN" ? inSnapshot : usSnapshot) as MacroSnapshot;
}

function buildSectorSensitivity(region: "US" | "IN"): SectorSensitivity[] {
  return region === "IN" ? IN_SECTOR_SENSITIVITY : US_SECTOR_SENSITIVITY;
}

async function getCachedSnapshot(region: "US" | "IN"): Promise<MacroSnapshot> {
  const cached = await withCache(
    macroResearchCacheKey(region),
    async () => buildSnapshot(region),
    RESEARCH_SNAPSHOT_TTL_SECONDS,
  );

  return cached ?? buildSnapshot(region);
}

async function getCachedSectorSensitivity(region: "US" | "IN"): Promise<SectorSensitivity[]> {
  const cached = await withCache(
    macroResearchSectorCacheKey(region),
    async () => buildSectorSensitivity(region),
    RESEARCH_SECTOR_TTL_SECONDS,
  );

  return cached ?? buildSectorSensitivity(region);
}

export class MacroResearchService {
  static async getData(region: string): Promise<MacroResearchData> {
    const normalizedRegion = normalizeRegion(region);
    const [snapshot, sectors] = await Promise.all([
      getCachedSnapshot(normalizedRegion),
      getCachedSectorSensitivity(normalizedRegion),
    ]);

    return { snapshot, sectors };
  }

  static async refreshDaily(region: string): Promise<MacroResearchData> {
    const normalizedRegion = normalizeRegion(region);
    await this.invalidateSnapshot(normalizedRegion);
    return this.getData(normalizedRegion);
  }

  static async invalidateSnapshot(region: string): Promise<void> {
    const normalizedRegion = normalizeRegion(region);
    await delCache(macroResearchCacheKey(normalizedRegion));
  }

  static async invalidateSectorMappings(region: string): Promise<void> {
    const normalizedRegion = normalizeRegion(region);
    await delCache(macroResearchSectorCacheKey(normalizedRegion));
  }

  static async invalidate(region: string): Promise<void> {
    const normalizedRegion = normalizeRegion(region);
    await Promise.all([
      this.invalidateSnapshot(normalizedRegion),
      this.invalidateSectorMappings(normalizedRegion),
    ]);
  }

  static async invalidateAll(): Promise<void> {
    await Promise.all([this.invalidate("US"), this.invalidate("IN")]);
  }
}
