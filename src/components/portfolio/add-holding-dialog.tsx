"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, Plus, Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AssetSuggestion {
  symbol: string;
  name: string;
  type: string;
  sector: string | null;
  price: number | null;
  currency: string | null;
  region: string | null;
}

interface AddHoldingDialogProps {
  portfolioId: string;
  region: string;
  onAdd: (portfolioId: string, body: { symbol: string; quantity: number; avgPrice: number }) => Promise<unknown>;
  onClose: () => void;
}

function getCurrencySymbol(region: string): string {
  return region === "IN" ? "₹" : "$";
}

function useAssetSearch(query: string, region: string) {
  const [results, setResults] = useState<AssetSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    let cancelled = false;
    timerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/portfolio/asset-search?q=${encodeURIComponent(query)}&region=${region}`);
        if (cancelled) return;
        if (!res.ok) { setResults([]); return; }
        const data = await res.json() as { assets?: AssetSuggestion[] };
        if (!cancelled) setResults(data.assets ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, region]);

  return { results, isSearching };
}

export function AddHoldingDialog({ portfolioId, region, onAdd, onClose }: AddHoldingDialogProps) {
  const currencySymbol = getCurrencySymbol(region);
  const [symbol, setSymbol] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetSuggestion | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { results, isSearching } = useAssetSearch(showDropdown ? symbolInput : "", region);

  // Close dropdown on outside click; close dialog on Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showDropdown) {
          setShowDropdown(false);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDropdown, onClose]);

  function selectAsset(asset: AssetSuggestion) {
    setSelectedAsset(asset);
    setSymbol(asset.symbol);
    setSymbolInput(asset.symbol);
    setShowDropdown(false);
    if (asset.price) {
      setAvgPrice(asset.price.toFixed(2));
    }
    setErrors({});
  }

  function handleSymbolChange(val: string) {
    const upper = val.toUpperCase();
    setSymbolInput(upper);
    setSymbol(upper);
    setSelectedAsset(null);
    setShowDropdown(true);
    setErrors((e) => ({ ...e, symbol: "" }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!symbol.trim()) newErrors.symbol = "Symbol is required";
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) newErrors.quantity = "Must be a positive number";
    const price = parseFloat(avgPrice);
    if (isNaN(price) || price <= 0) newErrors.avgPrice = "Must be a positive number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onAdd(portfolioId, {
        symbol: symbol.trim().toUpperCase(),
        quantity: parseFloat(quantity),
        avgPrice: parseFloat(avgPrice),
      });
      toast.success(`${symbol.toUpperCase()} added to portfolio`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add holding";
      if (msg.toLowerCase().includes("not found in universe") || msg.toLowerCase().includes("asset not found")) {
        setErrors({ symbol: `"${symbol}" is not in the ${region} asset universe. Check spelling or try a different ticker.` });
      } else if (msg.toLowerCase().includes("region")) {
        setErrors({ symbol: `This asset is not available for ${region} portfolios.` });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const showResults = showDropdown && symbolInput.length >= 1 && (results.length > 0 || isSearching);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/8 bg-card shadow-2xl p-6 space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Add Holding</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{region} portfolio</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-2xl border border-white/8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol search */}
          <div className="space-y-1.5">
            <Label htmlFor="symbol" className="text-xs font-bold">
              Symbol
            </Label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="symbol"
                  value={symbolInput}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  onFocus={() => { if (symbolInput.length >= 1) setShowDropdown(true); }}
                  placeholder="Search AAPL, MSFT, NIFTY50…"
                  className={cn(
                    "pl-9 pr-9 text-sm font-medium",
                    errors.symbol && "border-red-400/50",
                    selectedAsset && "border-emerald-400/40",
                  )}
                  autoFocus
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                )}
                {selectedAsset && !isSearching && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                )}
              </div>

              {/* Dropdown */}
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {isSearching && results.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching…
                    </div>
                  ) : results.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground">
                      No assets found for &quot;{symbolInput}&quot; in {region}
                    </div>
                  ) : (
                    results.map((asset) => (
                      <button
                        key={asset.symbol}
                        type="button"
                        onMouseDown={() => selectAsset(asset)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 border-b border-white/5 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{asset.symbol}</span>
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded uppercase">
                              {asset.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{asset.name}</p>
                        </div>
                        {asset.price != null && (
                          <span className="text-xs font-bold text-foreground shrink-0">
                            {currencySymbol}{asset.price.toFixed(2)}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected asset chip */}
            {selectedAsset && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>{selectedAsset.name}</span>
                {selectedAsset.sector && <span className="text-muted-foreground">· {selectedAsset.sector}</span>}
              </div>
            )}

            {errors.symbol && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {errors.symbol}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-bold">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setErrors((err) => ({ ...err, quantity: "" })); }}
                placeholder="10"
                className={cn("text-sm", errors.quantity && "border-red-400/50")}
              />
              {errors.quantity && <p className="text-[11px] text-red-400">{errors.quantity}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avgPrice" className="text-xs font-bold">
                Avg. Buy Price
              </Label>
              <Input
                id="avgPrice"
                type="number"
                step="any"
                min="0"
                value={avgPrice}
                onChange={(e) => { setAvgPrice(e.target.value); setErrors((err) => ({ ...err, avgPrice: "" })); }}
                placeholder={region === "IN" ? "2500.00" : "180.00"}
                className={cn("text-sm", errors.avgPrice && "border-red-400/50")}
              />
              {errors.avgPrice && <p className="text-[11px] text-red-400">{errors.avgPrice}</p>}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 text-sm h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 text-sm h-9">
              {isSubmitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Adding…</>
              ) : (
                <><Plus className="h-3.5 w-3.5 mr-1.5" />Add Holding</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
