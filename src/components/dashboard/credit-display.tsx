"use client";

import { Coins } from "lucide-react";
import { useDashboardPoints } from "@/hooks/use-dashboard-points";
import { cn } from "@/lib/utils";

interface CreditDisplayProps {
  userId: string;
}

/**
 * Displays the live credit balance in the dashboard header.
 * Uses the same /api/points SWR key as the rewards page and sidebar
 * so all components update simultaneously when credits change.
 */
export function CreditDisplay({ userId }: CreditDisplayProps) {
  const { mounted, points, isLoading } = useDashboardPoints({
    enabled: Boolean(userId),
  });
  const credits = typeof points?.credits === "number" ? points.credits : null;

  if (!mounted || isLoading || credits === null) {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 text-sm text-muted-foreground">
        <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        <span className="w-6 h-3.5 bg-muted/50 animate-pulse rounded" />
      </div>
    );
  }

  const isLow = credits < 20;

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <Coins className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", isLow ? "text-red-400" : "text-amber-500")} />
      <span
        className={cn(
          "text-xs sm:text-sm font-semibold tabular-nums",
          isLow ? "text-red-400" : "text-muted-foreground",
        )}
      >
        {credits.toLocaleString()}
      </span>
      {isLow && (
        <span className="hidden sm:inline text-[9px] font-bold text-red-400/70 uppercase tracking-wide">
          Low
        </span>
      )}
    </div>
  );
}
