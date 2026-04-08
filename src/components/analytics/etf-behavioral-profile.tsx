"use client";

import { cn } from "@/lib/utils";
import { Fingerprint } from "lucide-react";
import type { BehavioralProfile } from "@/lib/engines/etf-lookthrough";

interface ETFBehavioralProfileProps {
  profile: BehavioralProfile;
  className?: string;
}

const PROFILE_CONFIG: Record<BehavioralProfile, { label: string; description: string; color: string; bg: string; border: string }> = {
  "growth-sensitive": {
    label: "Growth Sensitive",
    description: "Tilted toward tech and growth sectors. Tends to outperform in risk-on environments and underperform during rate hikes.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  "rate-sensitive": {
    label: "Rate Sensitive",
    description: "Significant bond duration or rate-sensitive sector exposure. Performance closely tied to interest rate expectations.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  "defensive-leaning": {
    label: "Defensive Leaning",
    description: "Heavy in utilities, staples and healthcare. Typically more resilient in downturns but lags in strong rallies.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  "cyclical-tilted": {
    label: "Cyclical Tilted",
    description: "Concentrated in energy, materials and industrials. Highly sensitive to economic cycle and commodity prices.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  "volatility-sensitive": {
    label: "Volatility Sensitive",
    description: "High beta or leveraged exposure. Amplifies market moves in both directions. Not suitable for low-risk profiles.",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  "balanced": {
    label: "Balanced",
    description: "No dominant sector tilt. Broad diversification across factors and sectors. Behaves close to market benchmark.",
    color: "text-foreground",
    bg: "bg-foreground/5",
    border: "border-foreground/10",
  },
};

export function ETFBehavioralProfile({ profile, className }: ETFBehavioralProfileProps) {
  const cfg = PROFILE_CONFIG[profile];

  return (
    <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-3xl border border-white/5 bg-card/60 backdrop-blur-2xl overflow-hidden", className)}>
      <div className="px-5 py-3 border-b border-border/30 flex items-center gap-2">
        <Fingerprint className="w-4 h-4 text-sky-500" />
        <h3 className="text-sm font-bold text-foreground">Behavioral Profile</h3>
      </div>

      <div className="p-5 space-y-3">
        <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border", cfg.bg, cfg.border)}>
          <span className={cn("w-2 h-2 rounded-full", cfg.color.replace("text-", "bg-"))} />
          <span className={cn("text-xs font-bold uppercase tracking-wider", cfg.color)}>
            {cfg.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {cfg.description}
        </p>
      </div>
    </div>
  );
}
