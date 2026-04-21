"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { PortfolioHolding } from "@/hooks/use-portfolio";

interface PortfolioRegimeAlignmentBarProps {
  holdings: PortfolioHolding[];
}

/**
 * Deterministic regime alignment bar.
 * Uses pre-computed compatibilityScore on each holding's asset.
 * Aligned   = compatibilityScore >= 60 (Good Fit / Strong Fit)
 * Neutral   = compatibilityScore 40–59 (Mixed Fit)
 * Misaligned= compatibilityScore < 40  (Weak Fit / Poor Fit)
 */
export function PortfolioRegimeAlignmentBar({ holdings }: PortfolioRegimeAlignmentBarProps) {
  const { alignedPct, neutralPct, misalignedPct, alignedCount, misalignedCount, hasData } = useMemo(() => {
    if (!holdings.length) return { alignedPct: 0, neutralPct: 0, misalignedPct: 0, alignedCount: 0, misalignedCount: 0, hasData: false };

    let aligned = 0, neutral = 0, misaligned = 0, scored = 0;

    for (const h of holdings) {
      const val = h.asset.price !== null ? h.quantity * h.asset.price : null;
      if (val === null) continue;
      const score = h.asset.compatibilityScore;
      if (score === null) continue;
      scored += val;
      if (score >= 60) aligned += val;
      else if (score >= 40) neutral += val;
      else misaligned += val;
    }

    if (scored === 0) return { alignedPct: 0, neutralPct: 0, misalignedPct: 0, alignedCount: 0, misalignedCount: 0, hasData: false };

    const alignedCount = holdings.filter(h => (h.asset.compatibilityScore ?? 0) >= 60).length;
    const misalignedCount = holdings.filter(h => (h.asset.compatibilityScore ?? 100) < 40).length;

    // Largest-remainder rounding — ensures the three segments always sum to exactly 100
    const rawAligned = (aligned / scored) * 100;
    const rawNeutral = (neutral / scored) * 100;
    const rawMisaligned = (misaligned / scored) * 100;
    const floors = [Math.floor(rawAligned), Math.floor(rawNeutral), Math.floor(rawMisaligned)];
    const remainders = [rawAligned - floors[0], rawNeutral - floors[1], rawMisaligned - floors[2]];
    let remainder = 100 - floors.reduce((a, b) => a + b, 0);
    const sorted = remainders.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r);
    for (const { i } of sorted) {
      if (remainder <= 0) break;
      floors[i]++;
      remainder--;
    }

    return {
      alignedPct: floors[0],
      neutralPct: floors[1],
      misalignedPct: floors[2],
      alignedCount,
      misalignedCount,
      hasData: true,
    };
  }, [holdings]);

  if (!hasData) return null;

  const dominantLabel =
    alignedPct >= 60 ? "Well Aligned" :
    misalignedPct >= 40 ? "Regime Risk" : "Mixed Alignment";

  const dominantColor =
    alignedPct >= 60 ? "text-success" :
    misalignedPct >= 40 ? "text-danger" : "text-warning";

  return (
    <TooltipProvider>
      <div className="rounded-2xl border border-white/8 bg-card/40 px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {misalignedPct >= 40
              ? <ShieldAlert className="h-3.5 w-3.5 text-danger shrink-0" />
              : <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
            }
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Regime Alignment
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                % of portfolio value aligned with the current market regime based on each asset&apos;s compatibility score.
              </TooltipContent>
            </Tooltip>
          </div>
          <span className={cn("text-[11px] font-bold", dominantColor)}>{dominantLabel}</span>
        </div>

        {/* Stacked bar */}
        <div className="h-2 w-full rounded-full overflow-hidden flex bg-muted/20">
          {alignedPct > 0 && (
            <motion.div
              className="h-full bg-success rounded-l-full"
              style={{ width: `${alignedPct}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${alignedPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
          {neutralPct > 0 && (
            <motion.div
              className="h-full bg-warning"
              style={{ width: `${neutralPct}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${neutralPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
          )}
          {misalignedPct > 0 && (
            <motion.div
              className="h-full bg-danger rounded-r-full"
              style={{ width: `${misalignedPct}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${misalignedPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          )}
        </div>

        {/* Legend row */}
        <div className="flex items-center gap-4 text-[10px] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success shrink-0" />
            <span className="text-success">{alignedPct}%</span>
            <span className="text-muted-foreground/60">aligned</span>
            {alignedCount > 0 && <span className="text-muted-foreground/40">({alignedCount})</span>}
          </span>
          {neutralPct > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
              <span className="text-warning">{neutralPct}%</span>
              <span className="text-muted-foreground/60">neutral</span>
            </span>
          )}
          {misalignedPct > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger shrink-0" />
              <span className="text-danger">{misalignedPct}%</span>
              <span className="text-muted-foreground/60">misaligned</span>
              {misalignedCount > 0 && <span className="text-muted-foreground/40">({misalignedCount})</span>}
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
