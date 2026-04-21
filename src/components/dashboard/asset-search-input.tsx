/* eslint-disable react-hooks/refs */
"use client";

import { useState, useRef, useEffect, useDeferredValue } from "react";
import { Search, Loader2, Zap } from "lucide-react";
import { 
  useFloating, 
  autoUpdate, 
  offset, 
  flip, 
  shift, 
  size, 
  FloatingPortal 
} from "@floating-ui/react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";

import { fetcher } from "@/lib/swr-fetcher";

interface SearchAsset {
  symbol: string;
  name: string;
  type: string;
  sectorSlug: string;
  sectorName: string;
}

interface SearchResult {
  sectors: { id: string; name: string; slug: string }[];
  assets: SearchAsset[];
}

interface AssetSearchInputProps {
  autoFocus?: boolean;
  onSelect: (symbol: string) => void;
  placeholder?: string;
  region?: string;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  global?: boolean;
}

const ASSET_TYPE_COLORS: Record<string, string> = {
  CRYPTO: "text-warning bg-warning/10 border-warning/20",
};

export function AssetSearchInput({
  autoFocus = false,
  onSelect,
  placeholder,
  region,
  disabled = false,
  className,
  dropdownClassName,
  global = false,
}: AssetSearchInputProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(12),
      flip({ fallbackAxisSideDirection: "end" }),
      shift({ padding: 16 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.max(320, rects.reference.width)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const url =
    deferredQuery.length >= 2
      ? `/api/discovery/search?q=${encodeURIComponent(deferredQuery)}${region ? `&region=${region}` : ""}${global ? `&global=true` : ""}`
      : null;

  const { data, isLoading } = useSWR<SearchResult>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 500,
  });

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      const target = e.target as Node;
      // Check if we clicked outside both the reference (input wrapper) and the floating element (dropdown)
      if (
        refs.reference.current &&
        !(refs.reference.current as HTMLElement).contains(target) &&
        refs.floating.current &&
        !(refs.floating.current as HTMLElement).contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [refs]);

  function handleSelect(asset: SearchAsset) {
    onSelect(asset.symbol);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  }

  const hasResults = data && data.assets?.length > 0;

  const defaultPlaceholder = region === "IN"
    ? "Search BTC, Bitcoin, ETH"
    : "Search BTC, Bitcoin, ETH";
  const finalPlaceholder = placeholder || defaultPlaceholder;

  return (
    <div className={cn("relative z-50", className)}>
      <div className="relative group" ref={refs.setReference}>
        <div className="absolute -inset-1 bg-linear-to-r from-primary/20 to-secondary/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition duration-700" />
        <div className="relative flex items-center group-focus-within:border-primary/40 transition-all shadow-xl group-focus-within:shadow-primary/15 rounded-2xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60 group-focus-within:text-primary group-focus-within:opacity-100 transition-colors shrink-0 z-10" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
                setQuery("");
              } else if (e.key === "Enter" && query.trim().length > 0) {
                e.preventDefault();
                const syms = query.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
                syms.forEach(sym => {
                  if (sym) onSelect(sym);
                });
                setQuery("");
                setIsOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder={finalPlaceholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            className="pl-10 h-12 felt-input bg-background/80 md:bg-card/60 backdrop-blur-3xl border border-white/5 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-2xl font-bold text-base md:text-sm tracking-tight transition-all w-full shadow-inner disabled:opacity-40 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground/50 focus:placeholder:text-muted-foreground/30"
          />
          {isLoading && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary shrink-0" />
          )}
        </div>
      </div>

      {isOpen && query.length >= 2 && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={cn(
              "bg-[#0a0c10]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden z-100 animate-in fade-in zoom-in-95 duration-200",
              dropdownClassName
            )}
          >
            <div className="max-h-[85vh] md:max-h-[60vh] overflow-y-auto will-change-scroll overscroll-contain scroll-smooth p-2 space-y-4 md:space-y-1 scrollbar-hide">
            {isLoading && !hasResults ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 md:py-6 text-muted-foreground/40">
                <Loader2 className="h-5 w-5 md:h-3.5 md:w-3.5 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Searching...</span>
              </div>
            ) : hasResults ? (
              <div className="space-y-1">
                {data.assets.map((asset) => {
                  const friendlyName = getFriendlySymbol(asset.symbol, asset.type, asset.name);
                  const typeStyle = ASSET_TYPE_COLORS[asset.type] ?? "text-muted-foreground bg-muted/20 border-border/30";
                  return (
                    <button
                      key={asset.symbol}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(asset)}
                      className="w-full flex items-center justify-between px-4 md:px-3 py-3 md:py-2.5 rounded-2xl md:rounded-xl hover:bg-muted/20 md:hover:bg-white/5 transition-colors text-left group min-h-[56px] md:min-h-[48px]"
                    >
                      <div className="flex items-center gap-4 md:gap-3 flex-1 min-w-0">
                        <div className="p-2.5 md:p-1.5 rounded-2xl md:rounded-lg bg-warning/10 border border-warning/20 shrink-0">
                          <Zap className="h-4 w-4 md:h-3 md:w-3 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0 font-data md:font-sans">
                          <p className="font-bold text-sm md:text-xs text-foreground/90 truncate group-hover:text-primary transition-colors tracking-tight">
                            {friendlyName}
                          </p>
                          <p className="text-[10px] md:text-[9px] text-muted-foreground/60 md:text-muted-foreground/50 truncate uppercase md:normal-case tracking-tight md:tracking-normal">
                            {asset.type} · {asset.sectorName}
                          </p>
                        </div>
                      </div>
                      <span className={cn("text-[10px] md:text-[8px] font-bold uppercase px-2 md:px-1.5 py-1 md:py-0.5 rounded-md md:rounded border shrink-0 ml-2", typeStyle)}>
                        {asset.type === "CRYPTO" ? "CRYPTO" : asset.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : query.length >= 2 && !isLoading ? (
              <div className="py-10 md:py-6 text-center">
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                  No assets found for &quot;{query}&quot;
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </FloatingPortal>
      )}
    </div>
  );
}
