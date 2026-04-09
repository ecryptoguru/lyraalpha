"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Minus } from "lucide-react";
import { motion } from "framer-motion";
import * as Motion from "@/components/dashboard/motion-wrapper";

type BenchmarkEntry = { symbol: string; name: string };

interface Holding {
  asset: {
    symbol: string;
    price: number | null;
    changePercent: number | null;
    oneYearChange?: number | null;
  };
  quantity: number;
  avgPrice: number;
}

interface BenchmarkComparisonCardProps {
  holdings: Holding[];
  region?: string;
  refreshSignal?: number;
}

const US_BENCHMARKS: BenchmarkEntry[] = [
  { symbol: "SPY",     name: "S&P 500" },
  { symbol: "QQQ",     name: "NASDAQ 100" },
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "GLD",     name: "Gold" },
];

const IN_BENCHMARKS: BenchmarkEntry[] = [
  { symbol: "^NSEI",   name: "Nifty 50" },
  { symbol: "^BSESN",  name: "Sensex" },
  { symbol: "^NSEBANK",name: "Nifty Bank" },
  { symbol: "GLD",     name: "Gold (USD)" },
];

function getBenchmarks(region: string): BenchmarkEntry[] {
  return region === "IN" ? IN_BENCHMARKS : US_BENCHMARKS;
}

interface QuoteData {
  symbol: string;
  changePercent?: number | null;
  regularMarketChangePercent?: number | null;
}

function useBenchmarkQuotes(benchmarks: BenchmarkEntry[]) {
  const symbols = benchmarks.map((b) => b.symbol).join(",");
  const swr = useSWR<Record<string, QuoteData>>(
    `/api/crypto/quotes?symbols=${encodeURIComponent(symbols)}`,
    (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)),
    { revalidateOnFocus: false },
  );

  return swr;
}

function DiffBar({ portfolioReturn, bmReturn, label }: { portfolioReturn: number; bmReturn: number; label: string }) {
  const diff = portfolioReturn - bmReturn;
  const isAhead = diff >= 0;
  const maxBar = Math.max(Math.abs(diff), 0.1);
  const barWidth = Math.min(100, (Math.abs(diff) / 20) * 100);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-20 shrink-0">
        <p className="text-[11px] font-bold text-foreground truncate">{label}</p>
        <p className={cn("text-[10px] font-medium tabular-nums", bmReturn >= 0 ? "text-emerald-400" : "text-red-400")}>
          {bmReturn >= 0 ? "+" : ""}{bmReturn.toFixed(2)}%
        </p>
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden relative">
          <motion.div
            className={cn("absolute top-0 h-full rounded-full", isAhead ? "bg-emerald-400" : "bg-red-400")}
            style={{ left: isAhead ? "50%" : undefined, right: isAhead ? undefined : "50%" }}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth / 2}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          {/* Center line */}
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        </div>
        <div className={cn(
          "shrink-0 text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full border",
          isAhead
            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
            : "text-red-400 bg-red-400/10 border-red-400/25"
        )}>
          {isAhead ? "+" : ""}{diff.toFixed(1)}%
        </div>
      </div>
      <div className="shrink-0">
        {isAhead
          ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          : diff === 0
            ? <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
        }
      </div>
      {void maxBar}
    </div>
  );
}

export function BenchmarkComparisonCard({ holdings, region = "US", refreshSignal }: BenchmarkComparisonCardProps) {
  const benchmarks = getBenchmarks(region);
  const { data: quotes, isLoading: quotesLoading, mutate } = useBenchmarkQuotes(benchmarks);

  useEffect(() => {
    if (refreshSignal == null) return;
    void mutate();
  }, [refreshSignal, mutate]);

  const portfolioReturn = useMemo(() => {
    if (holdings.length === 0) return null;
    let totalValue = 0;
    let totalCost = 0;
    for (const h of holdings) {
      const price = h.asset.price;
      const cost = h.quantity * h.avgPrice;
      totalCost += cost;
      if (price !== null) totalValue += h.quantity * price;
    }
    return totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  }, [holdings]);

  if (portfolioReturn === null) return null;

  const isPositive = portfolioReturn >= 0;
  const validQuotes = benchmarks.filter((bm) => quotes?.[bm.symbol]?.changePercent != null);

  return (
    <Motion.Container>
      <Motion.Item>
        <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)] hover:border-primary/20 transition-all duration-500">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">vs Benchmarks</h3>
            </div>
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold tabular-nums",
              isPositive
                ? "bg-emerald-400/10 border-emerald-400/25 text-emerald-400"
                : "bg-red-400/10 border-red-400/25 text-red-400"
            )}>
              {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isPositive ? "+" : ""}{portfolioReturn.toFixed(1)}%
              <span className="text-[10px] font-normal text-muted-foreground ml-1">your portfolio</span>
            </div>
          </div>

          {/* Benchmark rows */}
          {quotesLoading ? (
            <div className="space-y-3">
              {benchmarks.map((bm) => (
                <div key={bm.symbol} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <div className="w-20 space-y-1">
                    <div className="h-3 w-14 bg-muted/30 rounded-full animate-pulse" />
                    <div className="h-2.5 w-10 bg-muted/20 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 h-2 bg-muted/20 rounded-full animate-pulse" />
                  <div className="h-5 w-10 bg-muted/20 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {/* Legend */}
              <div className="flex items-center justify-between mb-2 px-0.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Benchmark</span>
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Your edge</span>
              </div>
              {benchmarks.map((bm) => {
                const quote = quotes?.[bm.symbol];
                const pct = quote?.changePercent ?? null;
                if (pct == null) return null;
                return (
                  <DiffBar
                    key={bm.symbol}
                    label={bm.name}
                    bmReturn={pct}
                    portfolioReturn={portfolioReturn}
                  />
                );
              })}
              {validQuotes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No benchmark data available</p>
              )}
            </div>
          )}

        </div>
      </Motion.Item>
    </Motion.Container>
  );
}
