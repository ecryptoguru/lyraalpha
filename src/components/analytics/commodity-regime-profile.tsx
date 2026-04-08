"use client";

import { cn } from "@/lib/utils";
import { Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { RegimeProfile, RegimeConditionedReturn } from "@/lib/engines/commodity-intelligence";

interface CommodityRegimeProfileProps {
  regimeProfile: RegimeProfile;
  className?: string;
}

const REGIME_LABELS: Record<string, string> = {
  STRONG_RISK_ON: "Strong Risk-On",
  RISK_ON: "Risk-On",
  NEUTRAL: "Neutral",
  DEFENSIVE: "Defensive",
  RISK_OFF: "Risk-Off",
  TRANSITIONING: "Transitioning",
};

const REGIME_COLORS: Record<string, string> = {
  STRONG_RISK_ON: "bg-emerald-500",
  RISK_ON: "bg-emerald-400",
  NEUTRAL: "bg-zinc-400",
  DEFENSIVE: "bg-amber-500",
  RISK_OFF: "bg-red-500",
  TRANSITIONING: "bg-amber-400",
};

function ReturnBar({ cr }: { cr: RegimeConditionedReturn }) {
  const isPositive = cr.avgReturn >= 0;
  const barWidth = Math.min(100, Math.abs(cr.avgReturn) * 15);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider w-24 shrink-0">
        {REGIME_LABELS[cr.regime] || cr.regime}
      </span>
      <div className="flex-1 flex items-center gap-1">
        <div className="flex-1 h-2.5 bg-muted/20 rounded-full overflow-hidden relative">
          {isPositive ? (
            <div className="absolute left-1/2 h-full bg-emerald-500/80 rounded-r-full" style={{ width: `${barWidth / 2}%` }} />
          ) : (
            <div className="absolute right-1/2 h-full bg-red-500/80 rounded-l-full" style={{ width: `${barWidth / 2}%` }} />
          )}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/20" />
        </div>
      </div>
      <span className={cn(
        "text-[10px] font-bold w-14 text-right",
        isPositive ? "text-emerald-500" : "text-red-500",
      )}>
        {isPositive ? "+" : ""}{cr.avgReturn.toFixed(2)}%
      </span>
      <span className="text-[8px] text-muted-foreground w-8 text-right">n={cr.count}</span>
    </div>
  );
}

function SafeHavenBadge({ score }: { score: number }) {
  const level = score >= 65 ? "strong" : score >= 45 ? "moderate" : "weak";
  const config = {
    strong: { label: "Strong Safe Haven", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: Shield },
    moderate: { label: "Moderate Haven", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Minus },
    weak: { label: "Weak Haven", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: TrendingDown },
  }[level];
  const Icon = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider", config.color)}>
      <Icon className="w-3 h-3" />
      {config.label} ({score})
    </div>
  );
}

function SensitivityPill({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const color = value > 0.3 ? "text-emerald-500" : value < -0.3 ? "text-red-500" : "text-muted-foreground";
  const Icon = value > 0.1 ? TrendingUp : value < -0.1 ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-muted/20">
      <Icon className={cn("w-3 h-3", color)} />
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn("text-[10px] font-bold", color)}>
        {value > 0 ? "+" : ""}{value.toFixed(2)}{suffix}
      </span>
    </div>
  );
}

export function CommodityRegimeProfile({ regimeProfile, className }: CommodityRegimeProfileProps) {
  const sortedReturns = [...regimeProfile.conditionedReturns].sort((a, b) => {
    const order = ["STRONG_RISK_ON", "RISK_ON", "NEUTRAL", "DEFENSIVE", "RISK_OFF", "TRANSITIONING"];
    return order.indexOf(a.regime) - order.indexOf(b.regime);
  });

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Regime Sensitivity</h3>
        </div>
        <SafeHavenBadge score={regimeProfile.safeHavenScore} />
      </div>

      {/* Regime-Conditioned Returns */}
      <div className="space-y-1.5">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg Daily Return by Market Regime</p>
        {sortedReturns.map((cr) => (
          <ReturnBar key={cr.regime} cr={cr} />
        ))}
      </div>

      {/* Sensitivity Metrics */}
      <div className="flex flex-wrap gap-2">
        <SensitivityPill label="Inflation" value={regimeProfile.inflationSensitivity} />
        <SensitivityPill label="USD" value={regimeProfile.usdSensitivity} />
      </div>

      {/* Best Regime */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/20">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Performs best in</span>
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white",
          REGIME_COLORS[regimeProfile.dominantRegime] || "bg-zinc-500",
        )}>
          {REGIME_LABELS[regimeProfile.dominantRegime] || regimeProfile.dominantRegime}
        </span>
      </div>
    </div>
  );
}
