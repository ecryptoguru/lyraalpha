"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn, formatCompactNumber, formatPrice, getCurrencyConfig } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { WatchlistStar } from "@/components/dashboard/watchlist-star";
import { getFriendlySymbol, velocityDelta } from "@/lib/format-utils";
import { AssetSignals } from "@/lib/engines/compatibility";
import { ScoreTooltip } from "@/components/ui/score-tooltip";
import { ScoreVelocityBadge } from "@/components/ui/score-velocity-badge";

interface MarketAssetCardProps {
  symbol: string;
  name?: string;
  type?: string;
  price: number;
  changePercent: number;
  marketCap: number | null;
  peRatio: number | null;
  oneYearChange: number | null;
  signals: AssetSignals;
  metadata?: Record<string, unknown> | null;
  morningstarRating?: string | null;
  expenseRatio?: number | null;
  nav?: number | null;
  
  category?: string | null;
  currency?: string | null;
  className?: string;
  compatibilityScore?: number | null;
  compatibilityLabel?: string | null;
  sector?: string | null;
  dividendYield?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  fundHouse?: string | null;
  schemeType?: string | null;
  beta?: number | null;
  scoreDynamics?: Record<string, unknown> | null;
}

interface MarketAssetMetadata {
  openInterest?: number;
  expireDate?: string;
  exchangeName?: string;
  volume24Hr?: number;
  circulatingSupply?: number;
}

interface MetricCell {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  border?: boolean;
  suppressHydrationWarning?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
};

