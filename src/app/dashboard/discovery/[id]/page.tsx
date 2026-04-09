"use client";

import { useState, useMemo, useDeferredValue } from "react";
import { useParams } from "next/navigation";
import { useRegion } from "@/lib/context/RegionContext";
import {
  Search,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { CryptoCard } from "@/components/dashboard/stock-card";
import { IntelligenceLoader } from "@/components/ui/intelligence-loader";
import { cn, formatCompactNumber, getCurrencyConfig } from "@/lib/utils";

import { DiscoverySectorDTO, CryptoMappingDTO } from "@/lib/types/discovery.dto";
import { StockCardData } from "@/components/dashboard/types";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SectorDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { region } = useRegion();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading } = useSWR<DiscoverySectorDTO>(
    id ? `/api/discovery/sectors/${id}?region=${region}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    },
  );

  const loading = isLoading;

  // Derived State
  const filteredTiers = useMemo(() => {
    if (!data || !data.tiers) return [];

    return Object.entries(data.tiers)
      .map(([tierName, stocks]) => {
        const filteredStocks = (stocks as CryptoMappingDTO[]).filter(
          (s) =>
            s.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
            s.symbol.toLowerCase().includes(deferredSearch.toLowerCase()),
        );
        return { tierName, stocks: filteredStocks };
      })
      .filter(({ stocks }) => stocks.length > 0 || !deferredSearch);
  }, [data, deferredSearch]);

  const hasResults = filteredTiers.some((t) => t.stocks.length > 0);

  if (loading)
    return (
      <div className="py-20">
        <IntelligenceLoader
          message="Calibrating Sector Intelligence"
          subtext={`Analyzing ${id.replace(/-/g, " ")} structure`}
        />
      </div>
    );
  if (!data || "error" in data)
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold">Sector Not Ready</h2>
        <p className="text-muted-foreground">
          The digital intelligence for this sector is still being structured.
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-6 p-3 sm:p-4 md:p-6">
      {/* Institutional Top Bar: Context & Header */}
      <div className="relative z-10 flex flex-col lg:flex-row items-start justify-between gap-8 pt-4">
        <div className="flex items-start gap-6 group">
          <BackButton className="h-12 w-12 rounded-3xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-primary/10 sm:h-14 sm:w-14" />
          
          <div className="space-y-4 max-w-4xl">
             <div className="space-y-2">
                <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[0.9] premium-gradient-text uppercase">
                {data.name}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground font-medium leading-relaxed opacity-80 max-w-2xl">
                {data.description}
                </p>
            </div>
             
             {/* Removed Open In Screener Button */}
          </div>
        </div>
      </div>

        {/* Context Cards: Drivers & Rationale - High Density */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {data.drivers && (
            <div className="p-4 md:p-5 rounded-2xl bg-muted/20 border border-border flex items-start gap-3.5 text-xs text-muted-foreground backdrop-blur-2xl group hover:bg-muted/30 transition-colors">
              <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shrink-0 group-hover:scale-110 transition-transform">
                <Info className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="space-y-1 font-data flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/80 dark:text-primary/60">
                  Institutional Alpha Drivers
                </p>
                <p className="leading-tight font-bold text-foreground/80 font-sans">
                  {data.drivers}
                </p>
              </div>
            </div>
          )}
          {data.rationale && (
            <div className="p-4 md:p-5 rounded-2xl bg-muted/20 border border-border flex items-start gap-3.5 text-xs text-muted-foreground backdrop-blur-2xl group hover:bg-muted/30 transition-colors">
              <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 shrink-0 group-hover:scale-110 transition-transform">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="space-y-1 font-data flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-500/60">
                  Discovery Rationale
                </p>
                <p className="leading-tight font-bold text-foreground/80 font-sans">
                  {data.rationale}
                </p>
              </div>
            </div>
          )}
        </div>

      {/* Toolbar - Standardized Space Handling */}
      <div className="sticky top-0 z-30 flex flex-col md:flex-row gap-4 justify-between items-center -mx-1 md:mx-0 transition-all duration-300 pt-2 pb-2">
        <div className="relative w-full md:max-w-xl flex items-center group">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary z-10" />
          <Input
            placeholder="Filter by symbol or name..."
            className="pl-9 h-12 felt-input bg-card/40 backdrop-blur-2xl border-primary/10 focus:border-primary/30 rounded-2xl font-bold text-[13px] tracking-tight transition-all w-full shadow-2xl shadow-black/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter crypto assets"
          />
        </div>
        <div className="hidden md:flex items-center gap-2 pr-2">
          {/* List/Grid view toggles removed as requested */}
        </div>
      </div>

      {/* Clustered Tiers - High Density Transitions */}
      <div className="space-y-6 md:space-y-10 mt-2">
        {filteredTiers.map(({ tierName, stocks }) => {
          if (stocks.length === 0) return null;

          return (
            <section key={tierName} className="space-y-4 md:space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex flex-col font-data shrink-0">
                  <h2 className="text-base md:text-xl font-bold tracking-tight flex items-center gap-3">
                    {tierName} Alignment
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tierName === "Strong"
                          ? "bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                          : tierName === "Moderate"
                            ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                            : "bg-muted-foreground/40",
                      )}
                    />
                  </h2>
                  <p className="text-[8px] font-bold text-muted-foreground/80 dark:text-muted-foreground uppercase tracking-widest opacity-90 dark:opacity-40 mt-0.5">
                    {tierName === "Strong"
                      ? "High-conviction structural exposure"
                      : tierName === "Moderate"
                        ? "Substantial secondary exposure"
                        : "Emerging or opportunistic narrative mapping"}
                  </p>
                </div>
                <div className="h-px flex-1 surface-elevated" />
              </div>

              <div className="grid gap-3 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {stocks.map((mapping) => (
                  <CryptoCard
                    key={mapping.symbol}
                    data={mapDTOToCardData(mapping, data.sectorId)}
                    inclusionReason={mapping.inclusionReason || undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {search && !hasResults && (
          <div className="py-20 text-center space-y-4">
            <div className="p-3 rounded-full surface-elevated border border-border w-fit mx-auto">
              <Search className="h-6 w-6 text-muted-foreground opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold">No Intelligence Found</p>
              <p className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground opacity-90 dark:opacity-60">
                No crypto assets matching &quot;{search}&quot; meet the criteria.
              </p>
            </div>
            <Button
              variant="link"
              onClick={() => setSearch("")}
              className="text-primary font-bold text-[10px] uppercase tracking-widest"
            >
              Clear Filter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function mapDTOToCardData(
  dto: CryptoMappingDTO,
  sectorId: string,
): StockCardData {
  return {
    symbol: dto.symbol,
    name: dto.name,
    type: dto.type,
    inclusionType: dto.inclusionType,
    eligibilityScore: dto.scores.eligibility,
    confidence: dto.confidence,
    marketCap: (() => {
      const cfg = getCurrencyConfig(dto.currency);
      return formatCompactNumber(dto.metrics.marketCap, { symbol: cfg.symbol, region: cfg.region });
    })(),
    peRatio: dto.metrics.peRatio?.toFixed(1) || "—",
    oneYearChange: {
      value: dto.metrics.oneYearChange
        ? (dto.metrics.oneYearChange >= 0 ? "▲ " : "▼ ") +
          Math.abs(dto.metrics.oneYearChange).toFixed(1) +
          "%"
        : "—",
      isPositive: (dto.metrics.oneYearChange || 0) >= 0,
    },
    technicalRating: dto.metrics.technicalRating || "Neutral",
    analystRating: dto.metrics.analystRating || "—",
    evidenceCount: dto.evidence.length,
    assetId: dto.assetId,
    sectorId: sectorId,
    signals: dto.signals,
  };
}
