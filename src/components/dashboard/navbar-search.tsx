"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type NavbarSearchProps = {
  desktopExpanded?: boolean;
};

const loadAssetSearchInput = () =>
  import("@/components/dashboard/asset-search-input").then((mod) => mod.AssetSearchInput);

const LazyAssetSearchInput = dynamic(loadAssetSearchInput, { ssr: false });

export function NavbarSearch({ desktopExpanded = false }: NavbarSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopInteractive, setIsDesktopInteractive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isExpanded = desktopExpanded || isOpen;

  const activateDesktopSearch = () => {
    if (!desktopExpanded) return;
    setIsDesktopInteractive(true);
    void loadAssetSearchInput();
  };

  useEffect(() => {
    if (desktopExpanded || !isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [desktopExpanded, isOpen]);

  // Handle escape key globally to close
  useEffect(() => {
    if (desktopExpanded || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [desktopExpanded, isOpen]);

  if (isExpanded) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center gap-2 duration-200",
          desktopExpanded ? "w-full max-w-md" : "animate-in fade-in zoom-in-95",
        )}
      >
        <div className={cn(desktopExpanded ? "w-full" : "w-64 max-w-[50vw]")}>
          {desktopExpanded && !isDesktopInteractive ? (
            <button
              type="button"
              onClick={activateDesktopSearch}
              onFocus={activateDesktopSearch}
              onMouseEnter={() => {
                void loadAssetSearchInput();
              }}
              className="relative flex h-12 w-full items-center rounded-2xl border border-white/5 bg-background/80 px-3.5 pl-10 text-left shadow-inner backdrop-blur-3xl transition-all focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10"
              aria-label="Activate asset search"
            >
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60" />
              <span className="truncate text-sm font-bold tracking-tight text-muted-foreground/60">
                Search BTC, Ethereum, Solana
              </span>
            </button>
          ) : (
            <LazyAssetSearchInput
              autoFocus={desktopExpanded && isDesktopInteractive}
              global
              dropdownClassName={desktopExpanded ? "left-0 right-0 origin-top" : "right-0 left-auto origin-top-right"}
              onSelect={(symbol) => {
                router.push(`/dashboard/assets/${symbol}`);
                if (!desktopExpanded) {
                  setIsOpen(false);
                }
              }}
            />
          )}
        </div>
        {!desktopExpanded ? (
          <button
            onClick={() => setIsOpen(false)}
            className="shrink-0 rounded-2xl p-2 text-muted-foreground transition-colors hover:bg-muted/30"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        void loadAssetSearchInput();
        setIsOpen(true);
      }}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200",
        "border-primary/25 bg-linear-to-b from-primary/18 to-primary/8 text-primary shadow-[0_10px_24px_rgba(245,158,11,0.18)]",
        "hover:border-primary/40 hover:shadow-[0_12px_28px_rgba(245,158,11,0.28)] active:scale-95",
      )}
      aria-label="Open search"
    >
      <Search className="h-4.5 w-4.5" />
    </button>
  );
}
