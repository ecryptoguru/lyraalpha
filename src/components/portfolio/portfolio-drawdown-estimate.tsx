"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { PortfolioHolding } from "@/hooks/use-portfolio";

interface PortfolioDrawdownEstimateProps {
  holdings: PortfolioHolding[];
}

/**
 * Deterministic worst-case 30-day drawdown heuristic.
 *
 * Logic (no LLM, pure math):
 * - Each asset's avg volatility score maps to a β-shaped drawdown factor
 *   (high vol → steeper potential drawdown).
 * - Weighted by portfolio value share.
 * - Multiplied by a concentration penalty when top holding > 25%.
 * - Result clamped to a realistic -5% to -55% range.
 *
 * Volatility score → max 30-day drawdown estimate mapping:
 *   0–25  → 5%  (very low vol)
 *   25–45 → 10%
 *   45–60 → 18%
 *   60–75 → 28%
 *   75–90 → 38%
 *   90+   → 50%
 */

function volToDrawdown(volScore: number | null): number {
  const v = volScore ?? 50;
  if (v < 25) return 5;
  if (v < 45) return 10;
  if (v < 60) return 18;
  if (v < 75) return 28;
  if (v < 90) return 38;
  return 50;
}

export function PortfolioDrawdownEstimate({ holdings }: PortfolioDrawdownEstimateProps) {
  const { drawdown, confidence, hasData } = useMemo(() => {
    const priced = holdings.filter(h => h.asset.price !== null);
    if (!priced.length) return { drawdown: 0, confidence: "low" as const, hasData: false };

    const totalVal = priced.reduce((acc, h) => acc + h.quantity * (h.asset.price ?? 0), 0);
    if (totalVal === 0) return { drawdown: 0, confidence: "low" as const, hasData: false };

    let weightedDrawdown = 0;
    let maxWeight = 0;
    let scoredWeight = 0;

    for (const h of priced) {
      const val = h.quantity * (h.asset.price ?? 0);
      const w = val / totalVal;
      if (w > maxWeight) maxWeight = w;
      if (h.asset.avgVolatilityScore !== null) {
        weightedDrawdown += volToDrawdown(h.asset.avgVolatilityScore) * w;
        scoredWeight += w;
      }
    }

    if (scoredWeight < 0.3) return { drawdown: 0, confidence: "low" as const, hasData: false };

    // Fill unscored weight with neutral 18% assumption
    if (scoredWeight < 1) {
      weightedDrawdown += 18 * (1 - scoredWeight);
    }

    // Concentration penalty: top position > 25% adds up to +5pp
    const concentrationPenalty = maxWeight > 0.25 ? Math.min((maxWeight - 0.25) * 20, 5) : 0;
    const raw = weightedDrawdown + concentrationPenalty;
    const clamped = Math.min(Math.max(raw, 5), 55);

    const confidence: "low" | "medium" | "high" =
      scoredWeight >= 0.8 ? "high" : scoredWeight >= 0.5 ? "medium" : "low";

    return { drawdown: Math.round(clamped), confidence, hasData: true };
  }, [holdings]);

  if (!hasData) return null;

  const severity =
    drawdown >= 35 ? "high" :
    drawdown >= 20 ? "medium" : "low";

  const severityColor =
    severity === "high" ? "text-red-400 border-red-500/20 bg-red-500/8" :
    severity === "medium" ? "text-amber-400 border-amber-500/20 bg-amber-500/8" :
    "text-emerald-400 border-emerald-500/20 bg-emerald-500/8";

  const confidenceLabel = confidence === "high" ? "high confidence" : confidence === "medium" ? "moderate confidence" : "low confidence";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 cursor-help",
            severityColor,
          )}>
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-70 leading-none mb-0.5">
                Est. 30-day drawdown
              </p>
              <p className="text-sm font-bold tabular-nums leading-none">
                up to −{drawdown}%
              </p>
            </div>
            <Info className="h-3 w-3 opacity-50 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
          Heuristic worst-case estimate based on portfolio volatility scores and concentration.
          {" "}{confidenceLabel}. Not a guarantee of actual returns.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