export function MarketAssetCard({
  symbol,
  name,
  type = "EQUITY",
  price,
  changePercent,
  marketCap,
  signals,
  metadata,
  currency,
  className,
  compatibilityScore,
  compatibilityLabel,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  scoreDynamics,
}: MarketAssetCardProps) {
  const isUp = changePercent >= 0;

  const currencyConfig = useMemo(() => getCurrencyConfig(currency || "USD"), [currency]);
  const currencySymbol = currencyConfig.symbol;
  const currencyRegion = currencyConfig.region;
  const safePrice = price || 0;
  const safeChangePercent = changePercent || 0;
  const meta = (metadata as MarketAssetMetadata | undefined) ?? undefined;

  const displayName = useMemo(() => {
    // Platform is crypto-only
    return name || symbol;
  }, [name, symbol]);

  const compatibilityBadgeClass = useMemo(() => {
    if (compatibilityScore == null || compatibilityScore <= 0) return null;
    if (compatibilityScore >= 75) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (compatibilityScore >= 60) return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    if (compatibilityScore >= 45) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  }, [compatibilityScore]);

  const rangePosition = useMemo(() => {
    if (
      fiftyTwoWeekLow == null ||
      fiftyTwoWeekHigh == null ||
      fiftyTwoWeekHigh <= fiftyTwoWeekLow ||
      safePrice <= 0
    ) {
      return null;
    }

    const raw = ((safePrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;
    const percentage = Math.min(100, Math.max(0, raw));
    const barClass =
      percentage > 70 ? "bg-emerald-500/40" : percentage > 30 ? "bg-sky-500/40" : "bg-rose-500/40";

    return { percentage, barClass };
  }, [fiftyTwoWeekHigh, fiftyTwoWeekLow, safePrice]);

  const signalItems = useMemo(() => ([
    { label: "Trend", score: signals.trend, color: getScoreColor(signals.trend), scoreType: "TREND" as const, side: "top" as const },
    { label: "Momentum", score: signals.momentum, color: getScoreColor(signals.momentum), scoreType: "MOMENTUM" as const, side: "top" as const },
    { label: "Volatility", score: signals.volatility, color: getScoreColor(100 - signals.volatility), scoreType: "VOLATILITY" as const, side: "top" as const },
    { label: "Sentiment", score: signals.sentiment, color: getScoreColor(signals.sentiment), scoreType: "SENTIMENT" as const, side: "bottom" as const },
    { label: "Liquidity", score: signals.liquidity, color: getScoreColor(signals.liquidity), scoreType: "LIQUIDITY" as const, side: "bottom" as const },
    { label: "Trust", score: signals.trust, color: getScoreColor(signals.trust), scoreType: "TRUST" as const, side: "bottom" as const },
  ]), [signals]);

  const metricCells = useMemo<MetricCell[]>(() => {
    if (type === "CRYPTO" && meta?.openInterest) {
      return [
        {
          label: "Open Interest",
          value: Number(meta.openInterest || 0).toLocaleString(),
          suppressHydrationWarning: true,
        },
        {
          label: "Expiration",
          value: meta.expireDate
            ? new Date(meta.expireDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : "—",
          border: true,
          suppressHydrationWarning: true,
        },
        {
          label: "Exchange",
          value: meta.exchangeName?.replace(" ", "") || "—",
        },
      ];
    }

    // MF/ETF-specific stats removed — crypto-only platform

    // Platform is crypto-only
    return [
      {
        label: "Mkt Cap",
        value: formatCompactNumber(marketCap, { symbol: currencySymbol, region: currencyRegion }),
        suppressHydrationWarning: true,
      },
      {
        label: "24h Vol",
        value: meta?.volume24Hr
          ? formatCompactNumber(String(meta.volume24Hr), { symbol: currencySymbol, region: currencyRegion })
          : "—",
        border: true,
      },
      {
        label: "Circ Supply",
        value: meta?.circulatingSupply && typeof meta.circulatingSupply === "number" && meta.circulatingSupply > 0
          ? formatCompactNumber(meta.circulatingSupply, { isCurrency: false, region: currencyRegion })
          : "—",
      },
    ];
  }, [
    currencyRegion,
    currencySymbol,
    marketCap,
    meta,
    type,
  ]);

  return (
    <Link
      href={`/dashboard/assets/${symbol}`}
      className={cn("block group relative", className)}
      suppressHydrationWarning
    >
      {/* Glow shadow based on performance */}
      <div className={cn(
        "absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md",
        isUp ? "bg-emerald-400/20" : "bg-rose-400/20"
      )} />

      <div className={cn(
        "relative bg-card/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-4 md:p-5 transition-all duration-300 ease-out flex flex-col gap-4 md:gap-5 shadow-xl will-change-transform",
        isUp ? "group-hover:border-emerald-400/40 group-hover:-translate-y-1 group-hover:bg-emerald-400/5" : "group-hover:border-rose-400/40 group-hover:-translate-y-1 group-hover:bg-rose-400/5"
      )} suppressHydrationWarning>
        {/* Header: Symbol & Price */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-bold tracking-tighter premium-gradient-text uppercase truncate max-w-[calc(100vw-10rem)] sm:max-w-none">
                {getFriendlySymbol(symbol, type, name)}
              </span>
              <WatchlistStar symbol={symbol} size="sm" />
              <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="text-[8px] md:text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-80">
                {type}
              </span>
              <ScoreVelocityBadge
                trendDelta={velocityDelta(scoreDynamics, "trend")}
                momentumDelta={velocityDelta(scoreDynamics, "momentum")}
              />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground/80 line-clamp-1 h-4">
              {displayName}
            </p>
            {/* Platform is crypto-only — sector/fundHouse badges removed */}
          </div>

          <div className="text-right shrink-0">
            <div className="text-base md:text-lg font-bold tracking-tighter text-foreground font-mono tabular-nums" suppressHydrationWarning>
              {formatPrice(safePrice, { symbol: currencySymbol, region: currencyRegion })}
            </div>
            <div
              className={cn(
                "flex items-center justify-end gap-1 text-[10px] font-bold font-mono tabular-nums",
                isUp ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {isUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isUp ? "+" : ""}
              {safeChangePercent.toFixed(2)}%
            </div>
            {/* Compatibility Badge */}
            {compatibilityBadgeClass && compatibilityScore != null && compatibilityScore > 0 && (
              <div className={cn(
                "mt-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xl border inline-flex items-center gap-1 max-w-38 justify-end",
                compatibilityBadgeClass,
              )}>
                <span className="font-mono">{compatibilityScore}%</span>
                <span className="opacity-70 truncate">{compatibilityLabel || "Fit"}</span>
              </div>
            )}
          </div>
        </div>

        {/* 52W Position Bar */}
        {rangePosition && fiftyTwoWeekLow != null && fiftyTwoWeekHigh != null && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[8px] font-mono font-bold text-muted-foreground w-8 text-right shrink-0">
              {formatPrice(fiftyTwoWeekLow, { symbol: currencySymbol, region: currencyRegion, decimals: 0 })}
            </span>
            <div className="h-1.5 flex-1 bg-muted/30 rounded-full relative overflow-hidden">
              <div 
                className={cn(
                  "absolute h-full rounded-full",
                  rangePosition.barClass,
                )}
                style={{ width: `${rangePosition.percentage}%` }}
              />
              <div 
                className="absolute w-1.5 h-1.5 bg-foreground rounded-full top-1/2 -translate-y-1/2 shadow-sm"
                style={{ left: `calc(${rangePosition.percentage}% - 3px)` }}
              />
            </div>
            <span className="text-[8px] font-mono font-bold text-muted-foreground w-8 shrink-0">
              {formatPrice(fiftyTwoWeekHigh, { symbol: currencySymbol, region: currencyRegion, decimals: 0 })}
            </span>
          </div>
        )}

        {/* Intelligence Grid: Signals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 pt-2 border-t border-border/30">
          {signalItems.map((item) => (
            <ScoreTooltip key={item.label} scoreType={item.scoreType} value={item.score} side={item.side}>
              <div>
                <SignalItem label={item.label} score={item.score} color={item.color} />
              </div>
            </ScoreTooltip>
          ))}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border/10 bg-muted/10 -mx-5 px-5 py-4 rounded-b-3xl">
          {metricCells.map((cell) => (
            <div
              key={cell.label}
              className={cn("space-y-1", cell.border ? "border-x border-border/10 px-4" : "")}
            >
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                {cell.label}
              </p>
              <p
                className={cell.valueClassName ?? "text-[11px] font-bold tracking-tight text-foreground truncate"}
                suppressHydrationWarning={cell.suppressHydrationWarning}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function SignalItem({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const getProgressBarColor = (colorClass: string) => {
    if (colorClass.includes("emerald")) return "bg-emerald-400";
    if (colorClass.includes("amber")) return "bg-amber-400";
    if (colorClass.includes("rose")) return "bg-rose-400";
    return "bg-slate-400";
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <div className="h-1 flex-1 bg-muted/40 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-1000",
              getProgressBarColor(color)
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[10px] font-mono font-bold w-5 text-right",
            color,
          )}
        >
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}
