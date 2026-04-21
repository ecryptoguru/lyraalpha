"use client";

import { memo, useMemo } from "react";
import {
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Activity,
  Clock,
} from "lucide-react";
import { RegimeBadge } from "./RegimeBadge";
import { SparklineChart } from "./SparklineChart";
import { RegimeGauge } from "./RegimeGauge";
import { AlignmentHeatmap } from "./AlignmentHeatmap";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  MarketContextSnapshot,
  MarketRegime,
} from "@/lib/engines/market-regime";

export interface MultiHorizonTimelineProps {
  current: MarketContextSnapshot;
  shortTerm: MarketContextSnapshot;
  mediumTerm: MarketContextSnapshot;
  longTerm: MarketContextSnapshot;
  transitionProbability: number;
  transitionDirection: string;
  leadingIndicators?: string[];
  className?: string;
}

function MultiHorizonTimelineComponent({
  current,
  shortTerm,
  mediumTerm,
  longTerm,
  transitionProbability,
  transitionDirection,
  leadingIndicators = [],
  className,
}: MultiHorizonTimelineProps) {
  const horizons = [
    {
      label: "CURRENT",
      data: current,
      period: "Latest",
      color: "text-success",
    },
    {
      label: "SHORT",
      data: shortTerm,
      period: "5-Day Avg",
      color: "text-warning",
    },
    {
      label: "MEDIUM",
      data: mediumTerm,
      period: "20-Day Avg",
      color: "text-warning",
    },
    {
      label: "LONG",
      data: longTerm,
      period: "60-Day Avg",
      color: "text-muted-foreground",
    },
  ];

  const isTransitioning = transitionProbability > 30;
  const isHighProbability = transitionProbability > 60;

  // Generate deterministic sparkline data (7 data points)
  // In production, this would come from historical API data
  // Using deterministic approach to avoid Math.random() during render
  const sparklineData = useMemo(() => {
    const generateSparklineData = (currentScore: number) => {
      const data = [];
      const baseVariance = 5;

      // Create a deterministic pattern based on the score
      for (let i = 0; i < 7; i++) {
        // Use sine wave for deterministic variation
        const variation = Math.sin((i + currentScore) / 10) * baseVariance;
        const trend = (i - 3) * 1.5; // Slight upward trend toward current
        const value = Math.max(
          0,
          Math.min(100, currentScore - 10 + trend + variation),
        );
        data.push(value);
      }
      return data;
    };

    return {
      current: generateSparklineData(current.regime.score),
      shortTerm: generateSparklineData(shortTerm.regime.score),
      mediumTerm: generateSparklineData(mediumTerm.regime.score),
      longTerm: generateSparklineData(longTerm.regime.score),
    };
  }, [
    current.regime.score,
    shortTerm.regime.score,
    mediumTerm.regime.score,
    longTerm.regime.score,
  ]);

  // Get color for sparkline based on regime
  const getSparklineColor = (regime: MarketRegime) => {
    switch (regime) {
      case "STRONG_RISK_ON":
        return "rgb(34, 197, 94)"; // emerald-500
      case "RISK_ON":
        return "rgb(74, 222, 128)"; // green-400
      case "NEUTRAL":
        return "rgb(148, 163, 184)"; // slate-400
      case "DEFENSIVE":
        return "rgb(251, 191, 36)"; // amber-400
      case "RISK_OFF":
        return "rgb(239, 68, 68)"; // rose-500
      default:
        return "rgb(148, 163, 184)";
    }
  };

  return (
    <div
      className={cn(
        "bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl p-6 rounded-3xl relative overflow-hidden group",
        className,
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -z-10 group-hover:bg-primary/10 transition-colors" />

      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Multi-Horizon Regime Analysis
          </h3>
          <p className="text-[10px] text-muted-foreground font-medium">
            CROSS-TIMEFRAME ENVIRONMENT SCAN
          </p>
        </div>

        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "px-3 py-1 rounded-full border flex items-center gap-1.5 animate-pulse",
              isHighProbability
                ? "bg-danger/10 border-danger/20 text-danger"
                : "bg-warning/10 border-warning/20 text-warning",
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {isHighProbability
                ? "Critical Transition"
                : "Regime Shift Warning"}
            </span>
          </motion.div>
        )}
      </div>

      {/* Enhanced Timeline Grid with Sparklines and Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {horizons.map((horizon, index) => (
          <motion.div
            key={horizon.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="relative"
          >
            <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/20 hover:bg-muted/30 hover:border-white/5 transition-all duration-300 hover:shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
                    {horizon.label}
                  </p>
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">
                      {horizon.period}
                    </p>
                  </div>
                </div>
                <RegimeGauge
                  value={horizon.data.regime.score}
                  size="sm"
                  showValue={false}
                />
              </div>

              <div className="py-1 flex justify-center">
                <RegimeBadge
                  regime={horizon.data.regime.label as MarketRegime}
                  size="sm"
                />
              </div>

              {/* Sparkline */}
              <div className="flex justify-center pt-2 border-t border-border/10">
                <SparklineChart
                  data={
                    sparklineData[
                      horizon.label.toLowerCase() === "current"
                        ? "current"
                        : horizon.label.toLowerCase() === "short"
                          ? "shortTerm"
                          : horizon.label.toLowerCase() === "medium"
                            ? "mediumTerm"
                            : "longTerm"
                    ]
                  }
                  color={getSparklineColor(
                    horizon.data.regime.label as MarketRegime,
                  )}
                  height={28}
                  width={100}
                />
              </div>

              {/* Mini Indicators */}
              <div className="grid grid-cols-2 gap-1 pt-2 border-t border-border/10">
                <div className="space-y-0.5">
                  <p className="text-[7px] font-bold text-muted-foreground/40 uppercase">
                    Risk
                  </p>
                  <p className="text-[8px] font-bold text-foreground/80 truncate uppercase">
                    {horizon.data.risk.label.replace("RISK_", "")}
                  </p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[7px] font-bold text-muted-foreground/40 uppercase">
                    Vol
                  </p>
                  <p className="text-[8px] font-bold text-foreground/80 truncate uppercase">
                    {horizon.data.volatility.label}
                  </p>
                </div>
              </div>
            </div>

            {index < horizons.length - 1 && (
              <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                <ArrowRight className="h-4 w-4 text-muted-foreground/20" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Alignment Heatmap */}
      <div className="mb-6 p-4 rounded-2xl bg-muted/10 border border-border/20">
        <AlignmentHeatmap
          timeframes={horizons.map((h) => ({
            label: h.label,
            regime: h.data.regime.label as MarketRegime,
            score: h.data.regime.score,
          }))}
        />
      </div>

      {/* Transition Intelligence Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
        {/* Probability Meter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Shift Probability
            </span>
            <span
              className={cn(
                "text-sm font-bold tracking-tighter",
                isHighProbability
                  ? "text-danger"
                  : isTransitioning
                    ? "text-warning"
                    : "text-success",
              )}
            >
              {transitionProbability.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${transitionProbability}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                isHighProbability
                  ? "bg-danger"
                  : isTransitioning
                    ? "bg-warning"
                    : "bg-success",
              )}
            />
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/70 leading-relaxed italic">
            {isTransitioning
              ? `Detection of structural divergence toward ${transitionDirection.replace("_", " ")} environment.`
              : "Market mechanics remain aligned with established regime structure."}
          </p>
        </div>

        {/* Leading Indicators */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Leading Indicators
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadingIndicators.length > 0 ? (
              leadingIndicators.map((indicator) => (
                <span
                  key={indicator}
                  className="text-[9px] font-bold px-2.5 py-1 rounded-xl bg-primary/5 text-primary border border-primary/10 uppercase tracking-tight"
                >
                  {indicator}
                </span>
              ))
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground/40 italic uppercase tracking-tighter">
                No divergence detected
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const MultiHorizonTimeline = memo(
  MultiHorizonTimelineComponent,
  (
    prevProps: MultiHorizonTimelineProps,
    nextProps: MultiHorizonTimelineProps,
  ) => {
    // Custom comparison for deep equality on critical props
    return (
      prevProps.transitionProbability === nextProps.transitionProbability &&
      prevProps.transitionDirection === nextProps.transitionDirection &&
      prevProps.current.regime.score === nextProps.current.regime.score &&
      prevProps.shortTerm.regime.score === nextProps.shortTerm.regime.score &&
      prevProps.mediumTerm.regime.score === nextProps.mediumTerm.regime.score &&
      prevProps.longTerm.regime.score === nextProps.longTerm.regime.score
    );
  },
);

MultiHorizonTimeline.displayName = "MultiHorizonTimeline";
