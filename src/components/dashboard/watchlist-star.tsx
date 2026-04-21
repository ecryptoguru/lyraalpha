"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/use-watchlist";
import { getFriendlyAssetName } from "@/lib/format-utils";
import { toast } from "sonner";

interface WatchlistStarProps {
  symbol: string;
  region?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const buttonSizeMap = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-9 w-9",
};

const FIRST_VALUE_ACTION_KEY = "ux:first-value-action:v1";
const SUCCESS_ACTIONS_KEY = "ux:successful-actions:v1";

export function WatchlistStar({ symbol, region, size = "md", className }: WatchlistStarProps) {
  const { isWatchlisted, toggleWatchlist } = useWatchlist();
  const [pending, setPending] = useState(false);
  const active = isWatchlisted(symbol);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    setPending(true);
    const success = await toggleWatchlist(symbol, region);
    setPending(false);

    if (success) {
      if (!active) {
        try {
          window.localStorage.setItem(FIRST_VALUE_ACTION_KEY, "watchlist_add");
          const raw = window.localStorage.getItem(SUCCESS_ACTIONS_KEY);
          const parsed = raw ? (JSON.parse(raw) as string[]) : [];
          const next = Array.from(new Set([...parsed, "watchlist_add"]));
          window.localStorage.setItem(SUCCESS_ACTIONS_KEY, JSON.stringify(next));
        } catch {
          // Ignore localStorage write errors
        }
      }
      const assetLabel = getFriendlyAssetName(symbol);
      toast.success(active ? `${assetLabel} removed from watchlist` : `${assetLabel} added to watchlist`);
    } else {
      toast.error("Failed to update watchlist");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={active ? `Remove ${getFriendlyAssetName(symbol)} from watchlist` : `Add ${getFriendlyAssetName(symbol)} to watchlist`}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl transition-all duration-200",
        "hover:bg-[#FFD700]/10 active:scale-90",
        buttonSizeMap[size],
        pending && "opacity-70 pointer-events-none",
        className,
      )}
    >
      <Star
        className={cn(
          sizeMap[size],
          "transition-all duration-200",
          active
            ? "fill-[#FFD700] text-[#FFD700] drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]"
            : "text-muted-foreground hover:text-[#FFD700]/70",
        )}
      />
    </button>
  );
}
