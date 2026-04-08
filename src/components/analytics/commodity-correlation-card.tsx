"use client";

import { cn } from "@/lib/utils";
import { GitBranch, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { CorrelationProfile, CorrelationEntry } from "@/lib/engines/commodity-intelligence";
import { getCommodityProfile } from "@/lib/data/commodity-profiles";

interface CommodityCorrelationCardProps {
  correlations: CorrelationProfile;
  className?: string;
}

const CLUSTER_COLORS: Record<string, string> = {
  precious: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  energy: "bg-red-500/10 text-red-500 border-red-500/20",
  agricultural: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  industrial: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  equity: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  bond: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

function CorrelationRow({ entry, type }: { entry: CorrelationEntry; type: "positive" | "negative" }) {
  const absCorr = Math.abs(entry.correlation);
  const barWidth = absCorr * 100;
  const isPositive = type === "positive";
  const displayName = getCommodityProfile(entry.symbol)?.name || entry.name;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 w-32 shrink-0">
        <span className={cn(
          "text-[8px] font-bold uppercase px-1 py-0.5 rounded border",
          CLUSTER_COLORS[entry.cluster] || "bg-muted/20 text-muted-foreground border-border/30",
        )}>
          {entry.cluster}
        </span>
        <span className="text-[9px] font-medium text-foreground truncate">{displayName}</span>
      </div>
      <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isPositive ? "bg-emerald-500/70" : "bg-red-500/70",
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={cn(
        "text-[10px] font-bold w-12 text-right",
        isPositive ? "text-emerald-500" : "text-red-500",
      )}>
        {entry.correlation > 0 ? "+" : ""}{entry.correlation.toFixed(2)}
      </span>
    </div>
  );
}

function DiversificationBadge({ value }: { value: "high" | "moderate" | "low" }) {
  const config = {
    high: { label: "High Diversification", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    moderate: { label: "Moderate Diversification", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    low: { label: "Low Diversification", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  }[value];

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider", config.color)}>
      {config.label}
    </span>
  );
}

export function CommodityCorrelationCard({ correlations, className }: CommodityCorrelationCardProps) {
  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Correlation Snapshot</h3>
        </div>
        <DiversificationBadge value={correlations.diversificationValue} />
      </div>

      {/* Most Correlated */}
      {correlations.topCorrelated.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Most Correlated (moves together)</p>
          </div>
          {correlations.topCorrelated.map((entry, index) => (
            <CorrelationRow key={`pos-${entry.symbol}-${entry.cluster}-${index}`} entry={entry} type="positive" />
          ))}
        </div>
      )}

      {/* Most Anti-Correlated */}
      {correlations.topAntiCorrelated.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-red-500" />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Most Anti-Correlated (moves opposite)</p>
          </div>
          {correlations.topAntiCorrelated.map((entry, index) => (
            <CorrelationRow key={`neg-${entry.symbol}-${entry.cluster}-${index}`} entry={entry} type="negative" />
          ))}
        </div>
      )}

      {/* Cluster & Avg Correlation */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Cluster:</span>
          <span className={cn(
            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
            CLUSTER_COLORS[correlations.clusterGroup] || "bg-muted/20 text-muted-foreground border-border/30",
          )}>
            {correlations.clusterGroup}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          Avg cross-correlation: <span className="font-bold text-foreground">{correlations.avgCrossCorrelation.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}
