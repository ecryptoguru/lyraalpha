"use client";
// Market Search Input Component


import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MarketSearchInputProps {
  onSearchChange: (value: string) => void;
  onEnter?: (value: string) => void;
  initialValue?: string;
  className?: string;
  placeholder?: string;
}

export function MarketSearchInput({
  onSearchChange,
  onEnter,
  initialValue = "",
  className,
  placeholder = "Search global terminal (e.g. AAPL, BTC, GLD)...",
}: MarketSearchInputProps) {
  const [value, setValue] = useState(initialValue);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Debounce the value to the parent to prevent rapid re-fetching
  // This waits for the user to STOP typing for 500ms before triggering the parent update
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(value);
      setIsDebouncing(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, onSearchChange]);

  return (
    <div className={cn("relative w-full group transition-all duration-300 z-10", className)}>
      <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-40 shrink-0 z-10 transition-colors group-focus-within:text-primary group-focus-within:opacity-100" />
      <Input
        placeholder={placeholder}
        className="pl-9 h-12 felt-input bg-card/40 backdrop-blur-2xl border-primary/10 focus:border-primary/30 rounded-2xl font-bold text-[13px] tracking-tight transition-all w-full shadow-2xl shadow-black/20"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setIsDebouncing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            onEnter(value);
          }
        }}
        aria-label="Search assets"
      />
      {isDebouncing && (
        <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary shrink-0" />
      )}
    </div>
  );
}
