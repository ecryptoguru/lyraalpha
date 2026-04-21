"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ScoreType =
  | "TREND"
  | "MOMENTUM"
  | "VOLATILITY"
  | "LIQUIDITY"
  | "TRUST"
  | "SENTIMENT"
  | "DRS";

const SCORE_META: Record<
  ScoreType,
  { label: string; description: string; higherIsBetter: boolean }
> = {
  TREND: {
    label: "Trend",
    description: "Is the price going up or down over time? Higher = stronger upward trend.",
    higherIsBetter: true,
  },
  MOMENTUM: {
    label: "Momentum",
    description: "Is the price move accelerating or slowing? Higher = picking up speed.",
    higherIsBetter: true,
  },
  VOLATILITY: {
    label: "Volatility",
    description: "How wildly does the price swing? Lower = calmer, more predictable.",
    higherIsBetter: false,
  },
  LIQUIDITY: {
    label: "Liquidity",
    description: "How easy is it to buy or sell this asset? Higher = easier to trade.",
    higherIsBetter: true,
  },
  TRUST: {
    label: "Trust",
    description: "How large and established is this asset? Higher = more institutional backing.",
    higherIsBetter: true,
  },
  SENTIMENT: {
    label: "Sentiment",
    description: "Are recent price moves driven by buying or selling pressure? Higher = more buying.",
    higherIsBetter: true,
  },
  DRS: {
    label: "Signal Strength",
    description: "How unusual is this asset's behavior right now? Higher = more worth investigating.",
    higherIsBetter: true,
  },
};

function getScoreColor(value: number, higherIsBetter: boolean): string {
  const effective = higherIsBetter ? value : 100 - value;
  if (effective >= 70) return "bg-success";
  if (effective >= 40) return "bg-warning";
  return "bg-danger";
}

function getScoreLabel(value: number, higherIsBetter: boolean): string {
  const effective = higherIsBetter ? value : 100 - value;
  if (effective >= 70) return "Strong";
  if (effective >= 40) return "Moderate";
  return "Weak";
}

interface ScoreTooltipProps {
  scoreType: ScoreType;
  value: number;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function ScoreTooltip({
  scoreType,
  value,
  children,
  side = "top",
}: ScoreTooltipProps) {
  const meta = SCORE_META[scoreType];
  if (!meta) return <>{children}</>;

  const colorClass = getScoreColor(value, meta.higherIsBetter);
  const strengthLabel = getScoreLabel(value, meta.higherIsBetter);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className="w-56 max-w-[min(280px,calc(100vw-2rem))] p-3 space-y-2 bg-popover border border-border/60 shadow-xl rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">{meta.label}</span>
            <span className="text-xs font-bold text-foreground">{value}</span>
          </div>
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", colorClass)}
              style={{ width: `${value}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground leading-snug">
              {meta.description}
            </p>
          </div>
          <div className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit",
            value >= 70 && meta.higherIsBetter ? "bg-success/15 text-success" :
            value < 40 && meta.higherIsBetter ? "bg-danger/15 text-danger" :
            "bg-warning/15 text-warning"
          )}>
            {strengthLabel}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
