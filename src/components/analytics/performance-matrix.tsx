"use client";

import { cn, formatPrice, type RegionFormat } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
interface PerformanceMatrixProps {
  performance?: {
    returns: {
      "1D": number | null;
      "1W": number | null;
      "1M": number | null;
      "3M": number | null;
      "6M": number | null;
      YTD: number | null;
      "1Y": number | null;
    };
    range52W: {
      high: number | null;
      low: number | null;
      currentPosition: number | null;
      distanceFromHigh: number | null;
      distanceFromLow: number | null;
    };
  };
  volatility?: {
    score?: number;
    label?: string;
  } | number | string | null;
  currencySymbol?: string;
  region?: RegionFormat;
  className?: string;
}

const formatPercent = (val: number | null): string => {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
};

const hasDisplayNumber = (value: number | null | undefined): value is number => {
  return value != null && Number.isFinite(value) && value !== 0;
};

const ReturnBadge = ({ label, value }: { label: string; value: number | null }) => {
  const isPositive = value !== null && value > 0;
  const isNegative = value !== null && value < 0;

  return (
    <div className="flex flex-col gap-1 p-3 rounded-2xl bg-card/60 backdrop-blur-2xl shadow-xl border border-white/5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-sm font-bold",
          isPositive && "text-emerald-500",
          isNegative && "text-red-500",
          !isPositive && !isNegative && "text-muted-foreground"
        )}>
          {formatPercent(value)}
        </span>
        {isPositive && <TrendingUp className="w-3 h-3 text-emerald-500" />}
        {isNegative && <TrendingDown className="w-3 h-3 text-red-500" />}
      </div>
    </div>
  );
};

export function PerformanceMatrix({ performance, volatility, currencySymbol = "$", region = "US", className }: PerformanceMatrixProps) {
  if (!performance) return null;

  const { returns, range52W } = performance;
  const returnItems = [
    { label: "1 Day", value: returns["1D"] },
    { label: "1 Week", value: returns["1W"] },
    { label: "1 Month", value: returns["1M"] },
    { label: "3 Months", value: returns["3M"] },
    { label: "6 Months", value: returns["6M"] },
    { label: "YTD", value: returns.YTD },
    { label: "1 Year", value: returns["1Y"] },
  ].filter((item) => hasDisplayNumber(item.value));

  const hasVolatility =
    (typeof volatility === "string" && volatility.trim().length > 0) ||
    (typeof volatility === "number" && Number.isFinite(volatility) && volatility !== 0) ||
    (typeof volatility === "object" && volatility != null && (Boolean(volatility.label) || hasDisplayNumber(volatility.score)));

  const hasRangeData = [
    range52W.low,
    range52W.high,
    range52W.currentPosition,
    range52W.distanceFromHigh,
    range52W.distanceFromLow,
  ].some((value) => hasDisplayNumber(value));

  if (returnItems.length === 0 && !hasVolatility && !hasRangeData) return null;

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl", className)}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Performance Matrix
        </h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Returns</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Returns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {returnItems.map((item) => (
            <ReturnBadge key={item.label} label={item.label} value={item.value} />
          ))}
          {hasVolatility ? (
            <div className={cn(
            "flex flex-col gap-1 p-3 rounded-2xl border",
            (volatility === "Low" || (typeof volatility === 'object' && volatility?.label === "Low")) ? "bg-emerald-500/5 border-emerald-500/10" : 
            (volatility === "High" || (typeof volatility === 'object' && volatility?.label === "High")) ? "bg-red-500/5 border-red-500/10" : 
            "bg-amber-500/5 border-amber-500/10"
          )}>
            <span className={cn(
              "text-[10px] uppercase tracking-wider font-medium",
              (volatility === "Low" || (typeof volatility === 'object' && volatility?.label === "Low")) ? "text-emerald-500/70" : 
              (volatility === "High" || (typeof volatility === 'object' && volatility?.label === "High")) ? "text-red-500/70" : 
              "text-amber-500/70"
            )}>
              Volatility
            </span>
            <span className={cn(
              "text-sm font-bold",
              (volatility === "Low" || (typeof volatility === 'object' && volatility?.label === "Low")) ? "text-emerald-500" : 
              (volatility === "High" || (typeof volatility === 'object' && volatility?.label === "High")) ? "text-red-500" : 
              "text-amber-500"
            )}>
              {typeof volatility === 'object' ? (volatility?.label || "Medium") : (volatility || "Medium")}
            </span>
          </div>
          ) : null}
        </div>

        {/* 52W Range Analysis */}
        {hasRangeData ? (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              52-Week Range Analysis
            </span>
          </div>

          <div className="space-y-4">
            {/* Range Bar */}
            <div className="relative pt-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>52W Low: {range52W.low != null ? formatPrice(range52W.low, { symbol: currencySymbol, region }) : '—'}</span>
                <span>52W High: {range52W.high != null ? formatPrice(range52W.high, { symbol: currencySymbol, region }) : '—'}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-amber-500/30 rounded-full"
                  style={{ width: `${range52W.currentPosition}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-500 border-2 border-background rounded-full shadow-lg transition-all"
                  style={{ left: `calc(${range52W.currentPosition}% - 6px)` }}
                />
              </div>
            </div>

            {/* Distance Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl bg-red-500/5 border border-red-500/10 min-w-0">
                <ArrowDownCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none mb-1 truncate">From 52W High</span>
                  <span className="text-xs sm:text-sm font-bold text-red-500 truncate">{formatPercent(range52W.distanceFromHigh)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 min-w-0">
                <ArrowUpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none mb-1 truncate">From 52W Low</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-500 truncate">{formatPercent(range52W.distanceFromLow)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
