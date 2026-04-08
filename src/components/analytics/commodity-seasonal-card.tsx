"use client";

import { cn } from "@/lib/utils";
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SeasonalPattern } from "@/lib/engines/commodity-intelligence";

interface CommoditySeasonalCardProps {
  seasonality: SeasonalPattern;
  className?: string;
}

const MONTH_ORDER = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_SHORT: Record<string, string> = {
  jan: "J", feb: "F", mar: "M", apr: "A", may: "M", jun: "J",
  jul: "J", aug: "A", sep: "S", oct: "O", nov: "N", dec: "D",
};

function getReturnColor(ret: number): string {
  if (ret > 2) return "bg-emerald-500";
  if (ret > 0.5) return "bg-emerald-400/70";
  if (ret > -0.5) return "bg-zinc-400/40";
  if (ret > -2) return "bg-red-400/70";
  return "bg-red-500";
}

function getReturnTextColor(ret: number): string {
  if (ret > 0.5) return "text-emerald-500";
  if (ret < -0.5) return "text-red-500";
  return "text-muted-foreground";
}

function SignalBadge({ signal }: { signal: "strong" | "weak" | "neutral" }) {
  const config = {
    strong: { label: "Historically Strong", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: TrendingUp },
    weak: { label: "Historically Weak", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: TrendingDown },
    neutral: { label: "Neutral", color: "text-muted-foreground bg-muted/20 border-border/30", icon: Minus },
  }[signal];
  const Icon = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider", config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
}

export function CommoditySeasonalCard({ seasonality, className }: CommoditySeasonalCardProps) {
  const currentMonthIdx = new Date().getMonth();
  const maxAbs = Math.max(...MONTH_ORDER.map(m => Math.abs(seasonality.monthlyReturns[m] || 0)), 1);

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Seasonal Patterns</h3>
        </div>
        <SignalBadge signal={seasonality.currentMonthSignal} />
      </div>

      {/* Monthly Return Heatmap */}
      <div className="space-y-1.5">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Monthly Return Heatmap (historical avg %)</p>
        <div className="grid grid-cols-12 gap-1">
          {MONTH_ORDER.map((m, idx) => {
            const ret = seasonality.monthlyReturns[m] || 0;
            const isCurrentMonth = idx === currentMonthIdx;
            return (
              <div key={m} className="flex flex-col items-center gap-0.5">
                <span className={cn(
                  "text-[8px] font-bold uppercase",
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                )}>
                  {MONTH_SHORT[m]}
                </span>
                <div
                  className={cn(
                    "w-full aspect-square rounded-sm flex items-center justify-center transition-all",
                    getReturnColor(ret),
                    isCurrentMonth && "ring-1 ring-foreground/40 ring-offset-1 ring-offset-background",
                  )}
                  title={`${m.toUpperCase()}: ${ret > 0 ? "+" : ""}${ret.toFixed(1)}%`}
                >
                  <span className="text-[7px] font-bold text-white/90">
                    {ret > 0 ? "+" : ""}{ret.toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bar chart representation */}
      <div className="space-y-1">
        <div className="flex items-end justify-between h-16 gap-px">
          {MONTH_ORDER.map((m, idx) => {
            const ret = seasonality.monthlyReturns[m] || 0;
            const height = maxAbs > 0 ? (Math.abs(ret) / maxAbs) * 100 : 0;
            const isCurrentMonth = idx === currentMonthIdx;
            return (
              <div key={m} className="flex-1 flex flex-col items-center justify-end h-full relative">
                {ret >= 0 ? (
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all",
                      isCurrentMonth ? "bg-emerald-500" : "bg-emerald-500/50",
                    )}
                    style={{ height: `${height}%`, minHeight: ret > 0 ? "2px" : "0px" }}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>
            );
          })}
        </div>
        <div className="w-full h-px bg-muted-foreground/20" />
        <div className="flex items-start justify-between h-16 gap-px">
          {MONTH_ORDER.map((m, idx) => {
            const ret = seasonality.monthlyReturns[m] || 0;
            const height = maxAbs > 0 ? (Math.abs(ret) / maxAbs) * 100 : 0;
            const isCurrentMonth = idx === currentMonthIdx;
            return (
              <div key={m} className="flex-1 flex flex-col items-center h-full">
                {ret < 0 ? (
                  <div
                    className={cn(
                      "w-full rounded-b-sm transition-all",
                      isCurrentMonth ? "bg-red-500" : "bg-red-500/50",
                    )}
                    style={{ height: `${height}%`, minHeight: "2px" }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-[9px] text-muted-foreground">Best:</span>
            <span className="text-[9px] font-bold text-emerald-500">{seasonality.strongestMonth}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span className="text-[9px] text-muted-foreground">Worst:</span>
            <span className="text-[9px] font-bold text-red-500">{seasonality.weakestMonth}</span>
          </div>
        </div>
        <span className={cn("text-[10px] font-bold", getReturnTextColor(seasonality.currentMonthAvgReturn))}>
          This month: {seasonality.currentMonthAvgReturn > 0 ? "+" : ""}{seasonality.currentMonthAvgReturn.toFixed(1)}%
        </span>
      </div>

      <p className="text-[8px] text-muted-foreground/40 italic">
        Past seasonal patterns do not guarantee future results. Based on available price history.
      </p>
    </div>
  );
}
