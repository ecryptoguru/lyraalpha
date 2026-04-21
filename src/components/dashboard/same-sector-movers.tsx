"use client";

import useSWR from "swr";
import Link from "next/link";
import { cn, formatPrice, getCurrencyConfig } from "@/lib/utils";
import { TrendingUp, TrendingDown, Layers } from "lucide-react";
import { getFriendlySymbol } from "@/lib/format-utils";

interface SectorMover {
  symbol: string;
  name: string;
  type: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  sector: string | null;
  compatibilityScore: number | null;
}

interface SectorMoversResponse {
  movers: SectorMover[];
  groupedBy: "sector" | "type";
  label: string;
}

import { fetcher } from "@/lib/swr-fetcher";

export function SameSectorMovers({ symbol }: { symbol: string }) {
  const { data, isLoading } = useSWR<SectorMoversResponse>(
    symbol ? `/api/stocks/${symbol}/sector-movers` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/8 bg-card/40 p-4 space-y-3">
        <div className="h-3 w-32 rounded-full bg-muted/20 animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 rounded-2xl bg-muted/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.movers.length) return null;

  return (
    <div className="rounded-3xl border border-white/8 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-primary/60 shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
          {data.groupedBy === "sector" ? data.label : "Same asset class"} movers
        </p>
      </div>

      <div className="space-y-1.5">
        {data.movers.map((mover) => {
          const isUp = (mover.changePercent ?? 0) >= 0;
          const currencyConfig = getCurrencyConfig(mover.currency ?? "USD");
          const compatClass =
            mover.compatibilityScore === null ? null :
            mover.compatibilityScore >= 60 ? "text-success bg-success/10" :
            mover.compatibilityScore >= 40 ? "text-warning bg-warning/10" :
            "text-danger bg-danger/10";

          return (
            <Link
              key={mover.symbol}
              href={`/dashboard/assets/${mover.symbol}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-card/30 px-3 py-2 transition-all duration-200 hover:border-primary/20 hover:bg-card/60 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold tracking-tight premium-gradient-text uppercase truncate">
                    {getFriendlySymbol(mover.symbol, mover.type, mover.name)}
                  </p>
                  {compatClass && mover.compatibilityScore !== null && (
                    <span className={cn("text-[8px] font-bold px-1 py-0.5 rounded-md tabular-nums shrink-0", compatClass)}>
                      {mover.compatibilityScore}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground/60 truncate">
                  {mover.name}
                </p>
              </div>

              <div className="text-right shrink-0 space-y-0.5">
                {mover.price !== null && (
                  <p className="text-[11px] font-bold font-mono tabular-nums text-foreground">
                    {formatPrice(mover.price, { symbol: currencyConfig.symbol, region: currencyConfig.region })}
                  </p>
                )}
                {mover.changePercent !== null && (
                  <div className={cn(
                    "flex items-center justify-end gap-1 text-[9px] font-bold font-mono tabular-nums",
                    isUp ? "text-success" : "text-danger",
                  )}>
                    {isUp
                      ? <TrendingUp className="h-2.5 w-2.5" />
                      : <TrendingDown className="h-2.5 w-2.5" />
                    }
                    {isUp ? "+" : ""}{mover.changePercent.toFixed(2)}%
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
