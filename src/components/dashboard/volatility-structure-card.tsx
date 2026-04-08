"use client";

import useSWR from "swr";
import { Waves, Activity } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRegion } from "@/lib/context/RegionContext";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type VolatilityPayload = {
  region: "US" | "IN";
  total: number;
  buckets: {
    stable: { label: string; count: number; percent: number };
    normal: { label: string; count: number; percent: number };
    elevated: { label: string; count: number; percent: number };
  };
  computedAt: string;
};

function barWidth(pct: number): string {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `${v}%`;
}

function getOverallLabel(p: VolatilityPayload["buckets"]): {
  label: string;
  color: string;
  bg: string;
} {
  if (p.elevated.percent >= 45) {
    return {
      label: "Elevated Volatility",
      color: "text-rose-400",
      bg: "bg-rose-400/10 border-rose-400/20",
    };
  }

  if (p.stable.percent >= 45) {
    return {
      label: "Stable Tape",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    };
  }

  return {
    label: "Normal Volatility",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  };
}

export function VolatilityStructureCard({ className }: { className?: string }) {
  const { region } = useRegion();

  const { data } = useSWR<VolatilityPayload>(
    `/api/market/volatility-structure?region=${region}`,
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
          <Waves className="h-4 w-4 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Volatility Structure
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-44 bg-muted/15 rounded animate-pulse" />
          <div className="h-2 w-full bg-muted/10 rounded animate-pulse" />
          <div className="h-2 w-full bg-muted/10 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const overall = getOverallLabel(data.buckets);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-2xl p-4 md:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Volatility Structure
          </span>
        </div>
        <div className={cn("px-2 py-1 rounded-2xl border text-[8px] font-bold uppercase tracking-widest", overall.bg)}>
          <span className={overall.color}>{overall.label}</span>
        </div>
      </div>

      <div className="space-y-3">
        <BucketRow
          label={data.buckets.stable.label}
          value={data.buckets.stable.percent}
          count={data.buckets.stable.count}
          total={data.total}
          barClass="bg-emerald-400/80"
        />
        <BucketRow
          label={data.buckets.normal.label}
          value={data.buckets.normal.percent}
          count={data.buckets.normal.count}
          total={data.total}
          barClass="bg-amber-400/80"
        />
        <BucketRow
          label={data.buckets.elevated.label}
          value={data.buckets.elevated.percent}
          count={data.buckets.elevated.count}
          total={data.total}
          barClass="bg-rose-400/80"
        />
      </div>

      <p className="mt-3 text-[10px] font-bold text-muted-foreground/70 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" />
        Volatility is risk. Higher elevated share means position sizing and stop discipline matter more.
      </p>
    </div>
  );
}

function BucketRow({
  label,
  value,
  count,
  total,
  barClass,
}: {
  label: string;
  value: number;
  count: number;
  total: number;
  barClass: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
          {label}
        </span>
        <span className="text-xs font-bold font-mono text-foreground/90">{value}%</span>
      </div>
      <div className="mt-2 h-2 bg-muted/20 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barClass)}
          style={{ width: barWidth(value) }}
        />
      </div>
      <div className="mt-2 text-[9px] text-muted-foreground/70">
        {count.toLocaleString()} / {total.toLocaleString()}
      </div>
    </div>
  );
}
