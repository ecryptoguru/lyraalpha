"use client";

import { cn, formatCompactNumber, type RegionFormat } from "@/lib/utils";
import { PieChart, Layers, TrendingUp } from "lucide-react";

interface Holding {
  symbol?: string | null;
  name?: string | null;
  weight?: number | null;
}

interface SectorWeight {
  sector: string;
  weight: number | null;
}

interface TopHoldingsData {
  holdings?: Holding[];
  sectorWeights?: SectorWeight[];
  equityHoldings?: {
    priceToEarnings?: number | null;
    priceToBook?: number | null;
    priceToSales?: number | null;
    medianMarketCap?: number | null;
    threeYearEarningsGrowth?: number | null;
  } | null;
  bondHoldings?: {
    maturity?: number | null;
    duration?: number | null;
  } | null;
}

interface FundPerformanceData {
  ytd?: number | null;
  oneYear?: number | null;
  threeYear?: number | null;
  fiveYear?: number | null;
  tenYear?: number | null;
  bestThreeYear?: number | null;
  worstThreeYear?: number | null;
}

interface ETFHoldingsProps {
  topHoldings?: TopHoldingsData | null;
  fundPerformance?: FundPerformanceData | null;
  currencySymbol?: string;
  region?: RegionFormat;
  className?: string;
}

const SECTOR_COLORS: Record<string, string> = {
  realestate: "bg-amber-500",
  consumer_cyclical: "bg-pink-500",
  basic_materials: "bg-orange-500",
  consumer_defensive: "bg-teal-500",
  technology: "bg-amber-500",
  communication_services: "bg-amber-500",
  financial_services: "bg-emerald-500",
  utilities: "bg-yellow-500",
  industrials: "bg-slate-500",
  energy: "bg-red-500",
  healthcare: "bg-cyan-500",
};

const formatSectorName = (raw: string): string => {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatPercent = (val: number | null | undefined, multiply = true): string => {
  if (val === null || val === undefined) return "—";
  const pct = multiply ? val * 100 : val;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
};

const normalizeWeight = (val: number | null | undefined): number | null => {
  if (val == null || !Number.isFinite(val)) return null;
  // Some providers return 0-1 fractions, others return 0-100 percentages.
  return val > 1 ? val / 100 : val;
};

export function ETFHoldings({
  topHoldings,
  fundPerformance,
  currencySymbol = "$",
  region = "US",
  className,
}: ETFHoldingsProps) {
  const validHoldings = (topHoldings?.holdings || [])
    .map((holding) => ({ holding, normalizedWeight: normalizeWeight(holding.weight) }))
    .filter(({ normalizedWeight }) => normalizedWeight != null && normalizedWeight > 0);
  const validSectorWeights = (topHoldings?.sectorWeights || [])
    .map((sw) => ({ sw, normalizedWeight: normalizeWeight(sw.weight) }))
    .filter(({ normalizedWeight }) => normalizedWeight != null && normalizedWeight > 0)
    .sort((a, b) => (b.normalizedWeight ?? 0) - (a.normalizedWeight ?? 0));

  const hasHoldings = validHoldings.length > 0;
  const hasSectorWeights = validSectorWeights.length > 0;
  const hasPerformance = fundPerformance && (fundPerformance.oneYear != null || fundPerformance.threeYear != null);
  const hasEquityHoldings = topHoldings?.equityHoldings && (
    topHoldings.equityHoldings.priceToEarnings != null || topHoldings.equityHoldings.medianMarketCap != null
  );

  if (!hasHoldings && !hasSectorWeights && !hasPerformance) return null;

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl", className)}>
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-500" />
          Fund Composition & Performance
        </h3>
      </div>

      <div className="divide-y divide-border/30">
        {/* Top Holdings */}
        {hasHoldings && (
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <PieChart className="w-3.5 h-3.5 text-sky-500" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Top Holdings
              </span>
            </div>
            <div className="space-y-1.5">
              {validHoldings.slice(0, 10).map(({ holding, normalizedWeight }, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-bold text-muted-foreground/40 w-4 shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs text-foreground truncate">
                      {holding.name || holding.symbol || "Unknown"}
                    </span>
                    {holding.symbol && holding.name && (
                      <span className="text-[9px] font-mono text-muted-foreground hidden sm:inline">
                        {holding.symbol}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500/60 rounded-full"
                        style={{ width: `${Math.min(100, (normalizedWeight ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-14 text-right">
                      {normalizedWeight != null ? `${(normalizedWeight * 100).toFixed(2)}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sector Weights */}
        {hasSectorWeights && (
          <div className="p-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3 block">
              Sector Allocation
            </span>
            <div className="space-y-1.5">
              {validSectorWeights.map(({ sw, normalizedWeight }, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        SECTOR_COLORS[sw.sector] || "bg-muted-foreground"
                      )} />
                      <span className="text-xs text-foreground truncate">
                        {formatSectorName(sw.sector)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            SECTOR_COLORS[sw.sector] || "bg-muted-foreground",
                            "opacity-80"
                          )}
                          style={{ width: `${Math.min(100, (normalizedWeight ?? 0) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-14 text-right">
                        {normalizedWeight != null ? `${(normalizedWeight * 100).toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Fund Performance + Portfolio Stats */}
        {(hasPerformance || hasEquityHoldings) && (
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Fund Returns & Stats
              </span>
            </div>

            {hasPerformance && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { label: "YTD", value: fundPerformance!.ytd },
                  { label: "1 Year", value: fundPerformance!.oneYear },
                  { label: "3 Year", value: fundPerformance!.threeYear },
                  { label: "5 Year", value: fundPerformance!.fiveYear },
                ].filter(item => item.value != null).map((item) => {
                  const isPositive = item.value != null && item.value > 0;
                  return (
                    <div key={item.label} className="flex flex-col gap-0.5 p-2 rounded-2xl bg-card/60 backdrop-blur-2xl shadow-xl border border-white/5">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                        {item.label}
                      </span>
                      <span className={cn(
                        "text-sm font-bold",
                        isPositive ? "text-emerald-500" : "text-red-500",
                      )}>
                        {formatPercent(item.value, false)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {hasEquityHoldings && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {topHoldings!.equityHoldings!.priceToEarnings != null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                    <span className="text-[10px] text-muted-foreground">Wtd. P/E</span>
                    <span className="text-xs font-semibold">{topHoldings!.equityHoldings!.priceToEarnings!.toFixed(2)}x</span>
                  </div>
                )}
                {topHoldings!.equityHoldings!.priceToBook != null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                    <span className="text-[10px] text-muted-foreground">Wtd. P/B</span>
                    <span className="text-xs font-semibold">{topHoldings!.equityHoldings!.priceToBook!.toFixed(2)}x</span>
                  </div>
                )}
                {topHoldings!.equityHoldings!.medianMarketCap != null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                    <span className="text-[10px] text-muted-foreground">Median MCap</span>
                    <span className="text-xs font-semibold">{formatCompactNumber(topHoldings!.equityHoldings!.medianMarketCap!, { symbol: currencySymbol, region })}</span>
                  </div>
                )}
                {topHoldings!.equityHoldings!.threeYearEarningsGrowth != null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/20">
                    <span className="text-[10px] text-muted-foreground">3Y Earnings Gr.</span>
                    <span className="text-xs font-semibold">{formatPercent(topHoldings!.equityHoldings!.threeYearEarningsGrowth, false)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
