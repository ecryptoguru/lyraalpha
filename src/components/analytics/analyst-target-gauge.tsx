"use client";

import { cn, formatPrice as globalFormatPrice, type RegionFormat } from "@/lib/utils";
import { Target, TrendingUp, TrendingDown, Users } from "lucide-react";

interface AnalystTargetGaugeProps {
  currentPrice: number;
  targetMeanPrice?: number | null;
  targetHighPrice?: number | null;
  targetLowPrice?: number | null;
  numberOfAnalysts?: number | null;
  currencySymbol?: string;
  region?: RegionFormat;
  className?: string;
}

export function AnalystTargetGauge({
  currentPrice,
  targetMeanPrice,
  targetHighPrice,
  targetLowPrice,
  numberOfAnalysts,
  currencySymbol = "$",
  region = "US",
  className,
}: AnalystTargetGaugeProps) {
  // If no analyst data, show placeholder message
  if (!targetMeanPrice && !targetHighPrice && !targetLowPrice) {
    return (
      <div className={cn("rounded-2xl border border-white/5 bg-card/60 shadow-xl backdrop-blur-xl p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground">Analyst Targets</h3>
        </div>
        <p className="text-sm text-muted-foreground">No analyst coverage available</p>
      </div>
    );
  }

  const low = targetLowPrice || targetMeanPrice || 0;
  const high = targetHighPrice || targetMeanPrice || 0;
  const mean = targetMeanPrice || 0;
  
  // Calculate position of current price and mean on the gauge
  const range = high - low;
  const currentPosition = range > 0 ? Math.min(100, Math.max(0, ((currentPrice - low) / range) * 100)) : 50;
  const meanPosition = range > 0 ? Math.min(100, Math.max(0, ((mean - low) / range) * 100)) : 50;
  
  // Calculate upside/downside potential
  const upsidePercent = mean > 0 ? ((mean - currentPrice) / currentPrice) * 100 : 0;
  const isUpside = upsidePercent > 0;

  const fmtPrice = (price: number) => {
    return globalFormatPrice(price, { symbol: currencySymbol, region, decimals: price >= 1000 ? 0 : 2 });
  };

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 shadow-xl backdrop-blur-xl", className)}>
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            Analyst Targets
          </h3>
          {numberOfAnalysts && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{numberOfAnalysts} analysts</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Gauge visualization */}
        <div className="relative mb-6">
          {/* Track */}
          <div className="h-2 rounded-full bg-linear-to-r from-danger/30 via-warning/30 to-success/30" />
          
          {/* Current price marker */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-warning border-2 border-background shadow-lg transition-all"
            style={{ left: `calc(${currentPosition}% - 6px)` }}
          />
          
          {/* Mean target marker */}
          <div 
            className="absolute -top-1 w-0.5 h-4 bg-warning"
            style={{ left: `${meanPosition}%` }}
          />
        </div>

        {/* Price labels */}
        <div className="flex justify-between text-xs mb-4">
          <div className="text-center">
            <div className="text-muted-foreground">Low</div>
            <div className="font-medium text-danger">{fmtPrice(low)}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Target</div>
            <div className="font-medium text-cyan-400">{fmtPrice(mean)}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">High</div>
            <div className="font-medium text-success">{fmtPrice(high)}</div>
          </div>
        </div>

        {/* Current price & potential */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <div className="text-xs text-muted-foreground">Current Price</div>
            <div className="text-lg font-semibold">{fmtPrice(currentPrice)}</div>
          </div>
          <div className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium",
            isUpside ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}>
            {isUpside ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{isUpside ? "+" : ""}{upsidePercent.toFixed(1)}% to target</span>
          </div>
        </div>
      </div>
    </div>
  );
}
