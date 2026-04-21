import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  Activity,
  Gauge,
  BarChart3,
  Globe,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreDynamics {
  momentum: number;
  acceleration: number;
  volatility: number;
  trend: "IMPROVING" | "STABLE" | "DETERIORATING";
  percentileRank: number;
  sectorPercentile: number;
}

interface ScoreDynamicsCardProps {
  scoreType: string;
  dynamics: ScoreDynamics;
  className?: string;
}

export function ScoreDynamicsCard({
  scoreType,
  dynamics,
  className,
}: ScoreDynamicsCardProps) {
  const getTrendColor = () => {
    switch (dynamics.trend) {
      case "IMPROVING":
        return "text-success bg-success/10 border-success/20";
      case "DETERIORATING":
        return "text-danger bg-danger/10 border-danger/20";
      default:
        return "text-muted-foreground bg-muted/5 border-border/10";
    }
  };

  const hasData = dynamics && typeof dynamics.momentum === 'number';

  if (!hasData) {
    return (
      <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl p-6 rounded-3xl flex flex-col items-center justify-center min-h-[220px]", className)}>
        <div className="p-3 rounded-full bg-muted/10 mb-3 grayscale opacity-30">
          <Activity className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Incomplete Matrix Data</span>
      </div>
    );
  }

  return (
    <div className={cn("bg-card/60 backdrop-blur-2xl shadow-xl rounded-3xl border border-white/5 relative overflow-hidden group/card transition-all duration-500 hover:bg-card/80 hover:border-primary/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] h-full", className)}>
      {/* Glossy gradient glow on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-primary/5 border border-primary/10 group-hover/card:bg-primary/10 transition-colors">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-[0.15em] text-muted-foreground uppercase leading-none mb-1">
                Quantitative Factor
              </h4>
              <p className="text-lg font-bold tracking-tight text-foreground uppercase">
                {scoreType}
              </p>
            </div>
          </div>
          <div className={cn("px-3 py-1 rounded-xl border text-[9px] font-bold uppercase tracking-widest flex items-center gap-2", getTrendColor())}>
            {dynamics.trend === "IMPROVING" && <TrendingUp className="h-3 w-3" />}
            {dynamics.trend === "DETERIORATING" && <TrendingDown className="h-3 w-3" />}
            {dynamics.trend === "STABLE" && <Minus className="h-3 w-3" />}
            {dynamics.trend}
          </div>
        </div>

        {/* Primary Metrics Group */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Velocity (Institutional term for Momentum) */}
          <div className="bg-background/40 p-3 rounded-2xl border border-border/30 group-hover/card:border-primary/10 transition-colors">
            <div className="flex items-center gap-1.5 mb-1 opacity-80">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Velocity</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-2xl font-bold tracking-tighter", dynamics.momentum >= 0 ? "text-success" : "text-danger")}>
                {dynamics.momentum > 0 ? "+" : ""}{dynamics.momentum.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground opacity-40">σ</span>
            </div>
          </div>

          {/* Inertia (Institutional term for Acceleration) */}
          <div className="bg-background/40 p-3 rounded-2xl border border-border/30 group-hover/card:border-primary/10 transition-colors">
            <div className="flex items-center gap-1.5 mb-1 opacity-80">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Inertia</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold tracking-tight", dynamics.acceleration >= 0 ? "text-success" : "text-danger")}>
                {dynamics.acceleration > 0 ? "+" : ""}{dynamics.acceleration.toFixed(2)}
              </span>
              {dynamics.acceleration !== 0 && (
                dynamics.acceleration > 0 ? <ArrowUp className="h-3 w-3 text-success" /> : <ArrowDown className="h-3 w-3 text-danger" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dispersion (Volatility) & Rankings Matrix */}
      <div className="px-5 pb-5 space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {/* Volatility Row */}
          <div className="flex items-center justify-between py-2 px-3 rounded-2xl bg-background/20 border border-border/20">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dispersion / Vol</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {dynamics.volatility.toFixed(2)}x
            </span>
          </div>

          {/* Global Rank Row */}
          <div className="flex items-center justify-between py-2 px-3 rounded-2xl bg-background/20 border border-border/20">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Percentile</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 rounded-full bg-muted/60 dark:bg-foreground/10 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                  style={{ width: `${dynamics.percentileRank}%` }}
                />
              </div>
              <span className="text-xs font-bold text-primary min-w-[3ch]">
                {dynamics.percentileRank.toFixed(0)}th
              </span>
            </div>
          </div>

          {/* Sector Rank Row */}
          <div className="flex items-center justify-between py-2 px-3 rounded-2xl bg-background/20 border border-border/20">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sector Strength</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 rounded-full bg-muted/60 dark:bg-foreground/10 overflow-hidden">
                <div 
                  className="h-full bg-info transition-all duration-1000 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                  style={{ width: `${dynamics.sectorPercentile}%` }}
                />
              </div>
              <span className="text-xs font-bold text-info min-w-[3ch]">
                {dynamics.sectorPercentile.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Aesthetic Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
    </div>
  );
}
