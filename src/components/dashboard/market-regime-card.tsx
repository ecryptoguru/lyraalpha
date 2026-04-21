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
      dotBg: string;
    }
  > = {
    STRONG_RISK_ON: {
      icon: Zap,
      color: "text-success",
      bg: "bg-success/5",
      border: "border-success/30",
      label: "Strong Risk On",
      gradient: "from-success/20 via-success/5 to-transparent",
      dotBg: "bg-success",
    },
    RISK_ON: {
      icon: Sun,
      color: "text-success",
      bg: "bg-success/5",
      border: "border-success/30",
      label: "Risk On",
      gradient: "from-success/20 via-success/5 to-transparent",
      dotBg: "bg-success",
    },
    NEUTRAL: {
      icon: Minus,
      color: "text-muted-foreground",
      bg: "bg-muted/5",
      border: "border-muted/30",
      label: "Neutral",
      gradient: "from-muted/20 via-muted/5 to-transparent",
      dotBg: "bg-muted-foreground",
    },
    DEFENSIVE: {
      icon: CloudFog,
      color: "text-[#FFD700]",
      bg: "bg-[#FFD700]/5",
      border: "border-[#FFD700]/30",
      label: "Defensive",
      gradient: "from-[#FFD700]/20 via-[#FFD700]/5 to-transparent",
      dotBg: "bg-[#FFD700]",
    },
    RISK_OFF: {
      icon: CloudRain,
      color: "text-danger",
      bg: "bg-danger/5",
      border: "border-danger/30",
      label: "Risk Off",
      gradient: "from-danger/20 via-danger/5 to-transparent",
      dotBg: "bg-danger",
    },
  };

  const {
    icon: Icon,
    color,
    bg,
    border,
    label,
    gradient,
    dotBg,
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
                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotBg)}></span>
                    <span className={cn("relative inline-flex rounded-full h-2 w-2", dotBg)}></span>
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
                    <span className={cn("text-lg font-mono font-bold", breadth > 50 ? "text-success" : "text-danger")}>{breadth}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/60 dark:bg-foreground/50 rounded-full overflow-hidden">
                    <div 
                        className={cn("h-full transition-all duration-1000 ease-out", breadth > 50 ? "bg-success" : "bg-danger")}
                        style={{ width: `${breadth}%` }}
                    />
                </div>
            </div>

             {/* Volatility Gauge */}
             <div className="bg-card/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Volatility (VIX)</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">{volatility}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/60 dark:bg-foreground/50 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-cyan-400 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(volatility, 100)}%` }}
                    />
                </div>
            </div>

            {/* Cross-Sector Correlation Gauge */}
            {crossSectorCorrelation && (
              <div className="col-span-2 bg-card/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3 w-3 text-info" />
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
                          crossSectorCorrelation.regime === "MACRO_DRIVEN" ? "text-danger bg-danger/10 border-danger/20"
                            : crossSectorCorrelation.regime === "TRANSITIONING" ? "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
                            : "text-info bg-info/10 border-info/20"
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
                        crossSectorCorrelation.trend === "RISING" ? "text-danger" : "text-success"
                      )}>
                        {crossSectorCorrelation.trend === "RISING" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-mono font-bold text-info cursor-help">
                        ρ {crossSectorCorrelation.avgCorrelation.toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      Average Pearson correlation (ρ) between sector return series. Range: -1 to +1. Above 0.6 = macro-driven. Below 0.35 = sector-specific. Between = transitional.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="h-1.5 w-full bg-muted/60 dark:bg-foreground/50 rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000 ease-out",
                      crossSectorCorrelation.avgCorrelation > 0.6 ? "bg-danger" : crossSectorCorrelation.avgCorrelation > 0.35 ? "bg-cyan-400" : "bg-info"
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
