"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingUp, AlertTriangle, Shield } from "lucide-react";
import type { PortfolioIntelligenceResult } from "@/lib/engines/portfolio-intelligence";

interface PortfolioIntelligenceHeroProps {
  intelligence: PortfolioIntelligenceResult;
  supportNote?: string | null;
  marketLabel?: string | null;
}

const SIGNAL_ICONS: Record<string, React.ReactNode> = {
  positive: <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
  warning:  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  neutral:  <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
};

const SIGNAL_TONES: Record<string, string> = {
  positive: "border-emerald-500/20 bg-emerald-500/8 text-emerald-100",
  warning:  "border-amber-500/20 bg-amber-500/8 text-amber-100",
  neutral:  "border-white/8 bg-card/50 text-muted-foreground",
};

function getBandConfig(band: string) {
  switch (band) {
    case "Exceptional":
    case "Strong":   return { cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300", glow: "#34d399" };
    case "Balanced": return { cls: "border-amber-500/25 bg-amber-500/10 text-amber-300",       glow: "#fbbf24" };
    default:         return { cls: "border-red-500/25 bg-red-500/10 text-red-300",             glow: "#f87171" };
  }
}

function getComponentColor(value: number): string {
  if (value >= 7)  return "bg-emerald-400";
  if (value >= 5)  return "bg-amber-400";
  if (value >= 3)  return "bg-orange-400";
  return "bg-red-400";
}

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(10, score));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 10);

  const color =
    clamped >= 7 ? "#34d399" :
    clamped >= 5 ? "#fbbf24" :
    clamped >= 3 ? "#fb923c" : "#f87171";

  const glow = color + "50";

  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      {/* ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ backgroundColor: color }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.26, 0.12] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg viewBox="0 0 96 96" className="h-36 w-36 -rotate-90 relative z-10">
        {/* track */}
        <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/15" />
        {/* tick marks */}
        {[2, 4, 6, 8, 10].map((tick) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * tick) / 10;
          const x = 48 + (radius + 6) * Math.cos(angle);
          const y = 48 + (radius + 6) * Math.sin(angle);
          return <circle key={tick} cx={x} cy={y} r="1.5" fill="currentColor" className="text-muted/25" />;
        })}
        {/* fill */}
        <motion.circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: "easeOut", type: "spring", bounce: 0.15 }}
          style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20">
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Score</span>
        <motion.span
          className="text-4xl font-bold tabular-nums tracking-tight leading-none"
          style={{ color, textShadow: `0 0 24px ${glow}` }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", bounce: 0.3 }}
        >
          {clamped.toFixed(1)}
        </motion.span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-0.5">/ 10</span>
      </div>
    </div>
  );
}

export function PortfolioIntelligenceHero({ intelligence, supportNote, marketLabel }: PortfolioIntelligenceHeroProps) {
  const bandCfg = getBandConfig(intelligence.band);

  return (
    <div className="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/8 via-card/70 to-card/50 p-5 shadow-[0_24px_80px_-24px_rgba(2,6,23,0.8)] backdrop-blur-xl">
      {/* Top section: ring + headline */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ScoreRing score={intelligence.score} />
          <div className="space-y-2.5">
            {/* badge row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                Portfolio Intelligence
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]", bandCfg.cls)}>
                {intelligence.band}
              </span>
            </div>
            {/* headline */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1.5">Headline score</p>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl leading-snug">
                {intelligence.headline}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {intelligence.body}
              </p>
            </div>
            {/* meta chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {marketLabel && (
                <span className="rounded-full border border-white/8 bg-card/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {marketLabel}
                </span>
              )}
              <span className="rounded-full border border-white/8 bg-card/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                {intelligence.scoreLabel}: {intelligence.scoreValue}
              </span>
            </div>
          </div>
        </div>

        {/* Right: signal cards + next action */}
        <div className="w-full sm:max-w-xs space-y-2.5">
          {intelligence.signals.slice(0, 4).map((signal, i) => (
            <motion.div
              key={signal.label}
              className={cn("rounded-2xl border px-3 py-2.5 flex items-start gap-2", SIGNAL_TONES[signal.tone] ?? SIGNAL_TONES.neutral)}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.35 }}
            >
              {SIGNAL_ICONS[signal.tone] ?? SIGNAL_ICONS.neutral}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70 mb-0.5">{signal.label}</p>
                <p className="text-xs font-semibold leading-tight">{signal.value}</p>
              </div>
            </motion.div>
          ))}

          {supportNote && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-100 leading-relaxed">{supportNote}</p>
            </div>
          )}

          <div className="rounded-2xl border border-white/8 bg-card/50 p-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-6 w-6 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
                <ArrowRight className="h-3 w-3 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">Next action</p>
                <p className="text-xs leading-relaxed text-foreground">{intelligence.nextAction}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: component bar strip */}
      <div className="mt-5 pt-4 border-t border-white/5 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Diversification", value: intelligence.components.diversification },
          { label: "Resilience",      value: intelligence.components.resilience },
          { label: "Overlap",         value: intelligence.components.overlap },
          { label: "Concentration",   value: intelligence.components.concentration },
          { label: "Performance",     value: intelligence.components.performance },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="rounded-2xl border border-white/8 bg-card/40 p-3 space-y-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</span>
              <span className="text-[11px] font-bold text-foreground tabular-nums">{item.value.toFixed(1)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", getComponentColor(item.value))}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(10, item.value)) * 10}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 + i * 0.06 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
