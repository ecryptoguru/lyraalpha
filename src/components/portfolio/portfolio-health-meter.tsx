"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Shield, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PortfolioHealthSnapshot } from "@/hooks/use-portfolio-health";
import { getHealthBand, getHealthBandColor } from "@/hooks/use-portfolio-health";
import type { PlanTier } from "@/lib/ai/config";

interface PortfolioHealthMeterProps {
  snapshot: PortfolioHealthSnapshot | null;
  isLoading: boolean;
  plan: PlanTier;
}

const DIMENSION_LABELS: Record<string, string> = {
  diversificationScore: "Diversification",
  concentrationScore: "Concentration",
  volatilityScore: "Volatility Control",
  correlationScore: "Correlation Risk",
  qualityScore: "Quality & Trust",
};

const DIMENSION_TOOLTIPS: Record<string, string> = {
  diversificationScore: "Asset class and sector spread. Higher = better diversified.",
  concentrationScore: "Penalty for over-concentration in top holdings.",
  volatilityScore: "Weighted volatility exposure across holdings.",
  correlationScore: "Estimated correlation between holdings. Lower correlation = better.",
  qualityScore: "Weighted trust and liquidity quality of holdings.",
};

function getBandConfig(band: string) {
  switch (band) {
    case "Strong":   return { color: "#34d399", glow: "#34d39940", label: "Strong",   bg: "bg-success/10 border-success/30 text-success" };
    case "Balanced": return { color: "#00d4ff", glow: "#00d4ff40", label: "Balanced", bg: "bg-cyan-400/10 border-cyan-400/30 text-cyan-400" };
    case "Fragile":  return { color: "#FFD700", glow: "#FFD70040", label: "Fragile",  bg: "bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]" };
    default:         return { color: "#f87171", glow: "#f8717140", label: "Weak",     bg: "bg-danger/10 border-danger/30 text-danger" };
  }
}

function getDimBarColor(score: number) {
  if (score >= 70) return { bar: "bg-success", glow: "shadow-[0_0_8px_#34d39960]" };
  if (score >= 50) return { bar: "bg-cyan-400",   glow: "shadow-[0_0_8px_#00d4ff60]" };
  if (score >= 35) return { bar: "bg-[#FFD700]",  glow: "shadow-[0_0_8px_#FFD70060]" };
  return                   { bar: "bg-danger",    glow: "shadow-[0_0_8px_#f8717160]" };
}

function getDimIcon(score: number) {
  if (score >= 60) return <TrendingUp className="h-2.5 w-2.5 text-success" />;
  if (score >= 40) return <Minus className="h-2.5 w-2.5 text-cyan-400" />;
  return <TrendingDown className="h-2.5 w-2.5 text-danger" />;
}

function ScoreArc({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const band = getHealthBand(clampedScore);
  const cfg = getBandConfig(band);

  const radius = 54;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - clampedScore / 100);

  return (
    <div className="relative flex items-center justify-center w-44 h-24 mx-auto">
      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ backgroundColor: cfg.color }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.28, 0.12] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg viewBox="0 0 120 68" className="w-full h-full overflow-visible relative z-10">
        {/* Track */}
        <path
          d={`M 8 62 A ${radius} ${radius} 0 0 1 112 62`}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          className="text-muted/15"
          strokeLinecap="round"
        />
        {/* Segment ticks */}
        {[25, 50, 75].map((pct) => {
          const angle = Math.PI * (pct / 100);
          const x = 60 - radius * Math.cos(angle);
          const y = 62 - radius * Math.sin(angle);
          return <circle key={pct} cx={x} cy={y} r="2" fill="currentColor" className="text-muted/30" />;
        })}
        {/* Fill arc */}
        <motion.path
          d={`M 8 62 A ${radius} ${radius} 0 0 1 112 62`}
          fill="none"
          stroke={cfg.color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.6, ease: "easeOut", type: "spring", bounce: 0.15 }}
          style={{ filter: `drop-shadow(0 0 8px ${cfg.glow})` }}
        />
      </svg>
      {/* Center readout */}
      <div className="absolute bottom-0 flex flex-col items-center z-20 pb-1">
        <motion.span
          className="text-4xl font-bold tabular-nums leading-none"
          style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.glow}` }}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring", bounce: 0.3 }}
        >
          {clampedScore.toFixed(0)}
        </motion.span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function DimensionBar({
  label,
  score,
  tooltip,
  blurred,
}: {
  label: string;
  score: number;
  tooltip: string;
  blurred: boolean;
}) {
  const { bar, glow } = getDimBarColor(score);

  return (
    <div className={cn("space-y-1.5", blurred && "blur-sm pointer-events-none select-none")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getDimIcon(score)}
          <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-2.5 w-2.5 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-[11px] font-bold tabular-nums text-foreground">{score.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", bar, glow)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}

export function PortfolioHealthMeter({ snapshot, isLoading, plan }: PortfolioHealthMeterProps) {
  const showDimensions = plan !== "STARTER";

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-muted/30 rounded-full" />
          <div className="h-5 w-16 bg-muted/20 rounded-full" />
        </div>
        <div className="h-24 w-44 bg-muted/20 rounded-2xl mx-auto" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-28 bg-muted/20 rounded-full" />
              <div className="h-1.5 bg-muted/15 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="h-12 w-12 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center">
          <Shield className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">No health data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add holdings and run a health check</p>
        </div>
      </div>
    );
  }

  const band = getHealthBand(snapshot.healthScore);
  const cfg = getBandConfig(band);
  void getHealthBandColor;

  const dimensions = [
    { key: "diversificationScore", value: snapshot.diversificationScore },
    { key: "concentrationScore",   value: snapshot.concentrationScore },
    { key: "volatilityScore",      value: snapshot.volatilityScore },
    { key: "correlationScore",     value: snapshot.correlationScore },
    { key: "qualityScore",         value: snapshot.qualityScore },
  ];

  return (
    <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 space-y-4 hover:border-primary/25 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.glow }}>
            <Shield className="h-3.5 w-3.5" style={{ color: cfg.color }} />
          </div>
          <h3 className="text-sm font-bold text-foreground">Portfolio Health</h3>
        </div>
        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cfg.bg)}>
          {cfg.label}
        </span>
      </div>

      {/* Arc */}
      <ScoreArc score={snapshot.healthScore} />

      {/* Last computed */}
      <p className="text-[10px] text-center text-muted-foreground/60">
        Last computed {new Date(snapshot.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </p>

      {/* Dimension bars */}
      <div className="space-y-3 pt-1 border-t border-white/5">
        {dimensions.map(({ key, value }) => (
          <DimensionBar
            key={key}
            label={DIMENSION_LABELS[key] ?? key}
            score={value}
            tooltip={DIMENSION_TOOLTIPS[key] ?? ""}
            blurred={!showDimensions}
          />
        ))}
      </div>

      {!showDimensions && (
        <div className="rounded-2xl border border-white/8 bg-muted/10 px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Upgrade to <span className="font-bold text-primary">Pro</span> to unlock dimension breakdown
          </p>
        </div>
      )}
    </div>
  );
}
