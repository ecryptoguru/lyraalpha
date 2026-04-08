import { ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MetricCardProps {
  label: string;
  value: string;
  trend: number;
  trendLabel?: string;
  tooltip?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  sparklineData?: number[]; // Optional data for sparkline
}

export function MetricCard({
  label,
  value,
  trend,
  trendLabel = "vs last week",
  tooltip,
  icon: Icon,
  className,
  sparklineData = [40, 35, 55, 45, 60, 50, 65, 80], // Default dummy data
}: MetricCardProps) {
  const isPositive = trend > 0;
  const isNeutral = trend === 0;

  // Generate SVG path for sparkline
  const min = Math.min(...sparklineData);
  const max = Math.max(...sparklineData);
  const range = max - min || 1;
  const coordinates = sparklineData.map((d, i) => {
    const x = (i / (sparklineData.length - 1)) * 100;
    const y = 100 - ((d - min) / range) * 100;
    return { x, y };
  });
  const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = coordinates.length > 0
    ? `M ${coordinates[0].x},100 L ${coordinates.map((point) => `${point.x},${point.y}`).join(" L ")} L ${coordinates[coordinates.length - 1].x},100 Z`
    : "";

  return (
    <div className={cn(
      "relative group overflow-hidden rounded-2xl border bg-card/40 backdrop-blur-xl p-5 transition-all duration-500 hover:bg-card/60 hover:shadow-2xl",
      isPositive ? "border-border/50 hover:border-emerald-400/40 hover:shadow-emerald-400/10" : 
      isNeutral ? "border-border/50 hover:border-primary/40 hover:shadow-primary/10" : 
      "border-border/50 hover:border-rose-400/40 hover:shadow-rose-400/10",
      className
    )}>
      {/* Background Gradient */}
      <div className={cn(
        "absolute inset-0 bg-linear-to-br via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none",
        isPositive ? "from-emerald-400/5" :
        isNeutral ? "from-primary/5" :
        "from-rose-400/5"
      )} />

      <div className="relative z-10 flex justify-between items-start mb-4">
        <div>
          <div className="mb-1 flex items-center gap-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
              {label}
            </p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <h3 className="text-3xl font-bold tracking-tight text-foreground font-mono">
            {value}
          </h3>
        </div>
        {Icon && (
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform duration-500">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <div
            className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-2xl w-fit ${
              isPositive
                ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20"
                : isNeutral
                  ? "text-muted-foreground bg-muted/20 border border-border"
                  : "text-rose-400 bg-rose-400/10 border border-rose-400/20"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : isNeutral ? (
              <Minus className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            )}
            {Math.abs(trend)}%
          </div>
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider pl-0.5">
            {trendLabel}
          </span>
        </div>

        {/* Sparkline Visualization */}
        <div className="h-10 w-24 opacity-70 group-hover:opacity-100 transition-opacity duration-500">
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible preserve-3d">
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              className={cn(
                "transition-colors duration-500",
                isPositive ? "text-emerald-400" : isNeutral ? "text-muted-foreground" : "text-rose-400"
              )}
            />
            {/* Gradient fill */}
             <path
              d={areaPath}
              fill="currentColor"
              className={cn(
                "opacity-10 transition-colors duration-500",
                 isPositive ? "text-emerald-400" : isNeutral ? "text-muted-foreground" : "text-rose-400"
              )}
             />
          </svg>
        </div>
      </div>
    </div>
  );
}
