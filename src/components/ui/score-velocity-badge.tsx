"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ScoreVelocityBadgeProps {
  trendDelta: number | null | undefined;
  momentumDelta?: number | null | undefined;
  className?: string;
}

/**
 * Displays a compact rising/falling velocity badge based on DSE score delta.
 * Uses trend delta primarily; falls back to momentum delta.
 * Threshold: ±5 pts over recent window to show badge.
 */
export function ScoreVelocityBadge({ trendDelta, momentumDelta, className }: ScoreVelocityBadgeProps) {
  const delta = trendDelta ?? momentumDelta ?? null;
  if (delta === null || Math.abs(delta) < 5) return null;

  const isRising = delta > 0;
  const label = isRising ? `+${Math.round(delta)}` : `${Math.round(delta)}`;
  const tooltipText = isRising
    ? `Score rising ${Math.round(delta)} pts recently`
    : `Score falling ${Math.abs(Math.round(delta))} pts recently`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tabular-nums cursor-help",
              isRising
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400",
              className,
            )}
          >
            {isRising ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
