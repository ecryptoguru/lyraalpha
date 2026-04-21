"use client";

import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity, ShieldCheck, Waves, BarChart3 } from "lucide-react";

interface MarketContextBarProps {
  context: MarketContextSnapshot;
  className?: string;
}

function getStatusColor(level: string) {
  const positive = ["STRONG_RISK_ON","RISK_ON","SUPPRESSED","STABLE","VERY_BROAD","BROAD","VERY_STRONG","STRONG","RISK_EMBRACING","RISK_SEEKING"];
  const neutral  = ["NEUTRAL","NORMAL","MIXED","ADEQUATE","BALANCED"];
  const warning  = ["DEFENSIVE","ELEVATED","WEAK","THIN","CAUTIOUS"];
  const critical = ["RISK_OFF","STRESS","NARROW","FRAGILE","RISK_AVERSION"];
  if (positive.includes(level)) return "text-success bg-success/10 border-success/20";
  if (neutral.includes(level))  return "text-muted-foreground bg-muted/10 border-border/20";
  if (warning.includes(level))  return "text-warning bg-warning/10 border-warning/20";
  if (critical.includes(level)) return "text-danger bg-danger/10 border-danger/20";
  return "text-muted-foreground bg-muted/10 border-border/20";
}

function fmt(label: string) {
  if (!label) return "—";
  return label.replace(/_/g, " ");
}

export function MarketContextBar({ context, className }: MarketContextBarProps) {
  const metrics = [
    { icon: <ShieldCheck className="h-3 w-3 md:h-3.5 md:w-3.5" />, label: "Regime",     value: fmt(context.regime.label),     color: getStatusColor(context.regime.label),     tooltip: context.regime.drivers.join(". ") },
    { icon: <Waves        className="h-3 w-3 md:h-3.5 md:w-3.5" />, label: "Volatility", value: fmt(context.volatility.label), color: getStatusColor(context.volatility.label), tooltip: context.volatility.drivers.join(". ") },
    { icon: <ShieldCheck  className="h-3 w-3 md:h-3.5 md:w-3.5" />, label: "Risk",       value: fmt(context.risk.label),       color: getStatusColor(context.risk.label),       tooltip: context.risk.drivers.join(". ") },
    { icon: <BarChart3    className="h-3 w-3 md:h-3.5 md:w-3.5" />, label: "Breadth",    value: fmt(context.breadth.label),    color: getStatusColor(context.breadth.label) },
    {
      icon: <Activity className="h-3 w-3 md:h-3.5 md:w-3.5" />,
      label: "Liquidity",
      value: context.liquidity ? fmt(context.liquidity.label) : "—",
      color: context.liquidity ? getStatusColor(context.liquidity.label) : "text-muted-foreground bg-muted/10 border-muted/20",
    },
  ];

  return (
    <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl overflow-hidden", className)} suppressHydrationWarning>
      <TooltipProvider>
        {/* ── Mobile: Auto-scrolling marquee ── */}
        <div className="flex md:hidden relative overflow-hidden bg-transparent select-none py-2.5 w-full">
          <div className="flex-1 overflow-hidden relative border-x border-border/40">
            <div className="absolute inset-y-0 left-0 w-8 bg-linear-to-r from-card/90 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 bg-linear-to-l from-card/90 to-transparent z-10 pointer-events-none" />
            
            <div className="flex animate-marquee hover:[animation-play-state:paused] w-max items-center">
            {/* First Copy */}
            <div className="flex items-center gap-2 shrink-0 pr-4">
              <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
              {metrics.map(({ icon, label, value, color }) => (
                <div key={`${label}-1`} className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 cursor-help whitespace-nowrap",
                  color,
                )}>
                  {icon}
                  <span className="uppercase tracking-wide">{value}</span>
                </div>
              ))}
            </div>
            
            {/* Second Copy */}
            <div className="flex items-center gap-2 shrink-0 pr-4">
              <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
              {metrics.map(({ icon, label, value, color }) => (
                <div key={`${label}-2`} className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 cursor-help whitespace-nowrap",
                  color,
                )}>
                  {icon}
                  <span className="uppercase tracking-wide">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>

        {/* ── Desktop: thin but visible single line ── */}
        <div className="hidden md:flex items-center gap-x-5 px-5 py-3">
          <div className="flex items-center gap-2 pr-5 border-r border-white/5 shrink-0">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Market Context
            </span>
          </div>

          <div className="flex items-center gap-x-4 flex-1 overflow-hidden">
            {metrics.map(({ icon, label, value, color, tooltip }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 group cursor-help shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider hidden lg:block">
                      {label}
                    </span>
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all group-hover:scale-105",
                      color,
                    )}>
                      {icon}
                      <span className="uppercase tracking-wide">{value}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-2.5 max-w-[180px] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Last updated — xl only */}
            <div className="ml-auto hidden xl:flex items-center gap-1.5 shrink-0" suppressHydrationWarning>
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {context.lastUpdated
                  ? new Date(context.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Updated"}
              </span>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
