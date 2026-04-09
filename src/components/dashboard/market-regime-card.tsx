import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CloudRain, Sun, Zap, CloudFog, Minus, Activity, GitBranch, Info } from "lucide-react";
import { RegimeState } from "@/lib/engines/market-regime";
import { CrossSectorCorrelation } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

interface MarketRegimeCardProps {
  state: RegimeState;
  breadth: number;
  volatility: number;
  context: string;
  crossSectorCorrelation?: CrossSectorCorrelation;
}

export function MarketRegimeCard({
  state,
  breadth,
  volatility,
  context,
  crossSectorCorrelation,
}: MarketRegimeCardProps) {
  // Map State to Config
  const config: Record<
    string,
    {
      icon: React.ComponentType<{ className?: string }>;
      color: string;
      bg: string;
      border: string;
      label: string;
      gradient: string;
    }
  > = {
    STRONG_RISK_ON: {
      icon: Zap,
      color: "text-emerald-400",
      bg: "bg-emerald-400/5",
      border: "border-emerald-500/30",
      label: "Strong Risk On",
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    },
    RISK_ON: {
      icon: Sun,
      color: "text-green-400",
      bg: "bg-green-400/5",
      border: "border-green-500/30",
      label: "Risk On",
      gradient: "from-green-500/20 via-green-500/5 to-transparent",
    },
    NEUTRAL: {
      icon: Minus,
      color: "text-slate-400",
      bg: "bg-slate-400/5",
      border: "border-slate-500/30",
      label: "Neutral",
      gradient: "from-slate-500/20 via-slate-500/5 to-transparent",
    },
    DEFENSIVE: {
      icon: CloudFog,
      color: "text-amber-400",
      bg: "bg-amber-400/5",
      border: "border-amber-500/30",
      label: "Defensive",
      gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
    },
    RISK_OFF: {
      icon: CloudRain,
      color: "text-rose-400",
      bg: "bg-rose-400/5",
      border: "border-rose-500/30",
      label: "Risk Off",
      gradient: "from-rose-500/20 via-rose-500/5 to-transparent",
    },
  };

  const {
    icon: Icon,
    color,
    bg,
    border,
    label,
    gradient,
  } = config[state] || config.NEUTRAL;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border h-full transition-all duration-500 group",
        border,
        "bg-card/40 backdrop-blur-xl"
      )}
    >
      {/* Background Gradient Animation */}
      <div className={cn("absolute inset-0 bg-linear-to-br opacity-70 group-hover:opacity-80 transition-opacity duration-1000", gradient)} />
      
      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 pointer-events-none mix-blend-overlay" />

      <CardContent className="relative z-10 p-6 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-2xl border backdrop-blur-2xl shadow-lg", bg, border)}>
                <Icon className={cn("h-6 w-6", color)} />
              </div>
              <div>
                 <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-0.5">
                  Market Regime
                </h2>
                <div className={cn("text-2xl font-bold uppercase tracking-tight items-center flex gap-2", color)}>
                  {label}
                  <span className="relative flex h-2 w-2">
                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color.replace('text-', 'bg-'))}></span>
                    <span className={cn("relative inline-flex rounded-full h-2 w-2", color.replace('text-', 'bg-'))}></span>
                  </span>
                </div>
              </div>
            </div>
            <Activity className={cn("h-12 w-12 opacity-10 stroke-1", color)} />
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed font-light border-l-2 border-primary/20 pl-4 py-1 max-w-xl">
            {context}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
            {/* Breadth Gauge */}
            <div className="bg-card/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Breadth</span>
                    <span className={cn("text-lg font-mono font-bold", breadth > 50 ? "text-emerald-400" : "text-rose-400")}>{breadth}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/60 dark:bg-slate-800/50 rounded-full overflow-hidden">
                    <div 
                        className={cn("h-full transition-all duration-1000 ease-out", breadth > 50 ? "bg-emerald-500" : "bg-rose-500")}
                        style={{ width: `${breadth}%` }}
                    />
                </div>
            </div>

             {/* Volatility Gauge */}
             <div className="bg-card/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Volatility (VIX)</span>
                    <span className="text-lg font-mono font-bold text-amber-400">{volatility}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/60 dark:bg-slate-800/50 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-amber-500 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(volatility, 100)}%` }}
                    />
                </div>
            </div>

            {/* Cross-Sector Correlation Gauge */}
            {crossSectorCorrelation && (
              <div className="col-span-2 bg-card/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3 w-3 text-cyan-400" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-help flex items-center gap-1">
                          Sector Correlation
                          <Info className="h-2.5 w-2.5 opacity-40" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        Measures how similarly different market sectors are moving. Computed from 60-day daily return correlations across all sectors. High correlation = macro-driven market (sectors move together). Low = sector-specific dynamics (individual asset selection matters more).
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-xl border cursor-help",
                          crossSectorCorrelation.regime === "MACRO_DRIVEN" ? "text-rose-400 bg-rose-400/10 border-rose-400/20"
                            : crossSectorCorrelation.regime === "TRANSITIONING" ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                            : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
                        )}>
                          {crossSectorCorrelation.regime.replace("_", " ")}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        {crossSectorCorrelation.regime === "MACRO_DRIVEN"
                          ? "Macro Driven: Sectors are highly correlated — broad market forces (rates, geopolitics) dominate. Diversification across sectors provides less protection."
                          : crossSectorCorrelation.regime === "TRANSITIONING"
                          ? "Transitioning: Sector correlations are shifting. The market may be moving from sector-specific to macro-driven (or vice versa). Monitor closely."
                          : "Sector Specific: Sectors are moving independently — individual sector and asset selection is the primary alpha driver."}
                      </TooltipContent>
                    </Tooltip>
                    {crossSectorCorrelation.trend !== "STABLE" && (
                      <span className={cn(
                        "text-[8px] font-bold uppercase",
                        crossSectorCorrelation.trend === "RISING" ? "text-rose-400" : "text-emerald-400"
                      )}>
                        {crossSectorCorrelation.trend === "RISING" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-mono font-bold text-cyan-400 cursor-help">
                        ρ {crossSectorCorrelation.avgCorrelation.toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      Average Pearson correlation (ρ) between sector return series. Range: -1 to +1. Above 0.6 = macro-driven. Below 0.35 = sector-specific. Between = transitional.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="h-1.5 w-full bg-muted/60 dark:bg-slate-800/50 rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000 ease-out",
                      crossSectorCorrelation.avgCorrelation > 0.6 ? "bg-rose-500" : crossSectorCorrelation.avgCorrelation > 0.35 ? "bg-amber-500" : "bg-cyan-500"
                    )}
                    style={{ width: `${Math.min(crossSectorCorrelation.avgCorrelation * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground font-mono leading-relaxed">
                  {crossSectorCorrelation.guidance}
                </p>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
