"use client";

import { useRegion } from "@/lib/context/RegionContext";
import { useWatchlist, WatchlistItem } from "@/hooks/use-watchlist";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { WatchlistStar } from "@/components/dashboard/watchlist-star";
import Link from "next/link";
import { cn, formatPrice, getCurrencyConfig } from "@/lib/utils";
import { ScoreVelocityBadge } from "@/components/ui/score-velocity-badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getFriendlyAssetSubtitle, getFriendlySymbol, velocityDelta } from "@/lib/format-utils";
import {
  Star,
  TrendingUp,
  TrendingDown,
  Loader2,
  Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

type FilterType = "ALL" | "CRYPTO";

const filterOptions: { label: string; value: FilterType }[] = [
  { label: "All", value: "ALL" },
  { label: "Crypto", value: "CRYPTO" },
];

function WatchlistRow({ item }: { item: WatchlistItem }) {
  const asset = item.asset;
  const isUp = (asset.changePercent ?? 0) >= 0;
  const config = getCurrencyConfig(asset.currency || "USD");

  return (
    <Link
      href={`/dashboard/assets/${item.symbol}`}
      className="group block"
    >
      <div className="relative rounded-3xl border border-white/10 bg-card/70 p-4 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl transition-all duration-300 ease-out group-hover:bg-card/85 group-hover:border-primary/20 group-hover:-translate-y-0.5 group-hover:shadow-[0_28px_90px_-36px_rgba(251,191,36,0.18)]">
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
            <WatchlistStar symbol={item.symbol} region={item.region} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold tracking-tight premium-gradient-text uppercase truncate">
                  {getFriendlySymbol(item.symbol, asset.type, asset.name)}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                  {asset.type}
                </span>
                <ScoreVelocityBadge
                  trendDelta={velocityDelta(asset.scoreDynamics, "trend")}
                  momentumDelta={velocityDelta(asset.scoreDynamics, "momentum")}
                />
              </div>
              <p className="text-[10px] font-medium text-muted-foreground/70 truncate">
                {getFriendlyAssetSubtitle(item.symbol, asset.type, asset.name)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 ml-auto">
            {asset.sector && (
              <span className="hidden md:inline-block text-[8px] font-bold text-primary/70 bg-primary/5 border border-primary/10 rounded-xl px-1.5 py-0.5 uppercase tracking-wider">
                {asset.sector}
              </span>
            )}
            <div className="text-right">
              <div className="text-sm font-bold tracking-tight text-foreground font-mono tabular-nums">
                {formatPrice(asset.price || 0, { symbol: config.symbol, region: config.region })}
              </div>
              <div
                className={cn(
                  "flex items-center justify-end gap-1 text-[10px] font-bold font-mono tabular-nums",
                  isUp ? "text-success" : "text-danger",
                )}
              >
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isUp ? "+" : ""}
                {(asset.changePercent || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function WatchlistPage() {
  const { region } = useRegion();
  const { items, isLoading, error: watchlistError } = useWatchlist(region);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");

  const filtered = useMemo(() => {
    let result = items;

    if (typeFilter !== "ALL") {
      result = result.filter((i) => i.asset.type === typeFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.symbol.toLowerCase().includes(q) ||
          i.asset.name?.toLowerCase().includes(q) ||
          i.asset.sector?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [items, typeFilter, search]);

  const regionItems = useMemo(() => {
    if (region === "US") return filtered.filter((i) => i.asset.region !== "IN");
    if (region === "IN") return filtered.filter((i) => i.asset.region === "IN");
    return filtered;
  }, [filtered, region]);

  return (
    <TooltipProvider>
      <div className="relative flex flex-col gap-4 sm:gap-6 p-3 sm:p-4 md:p-6 pb-6 min-w-0 overflow-x-hidden">
        <div className="relative z-10 animate-slide-up-fade">
          <PageHeader
            icon={<Star className="h-5 w-5" />}
            title="Watchlist"
            eyebrow="Starred assets"
            chips={
              <>
                <StatChip value={items.length} label="Starred" variant={items.length > 0 ? "gold" : "muted"} />
                <StatChip value={region} label="Market" variant="muted" />
              </>
            }
          />
        </div>

        {/* Search + Filters */}
        <div className="relative z-10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Search watchlist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-3xl border-white/10 bg-card/70 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((f) => (
              <Button
                key={f.value}
                variant="outline"
                size="sm"
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "h-11 rounded-3xl text-[10px] font-bold font-mono tabular-nums uppercase tracking-widest transition-all",
                  typeFilter === f.value
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

      {/* Content */}
      <div className="relative z-10">
        {watchlistError ? (
          <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-white/10 bg-card/70 py-20 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <p className="text-sm font-bold text-destructive uppercase tracking-widest mb-2">
              Failed to load watchlist
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-sm text-center">
              Please refresh the page and try again.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40 mb-4" />
            <p className="text-[10px] font-bold font-mono tabular-nums text-muted-foreground uppercase tracking-widest">
              Loading watchlist...
            </p>
          </div>
        ) : regionItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-white/10 bg-card/70 py-20 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <Star className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">
              {items.length === 0 ? "No starred assets yet" : "No starred assets in this region"}
            </p>
            <p className="text-xs text-muted-foreground/60 max-w-sm text-center">
              {items.length === 0
                ? "Tap the ★ on any asset card to add it here for quick access."
                : `You have ${items.length} starred assets. Switch to ${region === "US" ? "India" : "US"} to see them.`}
            </p>
            {items.length === 0 && (
              <Link href="/dashboard/assets" className="mt-3 text-xs font-bold text-primary hover:underline">
                Browse Assets →
              </Link>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3">
              {regionItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                >
                  <WatchlistRow item={item} />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
