"use client";

import { useState, useEffect, useRef, useDeferredValue } from "react";
import { cn } from "@/lib/utils";
import { Search, Loader2, ArrowRight, Zap, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import useSWR from "swr";
import { getFriendlySymbol } from "@/lib/format-utils";
import { useRegion } from "@/lib/context/RegionContext";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SearchResult {
  sectors: { id: string; name: string; slug: string }[];
  assets: { 
    symbol: string; 
    name: string; 
    type: string;
    sectorSlug: string; 
    sectorName: string;
  }[];
}

export function DiscoverySearch() {
  const { region } = useRegion();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR<SearchResult>(
    deferredQuery.length >= 2 ? `/api/discovery/search?q=${deferredQuery}&region=${region}` : null,
    fetcher,
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults =
    data && (data.sectors?.length > 0 || data.assets?.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto z-50">
      <div className="relative group">
        <div className="absolute -inset-1 rounded-2xl bg-primary/20 opacity-0 group-focus-within:opacity-100 transition duration-500 blur-md" />
        <div className="relative flex items-center group-focus-within:border-primary/20 transition-all shadow-xl">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-40 shrink-0 z-10" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={region === "IN" ? "Search BTC, Bitcoin, SOL" : "Search BTC, Bitcoin, ETH"}
            aria-label="Search crypto assets"
            className="pl-9 h-12 felt-input bg-card/40 backdrop-blur-2xl border-primary/10 focus:border-primary/30 rounded-2xl font-bold text-[13px] tracking-tight transition-all w-full shadow-2xl shadow-black/20"
          />
          {isLoading && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary shrink-0" />
          )}
        </div>
      </div>

      {isOpen && query.length >= 2 && (
        <div
          className={cn(
            "fixed inset-0 top-0 left-0 w-full h-full bg-[#0a0c10]/98 backdrop-blur-2xl z-50 md:absolute md:inset-auto md:top-full md:left-0 md:h-auto md:mt-3 md:bg-[#0a0c10]/95 md:border md:border-white/10 md:rounded-3xl md:shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200",
            "p-4 md:p-0",
          )}
        >
          {/* Mobile Close Bar */}
          <div className="flex md:hidden items-center justify-between mb-6 px-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40 font-data">
              Market Intelligence Search
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-2xl surface-elevated text-muted-foreground hover:text-foreground transition-colors h-10 w-10 flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[85vh] md:max-h-[70vh] overflow-y-auto will-change-scroll overscroll-contain scroll-smooth p-2 space-y-4 scrollbar-hide">
            {isLoading ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 font-data">
                  Analyzing Market Graph...
                </p>
              </div>
            ) : hasResults ? (
              <>
                {data.sectors?.length > 0 && (
                  <div className="space-y-1">
                    <p className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 font-data">
                      Themes Found
                    </p>
                    {data.sectors.map((s: { slug: string; name: string }) => (
                      <Link
                        key={s.slug}
                        href={`/dashboard/discovery/${s.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/20 transition-colors group/item min-h-[56px] cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 rounded-2xl bg-accent/10 border border-accent/20 shrink-0">
                            <Globe className="h-4 w-4 text-accent" />
                          </div>
                          <span className="font-bold text-foreground/90 font-data tracking-tight">
                            {s.name}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-40 transition-all group-hover/item:translate-x-1" />
                      </Link>
                    ))}
                  </div>
                )}

                {data.assets?.length > 0 && (
                  <div className="space-y-1">
                    <p className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 font-data">
                      Assets Identified
                    </p>
                    {data.assets.map((a) => (
                        <Link
                          key={`${a.symbol}-${a.sectorSlug}`}
                          href={`/dashboard/assets/${a.symbol}`}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/20 transition-colors group/item min-h-[56px] cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shrink-0">
                              <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <div className="font-data">
                              <p className="font-bold text-foreground/90 tracking-tight">
                                {getFriendlySymbol(a.symbol, a.type, a.name)}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-tight opacity-60">
                                {a.type} · {a.sectorName}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/item:opacity-40 transition-all group-hover/item:translate-x-1" />
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="p-16 text-center space-y-6">
                <div className="h-16 w-16 rounded-full surface-elevated flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                  <Search className="h-6 w-6 text-muted-foreground opacity-20" />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-foreground/60 tracking-[0.2em] uppercase text-[10px] font-data">
                    Intelligence Gap
                  </p>
                  <p className="text-xs text-muted-foreground opacity-40 px-8 leading-relaxed">
                    No specific themes or high-conviction assets match &quot;
                    {query}&quot; in the current investment regime.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
