export type MacroDirection = "up" | "down" | "flat";
export type SectorImpact = "tailwind" | "headwind" | "neutral";

export interface MacroIndicator {
  id: string;
  label: string;
  value: string;
  direction: MacroDirection;
  context: string;
  updatedAt: string;
}

export interface MacroSnapshot {
  region: "US" | "IN";
  updatedAt: string;
  indicators: MacroIndicator[];
}

export interface SectorSensitivity {
  sector: string;
  icon: string;
  impact: SectorImpact;
  driver: string;
}

export interface MacroResearchData {
  snapshot: MacroSnapshot;
  sectors: SectorSensitivity[];
}
