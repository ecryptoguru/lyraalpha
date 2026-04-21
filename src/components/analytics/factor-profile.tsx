"use client";

import { cn } from "@/lib/utils";

interface FactorProfileProps {
  data: {
    value: number;
    growth: number;
    momentum: number;
    volatility: number;
  };
  metadata?: Record<string, unknown> | null;
  className?: string;
}

export function FactorProfile({ data, className }: FactorProfileProps) {
  const chartData = [
    { factor: "Value", value: Math.round(data.value), color: "bg-warning" },
    { factor: "Growth", value: Math.round(data.growth), color: "bg-success" },
    { factor: "Momentum", value: Math.round(data.momentum), color: "bg-info" },
    { factor: "Volatility", value: Math.round(data.volatility), color: "bg-warning" },
  ];

  return (
    <div
      className={cn(
        "bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl p-6 rounded-3xl border-primary/20 bg-primary/5 h-full flex flex-col justify-between",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] premium-gradient-text">
          Factor DNA
        </h3>
        <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[8px] font-bold text-primary uppercase tracking-widest">
          Institutional Model
        </div>
      </div>

      <div className="space-y-7 my-auto">
        {chartData.map((d) => (
          <div key={d.factor} className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                {d.factor}
              </span>
              <span className="text-xs font-mono font-bold">{d.value}</span>
            </div>
            <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out",
                  d.color,
                )}
                style={{ width: `${d.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-[9px] text-muted-foreground leading-relaxed text-center">
          Factor exposure calculated daily based on 12-month trailing data
          points via Lyra Engine.
        </p>
      </div>
    </div>
  );
}
