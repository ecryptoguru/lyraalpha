"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Flame, Snowflake } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";

export interface TopMoverItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  type: string;
}

function MoverRow({ mover, region }: { mover: TopMoverItem; region: string }) {
  const isPositive = mover.changePercent >= 0;
  const currencySymbol = region === "IN" ? "₹" : "$";
  const currencyRegion = region === "IN" ? "IN" : "US";
  return (
    <Link href={`/dashboard/assets/${mover.symbol}`}>
      <div className="flex items-center justify-between py-2.5 px-3 rounded-2xl hover:bg-muted/20 transition-colors group cursor-pointer">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-2xl border flex items-center justify-center text-[9px] font-bold shrink-0",
            isPositive ? "bg-success/10 border-success/20 text-success" : "bg-danger/10 border-danger/20 text-danger"
          )}>
            {getFriendlySymbol(mover.symbol, mover.type, mover.name).slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-tight truncate group-hover:text-primary transition-colors">{getFriendlySymbol(mover.symbol, mover.type, mover.name)}</p>
            <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{mover.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground font-mono">{formatPrice(mover.price, { symbol: currencySymbol, region: currencyRegion, decimals: 2 })}</span>
          <div className={cn("flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-xl border", isPositive ? "text-success bg-success/10 border-success/20" : "text-danger bg-danger/10 border-danger/20")}>
            {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {isPositive ? "+" : ""}{mover.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>
    </Link>
  );
}

export function TopMoversSection({ gainers, losers, region }: { gainers: TopMoverItem[]; losers: TopMoverItem[]; region: string }) {
  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-4 w-4 text-success" />
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Top Gainers</h3>
        </div>
        <div className="space-y-1">
          {gainers.map((m) => (
            <MoverRow key={m.symbol} mover={m} region={region} />
          ))}
          {gainers.length === 0 && (
            <p className="text-[10px] text-muted-foreground/40 text-center py-4 font-mono">No gainers data available</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <Snowflake className="h-4 w-4 text-danger" />
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Top Losers</h3>
        </div>
        <div className="space-y-1">
          {losers.map((m) => (
            <MoverRow key={m.symbol} mover={m} region={region} />
          ))}
          {losers.length === 0 && (
            <p className="text-[10px] text-muted-foreground/40 text-center py-4 font-mono">No losers data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
