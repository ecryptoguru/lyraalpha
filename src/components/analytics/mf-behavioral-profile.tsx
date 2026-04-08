"use client";

import { cn } from "@/lib/utils";
import { Fingerprint } from "lucide-react";
import type { MFBehavioralProfile } from "@/lib/engines/mf-lookthrough";

interface MFBehavioralProfileProps {
  profile: MFBehavioralProfile;
  className?: string;
}

const PROFILE_CONFIG: Record<MFBehavioralProfile, { label: string; description: string; color: string; bg: string; border: string }> = {
  "large-cap-stable": {
    label: "Large Cap Stable",
    description: "Nifty 50 heavy with low volatility. High benchmark correlation. Suitable for conservative equity allocation with predictable behavior.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  "mid-cap-growth": {
    label: "Mid Cap Growth",
    description: "Mid and small cap tilted with higher volatility and growth factor exposure. Can outperform in bull markets but drawdowns are steeper.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  "flexi-cap-active": {
    label: "Flexi Cap Active",
    description: "Active sector rotation with variable market cap mix. Manager discretion drives returns. Style may shift between cycles.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  "sectoral-concentrated": {
    label: "Sectoral Concentrated",
    description: "Single sector bet with high concentration. Performance highly correlated to sector cycle. Not suitable as core holding.",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  "hybrid-balanced": {
    label: "Hybrid Balanced",
    description: "Mix of equity and debt allocation. Lower volatility than pure equity. Suitable for moderate risk profiles seeking stability.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  "debt-income": {
    label: "Debt / Income",
    description: "Primarily fixed income with focus on yield and capital preservation. Equity lookthrough not applicable. Evaluate on duration and credit risk.",
    color: "text-foreground",
    bg: "bg-foreground/5",
    border: "border-foreground/10",
  },
  "index-tracking": {
    label: "Index Tracker",
    description: "Very high benchmark correlation with minimal active management. Validates ETF-like behavior at low cost. Evaluate on tracking error and expense ratio.",
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
  },
};

export function MFBehavioralProfileCard({ profile, className }: MFBehavioralProfileProps) {
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
