"use client";

import useSWR from "swr";
import { BarChart3, TrendingUp, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRegion } from "@/lib/context/RegionContext";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type BreadthPayload = {
  region: "US" | "IN";
  total: number;
  metrics: {
    trend: { threshold: number; count: number; percent: number };
    momentum: { threshold: number; count: number; percent: number };
  };
  computedAt: string;
};

function formatPct(n: number): string {
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

function getHealthLabel(trendPct: number, momentumPct: number): {
  label: string;
  color: string;
  bg: string;
} {
  const composite = trendPct * 0.6 + momentumPct * 0.4;

  if (composite >= 70) {
    return {
      label: "Broad Participation",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    };
  }

  if (composite >= 50) {
    return {
      label: "Mixed Participation",
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    };
  }

  return {
    label: "Narrow Participation",
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20",
  };
}

export function MarketBreadthPanel({ className }: { className?: string }) {
  const { region } = useRegion();

  const { data } = useSWR<BreadthPayload>(
    `/api/market/breadth?region=${region}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true, refreshInterval: 300000 },
  );

  if (!data) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-2xl p-4 md:p-5",
          className,
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Market Breadth
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-40 bg-muted/15 rounded animate-pulse" />
          <div className="h-3 w-56 bg-muted/10 rounded animate-pulse" />
          <div className="h-2 w-full bg-muted/10 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const trendPct = data.metrics.trend.percent;
  const momentumPct = data.metrics.momentum.percent;
  const health = getHealthLabel(trendPct, momentumPct);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-2xl p-4 md:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Market Breadth
          </span>
        </div>
        <div className={cn("px-2 py-1 rounded-2xl border text-[8px] font-bold uppercase tracking-widest", health.bg)}>
          <span className={health.color}>{health.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-background/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Trend &gt; {data.metrics.trend.threshold}
            </span>
            <span className="text-xs font-bold font-mono text-foreground/90">
              {formatPct(trendPct)}
            </span>
          </div>
          <div className="mt-2 h-2 bg-muted/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full transition-all duration-700"
              style={{ width: formatPct(trendPct) }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground/70">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>
              {data.metrics.trend.count.toLocaleString()} / {data.total.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-background/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Momentum &gt; {data.metrics.momentum.threshold}
            </span>
            <span className="text-xs font-bold font-mono text-foreground/90">
              {formatPct(momentumPct)}
            </span>
          </div>
          <div className="mt-2 h-2 bg-muted/20 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                momentumPct >= 60 ? "bg-emerald-400/80" : "bg-amber-400/80",
              )}
              style={{ width: formatPct(momentumPct) }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground/70">
            <Zap className="h-3.5 w-3.5" />
            <span>
              {data.metrics.momentum.count.toLocaleString()} / {data.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] font-bold text-muted-foreground/70">
        Breadth = how widely signals are participating across the market. This helps beginners avoid confusing a narrow rally for a healthy regime.
      </p>
    </div>
  );
}
