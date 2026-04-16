"use client";

import useSWR from "swr";
import { GitBranch, ShieldAlert, Activity } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRegion } from "@/lib/context/RegionContext";

import { fetcher } from "@/lib/swr-fetcher";

type CorrelationPayload = {
  region: "US" | "IN";
  computedAt: string;
  correlation: {
    avgCorrelation: number | null;
    dispersion: number | null;
    trend: string | null;
    regime: string | null;
    implications: string | null;
    confidence: string | null;
  };
  crossSector: {
    avgCorrelation: number | null;
    regime: string | null;
    trend: string | null;
    sectorDispersionIndex: number | null;
    guidance: string | null;
    implications: string | null;
  } | null;
};

function barWidth(pct: number): string {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `${v}%`;
}

function classify(avg: number | null): {
  label: string;
  color: string;
  bg: string;
} {
  if (avg == null) {
    return {
      label: "Awaiting Data",
      color: "text-slate-400",
      bg: "bg-slate-400/10 border-slate-400/20",
    };
  }

  if (avg >= 0.65) {
    return {
      label: "Macro-Driven",
      color: "text-rose-400",
      bg: "bg-rose-400/10 border-rose-400/20",
    };
  }

  if (avg >= 0.45) {
    return {
      label: "Transitioning",
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    };
  }

  return {
    label: "Sector-Specific",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  };
}

export function CorrelationStressCard({ className }: { className?: string }) {
  const { region } = useRegion();

  const { data } = useSWR<CorrelationPayload>(
    `/api/market/correlation-stress?region=${region}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true, refreshInterval: 300000 },
  );

  if (!data) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-4 md:p-5",
          className,
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Correlation Stress
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-44 bg-muted/15 rounded animate-pulse" />
          <div className="h-2 w-full bg-muted/10 rounded animate-pulse" />
          <div className="h-2 w-3/4 bg-muted/10 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const avg = data.crossSector?.avgCorrelation ?? data.correlation.avgCorrelation;
  const status = classify(avg);
  const pct = avg == null ? 0 : Math.round(Math.abs(avg) * 100);

  const guidance =
    data.crossSector?.guidance ??
    data.correlation.implications ??
    "Diversification works best when correlations are low.";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-card/60 shadow-xl backdrop-blur-2xl p-4 md:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Correlation Stress
          </span>
        </div>
        <div className={cn("px-2 py-1 rounded-2xl border text-[8px] font-bold uppercase tracking-widest", status.bg)}>
          <span className={status.color}>{status.label}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-background/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Avg correlation (ρ)
          </span>
          <span className="text-xs font-bold font-mono text-foreground/90">
            {avg == null ? "—" : avg.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 h-2 bg-muted/20 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              avg == null
                ? "bg-slate-400/60"
                : avg >= 0.65
                  ? "bg-rose-400/80"
                  : avg >= 0.45
                    ? "bg-amber-400/80"
                    : "bg-emerald-400/80",
            )}
            style={{ width: barWidth(pct) }}
          />
        </div>

        <div className="mt-2 flex items-start gap-2 text-[10px] font-bold text-muted-foreground/70">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{guidance}</span>
        </div>
      </div>

      <p className="mt-3 text-[10px] font-bold text-muted-foreground/70 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" />
        Higher correlation means assets move together — diversification protects less.
      </p>
    </div>
  );
}
