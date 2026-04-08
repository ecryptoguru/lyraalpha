"use client";

import { useRegion } from "@/lib/context/RegionContext";
import useSWR from "swr";
import Link from "next/link";
import {
  Zap,
  Globe,
  ArrowUpRight,
  Shield,
  Cloud,
  Database,
  Smartphone,
  Rocket,
  Sun,
  Droplets,
  Dna,
  Sprout,
  Plane,
  BarChart,
  Handshake,
  Gamepad2,
  Cpu,
  Car,
  Mountain,
  LucideIcon,
  Loader2,
  Landmark,
  ShieldCheck,
  Pill,
  Factory,
  Building2,
  FlaskConical,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Icon mapping helper
const ICON_MAP: Record<string, LucideIcon> = {
  ai: Zap,
  blockchain: Database,
  ev: Car,
  "battery-tech": Zap,
  semiconductors: Cpu,
  "cloud-computing": Cloud,
  cybersecurity: Shield,
  iot: Smartphone,
  "5g-connectivity": Globe,
  "space-tech": Rocket,
  "clean-energy": Sun,
  "hydrogen-green": Droplets,
  biotechnology: Dna,
  agritech: Sprout,
  "drone-tech": Plane,
  "grid-modernization": Zap,
  "defense-aerospace": Plane,
  "capital-goods": BarChart,
  "ma-deals": Handshake,
  "digital-media": Gamepad2,
  "critical-minerals": Mountain,
  fintech: BarChart,
  payments: Handshake,
  "e-commerce": Globe,
  "digital-advertising": Zap,
  "social-media": Globe,
  "streaming-media": Gamepad2,
  "gaming-esports": Gamepad2,
  metaverse: Globe,
  "batteries-storage": Zap,
  genomics: Dna,
  robotics: Cpu,
  "quantum-computing": Cpu,
  // Indian market sectors
  "banking-finance-in": Landmark,
  "insurance-in": ShieldCheck,
  "it-services-in": Cpu,
  "pharma-healthcare-in": Pill,
  "auto-mobility-in": Car,
  "infrastructure-capital-in": Factory,
  "energy-oil-gas-in": Sun,
  "fmcg-consumer-in": Sprout,
  "metals-mining-in": Mountain,
  "telecom-digital-in": Globe,
  "real-estate-cement-in": Building2,
  "conglomerate-in": Layers,
  "chemicals-specialty-in": FlaskConical,
};

// Color mapping helper based on sector nature
const COLOR_MAP: Record<string, string> = {
  ai: "text-yellow-500",
  blockchain: "text-amber-500",
  semiconductors: "text-cyan-500",
  cybersecurity: "text-red-500",
  "clean-energy": "text-amber-400",
  // Indian market sectors
  "banking-finance-in": "text-amber-500",
  "insurance-in": "text-emerald-500",
  "it-services-in": "text-cyan-500",
  "pharma-healthcare-in": "text-rose-500",
  "auto-mobility-in": "text-orange-500",
  "infrastructure-capital-in": "text-amber-500",
  "energy-oil-gas-in": "text-yellow-500",
  "fmcg-consumer-in": "text-green-500",
  "metals-mining-in": "text-slate-400",
  "telecom-digital-in": "text-amber-500",
  "real-estate-cement-in": "text-teal-500",
  "conglomerate-in": "text-amber-500",
  "chemicals-specialty-in": "text-pink-500",
  default: "text-slate-400",
};

function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-400/10 border-emerald-400/20";
  if (score >= 40) return "bg-amber-400/10 border-amber-400/20";
  return "bg-rose-400/10 border-rose-400/20";
}

