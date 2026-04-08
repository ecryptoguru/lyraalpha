"use client";

import { cn } from "@/lib/utils";
import { Info, AlertTriangle, Warehouse, Globe2, Leaf } from "lucide-react";

interface StructuralContext {
  cluster: string;
  supplyContext: string;
  demandDrivers: string;
  geopoliticalSensitivity: string;
  storageCost: string;
  inflationHedge: boolean;
  safeHavenCandidate: boolean;
  seasonalNotes: string;
}

interface CommodityStructuralContextProps {
  context: StructuralContext;
  className?: string;
}

const CLUSTER_ICONS: Record<string, typeof Info> = {
  precious: Globe2,
  energy: AlertTriangle,
  agricultural: Leaf,
  industrial: Warehouse,
};

const GEO_COLORS: Record<string, string> = {
  high: "text-red-500 bg-red-500/10 border-red-500/20",
  moderate: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  low: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
};

const STORAGE_LABELS: Record<string, string> = {
  negligible: "Negligible",
  low: "Low",
  moderate: "Moderate",
  high: "High (contango risk)",
};

export function CommodityStructuralContext({ context, className }: CommodityStructuralContextProps) {
  const ClusterIcon = CLUSTER_ICONS[context.cluster] || Info;

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-xl bg-foreground/5 flex items-center justify-center">
          <ClusterIcon className="w-3.5 h-3.5 text-foreground/60" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Structural Context</h3>
        <span className={cn(
          "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ml-auto",
          context.cluster === "precious" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
          context.cluster === "energy" ? "bg-red-500/10 text-red-500 border-red-500/20" :
          context.cluster === "agricultural" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
          "bg-amber-500/10 text-amber-500 border-amber-500/20",
        )}>
          {context.cluster}
        </span>
      </div>

      {/* Supply */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Supply</p>
        <p className="text-[10px] text-foreground/80 leading-relaxed">{context.supplyContext}</p>
      </div>

      {/* Demand */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Demand Drivers</p>
        <p className="text-[10px] text-foreground/80 leading-relaxed">{context.demandDrivers}</p>
      </div>

      {/* Tags Row */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/20">
        {/* Geopolitical Sensitivity */}
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-wider",
          GEO_COLORS[context.geopoliticalSensitivity] || GEO_COLORS.moderate,
        )}>
          <Globe2 className="w-2.5 h-2.5" />
          Geopolitical: {context.geopoliticalSensitivity}
        </span>

        {/* Storage Cost */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/30 text-[8px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/10">
          <Warehouse className="w-2.5 h-2.5" />
          Storage: {STORAGE_LABELS[context.storageCost] || context.storageCost}
        </span>

        {/* Inflation Hedge */}
        {context.inflationHedge && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/20 text-[8px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10">
            Inflation Hedge
          </span>
        )}

        {/* Safe Haven */}
        {context.safeHavenCandidate && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10">
            Safe Haven
          </span>
        )}
      </div>
    </div>
  );
}
