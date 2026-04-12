"use client";

import { useMemo } from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus, Coins, Globe, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface CorrelationMatrixProps {
  data: Record<string, number>;
  className?: string;
}

type BenchmarkMeta = { label: string; icon: LucideIcon; color: string };

const BENCHMARK_METADATA: Record<string, BenchmarkMeta> = {
  "BTC-USD": { label: "Bitcoin", icon: Globe, color: "text-amber-400" },
  "ETH-USD": { label: "Ethereum", icon: Target, color: "text-cyan-400" },
  "SOL-USD": { label: "Solana", icon: Globe, color: "text-orange-400" },
  "BNB-USD": { label: "BNB", icon: Coins, color: "text-amber-400" },
  "XRP-USD": { label: "XRP", icon: Target, color: "text-emerald-400" },
  "ADA-USD": { label: "Cardano", icon: Target, color: "text-cyan-400" },
};

const FALLBACK_META: BenchmarkMeta = { label: "", icon: Globe, color: "text-muted-foreground" };

function correlationColor(c: number): string {
  if (c > 0.3) return "text-emerald-400";
  if (c < -0.3) return "text-rose-400";
  return "text-foreground";
}

function correlationIcon(c: number): LucideIcon {
  if (c > 0.3) return TrendingUp;
  if (c < -0.3) return TrendingDown;
  return Minus;
}

export function CorrelationMatrix({ data, className }: CorrelationMatrixProps) {
  const entries = useMemo(() => {
    const known = Object.keys(data).filter(k => k in BENCHMARK_METADATA);
    return known.length > 0 ? known : Object.keys(data);
  }, [data]);

  return (
    <div
      className={cn(
        "bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl p-6 rounded-3xl h-full flex flex-col justify-between",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] premium-gradient-text">
          Sync Hub
        </h3>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[8px] font-bold text-primary uppercase tracking-widest">
          Pearson Correlation
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 my-auto">
        {entries.map((ticker) => {
          const meta = BENCHMARK_METADATA[ticker] ?? { ...FALLBACK_META, label: ticker };
          const raw = data[ticker];
          const correlation = raw != null && !Number.isNaN(raw) ? raw : 0;
          const colorCls = correlationColor(correlation);
          const DirectionIcon = correlationIcon(correlation);
          const Icon = meta.icon;

          return (
            <div
              key={ticker}
              className="flex items-center justify-between p-4 rounded-2xl bg-background/40 border border-white/5 group hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "p-2 rounded-2xl bg-background/60 border border-white/5",
                    meta.color,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-80 leading-none mb-1">
                    {ticker}
                  </p>
                  <p className="text-xs font-bold leading-none">{meta.label}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right">
                <span className={cn("text-sm font-bold tracking-tight", colorCls)}>
                  {correlation > 0 ? "+" : ""}
                  {correlation.toFixed(2)}
                </span>
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center bg-background/60 border border-white/5 transition-colors",
                    colorCls,
                  )}
                >
                  <DirectionIcon className="h-3 w-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-[9px] text-muted-foreground leading-relaxed text-center">
          Correlation snapshot updates from the latest institutional sync cycle.
        </p>
      </div>
    </div>
  );
}