function getRegimeLabel(regime: string): string {
  return regime.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getMomentumIcon(momentum: number) {
  if (momentum > 5) return TrendingUp;
  if (momentum < -5) return TrendingDown;
  return Minus;
}

interface SectorRegime {
  id: string;
  sectorId: string;
  date: string;
  regime: string;
  regimeScore: number;
  participationRate: number;
  relativeStrength: number;
  rotationMomentum: number;
  leadershipScore: number;
  context: string | null;
}

interface Sector {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stockSectors: {
    asset: {
      symbol: string;
    };
  }[];
  _count: {
    stockSectors: number;
  };
  latestRegime: SectorRegime | null;
  displayOrder: number | null;
}

export function DiscoverySectorGrid() {
  const { region } = useRegion();

  const { data: sectors, isLoading } = useSWR<Sector[]>(
    `/api/discovery/sectors?region=${region}`,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  if (isLoading && !sectors) {
    return (
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-[280px] md:h-[320px] bg-card border border-border rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground opacity-80 font-medium">
          No sectors found for the selected region.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {sectors.map((data: Sector) => {
        const Icon = ICON_MAP[data.slug] || Globe;
        const colorClass = COLOR_MAP[data.slug] || "text-slate-400";
        const assets = data.stockSectors.map((m) => m.asset.symbol);
        const regime = data.latestRegime;
        const score = regime?.regimeScore ?? 0;
        const momentum = regime?.rotationMomentum ?? 0;
        const participation = regime?.participationRate ?? 0;
        const strength = regime?.relativeStrength ?? 0;
        const leadership = regime?.leadershipScore ?? 0;
        const MomentumIcon = getMomentumIcon(momentum);

        return (
          <Link
            key={data.id}
            href={`/dashboard/discovery-stocks/${data.slug}`}
            className="group block h-full cursor-pointer"
          >
            <div className="relative h-full">
              <div className="absolute -inset-0.5 bg-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-500" />

              <div className="relative h-full bg-card border border-border rounded-2xl flex flex-col overflow-hidden group-hover:bg-muted/20 shadow-sm hover:shadow-xl transition-all duration-300">
                {/* Accent Line */}
                <div className={cn("absolute top-0 left-0 w-full h-0.5 opacity-70", colorClass.replace("text-", "bg-"))} />

                <div className="p-4 md:p-5 flex-1 flex flex-col">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-3">
                    <div className={cn("p-2 rounded-2xl border transition-all duration-500 group-hover:rotate-6 group-hover:scale-110", colorClass.replace("text-", "bg-"), "bg-opacity-10 border-border")}>
                      <Icon className={cn("h-4 w-4 md:h-5 md:w-5", colorClass)} />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Regime Score Badge */}
                      {regime && (
                        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-2xl border text-[9px] font-bold", getScoreBg(score), getScoreColor(score))}>
                          <span>{score}</span>
                          <span className="opacity-80">/100</span>
                        </div>
                      )}
                      {/* Momentum Arrow */}
                      <div className={cn("p-1 rounded-xl border", momentum > 5 ? "bg-emerald-400/10 border-emerald-400/20" : momentum < -5 ? "bg-rose-400/10 border-rose-400/20" : "bg-muted/30 border-border/30")}>
                        <MomentumIcon className={cn("h-3 w-3", momentum > 5 ? "text-emerald-400" : momentum < -5 ? "text-rose-400" : "text-muted-foreground/40")} />
                      </div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base md:text-lg font-bold tracking-tight transition-colors group-hover:text-primary leading-tight">
                        {data.name}
                      </h3>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium leading-relaxed line-clamp-2">
                      {data.description}
                    </p>
                  </div>

                  {/* Regime Status */}
                  {regime && (
                    <div className="mb-3">
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border text-[8px] md:text-[9px] font-bold uppercase tracking-widest", getScoreBg(score), getScoreColor(score))}>
                        <span className="opacity-70">Regime:</span>
                        <span>{getRegimeLabel(regime.regime)}</span>
                      </div>
                    </div>
                  )}

                  {/* DSE-style Factor Bars */}
                  {regime && (
                    <div className="space-y-2 mt-auto">
                      <div className="grid grid-cols-4 gap-2">
                        <FactorMini label="Part." value={participation} />
                        <FactorMini label="Str." value={strength} />
                        <FactorMini label="Mom." value={Math.max(0, Math.min(100, momentum + 50))} />
                        <FactorMini label="Lead." value={leadership} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 md:px-5 py-3 border-t border-white/5 bg-muted/10">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-lg md:text-xl font-bold tracking-tight">{data._count.stockSectors}</span>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Assets</span>
                    </div>

                    <div className="flex -space-x-1.5 md:-space-x-2 text-[7px] md:text-[9px]">
                      {assets.slice(0, 3).map((symbol: string, idx: number) => (
                        <div
                          key={symbol}
                          className="h-6 w-6 md:h-7 md:w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center font-bold shadow-sm transition-transform duration-300 group-hover:translate-x-0.5"
                          style={{ zIndex: 3 - idx }}
                        >
                          {symbol.replace(".NS", "").substring(0, 2)}
                        </div>
                      ))}
                      {assets.length > 3 && (
                        <div className="h-6 w-6 md:h-7 md:w-7 rounded-full border-2 border-background bg-muted/60 flex items-center justify-center font-bold text-muted-foreground z-0">
                          +{assets.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function FactorMini({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-400" : value >= 40 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-widest">{label}</span>
        <span className={cn("text-[8px] font-bold font-mono", value >= 70 ? "text-emerald-400" : value >= 40 ? "text-amber-400" : "text-rose-400")}>{Math.round(value)}</span>
      </div>
      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
