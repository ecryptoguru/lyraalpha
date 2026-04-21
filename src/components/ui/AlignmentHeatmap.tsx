"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarketRegime } from "@/lib/engines/market-regime";

interface AlignmentHeatmapProps {
  timeframes: {
    label: string;
    regime: MarketRegime;
    score: number;
  }[];
  className?: string;
}

function AlignmentHeatmapComponent({
  timeframes,
  className = "",
}: AlignmentHeatmapProps) {
  // Calculate alignment score (how similar regimes are across timeframes)
  const calculateAlignment = () => {
    if (timeframes.length < 2) return 100;

    const regimes = timeframes.map((tf) => tf.regime);
    const uniqueRegimes = new Set(regimes);

    // Perfect alignment = all same regime
    if (uniqueRegimes.size === 1) return 100;

    // Calculate score variance
    const scores = timeframes.map((tf) => tf.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) /
      scores.length;

    // Convert variance to alignment (lower variance = higher alignment)
    const alignment = Math.max(0, 100 - variance);
    return alignment;
  };

  const alignmentScore = calculateAlignment();

  // Get color based on regime
  const getRegimeColor = (regime: MarketRegime, score: number) => {
    const intensity = score / 100;

    switch (regime) {
      case "STRONG_RISK_ON":
        return `rgba(34, 197, 94, ${0.3 + intensity * 0.7})`; // emerald
      case "RISK_ON":
        return `rgba(74, 222, 128, ${0.3 + intensity * 0.7})`; // green
      case "NEUTRAL":
        return `rgba(148, 163, 184, ${0.3 + intensity * 0.7})`; // slate
      case "DEFENSIVE":
        return `rgba(251, 191, 36, ${0.3 + intensity * 0.7})`; // amber
      case "RISK_OFF":
        return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`; // rose
      default:
        return `rgba(148, 163, 184, ${0.3 + intensity * 0.7})`;
    }
  };

  const getBorderColor = (regime: MarketRegime) => {
    switch (regime) {
      case "STRONG_RISK_ON":
        return "border-success/40";
      case "RISK_ON":
        return "border-success/40";
      case "NEUTRAL":
        return "border-border/40";
      case "DEFENSIVE":
        return "border-warning/40";
      case "RISK_OFF":
        return "border-danger/40";
      default:
        return "border-white/5";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Regime Alignment
        </span>
        <span
          className={cn(
            "text-xs font-bold tracking-tighter",
            alignmentScore >= 75
              ? "text-success"
              : alignmentScore >= 50
                ? "text-warning"
                : "text-danger",
          )}
        >
          {Math.round(alignmentScore)}%
        </span>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-4 gap-2">
        {timeframes.map((tf, index) => (
          <motion.div
            key={tf.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            className={cn(
              "relative group cursor-pointer rounded-xl border p-2 transition-all duration-300 hover:scale-105",
              getBorderColor(tf.regime),
            )}
            style={{
              backgroundColor: getRegimeColor(tf.regime, tf.score),
            }}
          >
            {/* Label */}
            <div className="text-[8px] font-bold text-foreground/90 uppercase tracking-tight mb-1">
              {tf.label}
            </div>

            {/* Score */}
            <div className="text-[10px] font-bold text-foreground">
              {Math.round(tf.score)}
            </div>

            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl px-2 py-1 shadow-xl whitespace-nowrap">
                <div className="text-[8px] font-bold text-muted-foreground uppercase">
                  {tf.label}
                </div>
                <div className="text-[10px] font-bold text-foreground">
                  {tf.regime.replace(/_/g, " ")}
                </div>
                <div className="text-[9px] font-medium text-muted-foreground">
                  Score: {Math.round(tf.score)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Alignment interpretation */}
      <p className="text-[9px] font-medium text-muted-foreground/70 leading-relaxed italic">
        {alignmentScore >= 75
          ? "Strong cross-timeframe alignment detected. Market structure is coherent."
          : alignmentScore >= 50
            ? "Moderate divergence across timeframes. Monitor for regime shifts."
            : "Significant cross-timeframe divergence. Heightened transition risk."}
      </p>
    </div>
  );
}

export const AlignmentHeatmap = memo(AlignmentHeatmapComponent);
AlignmentHeatmap.displayName = "AlignmentHeatmap";
