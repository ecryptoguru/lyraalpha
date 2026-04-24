"use client";

import { memo, useMemo } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TickerAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

interface TickerResponse {
  assets: TickerAsset[];
  source: string;
  timestamp: number;
}

const tickerFetcher = async (url: string): Promise<TickerResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("ticker fetch failed");
  return res.json();
};

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

const TickerChip = memo(function TickerChip({ asset }: { asset: TickerAsset }) {
  const isUp = asset.change24h >= 0;
  return (
    <div className="inline-flex items-center gap-2.5 rounded-xl border border-white/7 bg-white/2.5 px-4 py-2.5 backdrop-blur-sm shadow-[4px_4px_12px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.03)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/10">
      <span className="font-mono text-xs font-bold text-white/90">{asset.symbol}</span>
      <span className="font-mono text-[10px] text-white/50">{formatPrice(asset.price)}</span>
      <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold ${isUp ? "text-info" : "text-danger"}`}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isUp ? "+" : ""}{asset.change24h.toFixed(2)}%
      </span>
    </div>
  );
});

/** Skeleton chips shown while loading to prevent layout pop */
function TickerSkeleton() {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-xl border border-white/7 bg-white/2.5 px-4 py-2.5">
      <span className="inline-block h-3.5 w-10 rounded bg-white/10" />
      <span className="inline-block h-2.5 w-12 rounded bg-white/5" />
      <span className="inline-block h-2.5 w-10 rounded bg-white/10" />
    </div>
  );
}

export function LivePriceTicker() {
  const { data, error } = useSWR<TickerResponse>("/api/market/public-ticker", tickerFetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

  const isLoading = !data && !error;
  const doubled = useMemo(
    () => (data?.assets && data.assets.length ? [...data.assets, ...data.assets] : []),
    [data]
  );

  if (error && doubled.length === 0) return null;

  return (
    <section
      aria-label="Live cryptocurrency prices"
      className="group relative overflow-hidden border-y border-white/5 bg-[#040816] py-4"
      tabIndex={-1}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-[#040816] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-[#040816] to-transparent" />
      {isLoading ? (
        <div className="flex w-max items-center gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <TickerSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="flex w-max items-center gap-4 animate-[marquee_35s_linear_infinite] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
          {doubled.map((a, i) => (
            <TickerChip key={`${a.symbol}-${i}`} asset={a} />
          ))}
        </div>
      )}
    </section>
  );
}
