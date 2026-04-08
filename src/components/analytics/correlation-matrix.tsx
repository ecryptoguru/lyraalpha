"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Coins,
  Globe,
  Landmark,
  Target,
} from "lucide-react";

interface CorrelationMatrixProps {
  data: Record<string, number>;
  className?: string;
}

const coins = "coins";
const globe = "globe";
const landmark = "landmark";
const target = "target";

const BENCHMARK_METADATA: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  // US Benchmarks
  SPY: { label: "S&P 500", icon: landmark, color: "text-amber-400" },
  QQQ: { label: "Nasdaq 100", icon: target, color: "text-cyan-400" },
  "BTC-USD": { label: "Bitcoin", icon: globe, color: "text-orange-400" },
  GLD: { label: "Gold", icon: coins, color: "text-amber-400" },
  // Indian Benchmarks
  "^NSEI": { label: "Nifty 50", icon: landmark, color: "text-amber-400" },
  "^BSESN": { label: "Sensex", icon: landmark, color: "text-orange-400" },
  "RELIANCE.NS": { label: "Reliance", icon: target, color: "text-emerald-400" },
  "HDFCBANK.NS": { label: "HDFC Bank", icon: target, color: "text-cyan-400" },
};

export function CorrelationMatrix({ data, className }: CorrelationMatrixProps) {
  // Render only benchmarks that exist in the data
  const benchmarks = Object.keys(data).filter(k => k in BENCHMARK_METADATA);
  // Fallback: if no known benchmarks in data, show all data keys
  const entries = benchmarks.length > 0 ? benchmarks : Object.keys(data);

  return (
    <div
      className={cn(
        "bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl p-6 rounded-3xl border-primary/20 bg-primary/5 h-full flex flex-col justify-between",
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
          const meta = BENCHMARK_METADATA[ticker] || { label: ticker, icon: globe, color: "text-muted-foreground" };
          const correlation = data[ticker] ?? 0;
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
                  {Icon === coins ? (
                    <Coins className="h-4 w-4" />
                  ) : Icon === globe ? (
                    <Globe className="h-4 w-4" />
                  ) : Icon === landmark ? (
                    <Landmark className="h-4 w-4" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-80 leading-none mb-1">
                    {ticker}
                  </p>
                  <p className="text-xs font-bold leading-none">{meta.label}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right">
                <div className="flex flex-col items-end">
                  <span
                    className={cn(
                      "text-sm font-bold tracking-tight",
                      correlation > 0.5
                        ? "text-emerald-400"
                        : correlation < -0.3
                          ? "text-rose-400"
                          : "text-foreground",
                    )}
                  >
                    {correlation > 0 ? "+" : ""}
                    {correlation.toFixed(2)}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center bg-background/60 border border-white/5 transition-colors",
                    correlation > 0.5
                      ? "text-emerald-400"
                      : correlation < -0.3
                        ? "text-rose-400"
                        : "text-muted-foreground",
                  )}
                >
                  {correlation > 0.3 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : correlation < -0.3 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
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
