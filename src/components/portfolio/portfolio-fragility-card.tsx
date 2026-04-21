"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Zap, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PlanTier } from "@/lib/ai/config";
import type { PortfolioHealthSnapshot } from "@/hooks/use-portfolio-health";

interface FragilityData {
  fragilityScore: number;
  fragilityClassification: string;
  fragilityTopDrivers: string[];
  fragilityComponents: {
    volatilityFragility: number;
    correlationFragility: number;
    liquidityFragility: number;
    factorRotationFragility: number;
    concentrationFragility: number;
  };
}

interface PortfolioFragilityCardProps {
  snapshot: PortfolioHealthSnapshot | null;
  isLoading: boolean;
  plan: PlanTier;
}

const COMPONENT_LABELS: Record<string, string> = {
  volatilityFragility: "Volatility Exposure",
  correlationFragility: "Correlation Convergence",
  liquidityFragility: "Liquidity Contraction",
  factorRotationFragility: "Factor Rotation",
  concentrationFragility: "Concentration",
};

function getFragilityConfig(score: number) {
  if (score <= 25) return { color: "#34d399", glow: "#34d39940", bar: "bg-success", text: "text-success", border: "border-success/30 bg-success/10", label: "Resilient" };
  if (score <= 50) return { color: "#00d4ff", glow: "#00d4ff40", bar: "bg-cyan-400",   text: "text-cyan-400",   border: "border-cyan-400/30 bg-cyan-400/10",   label: "Moderate" };
  if (score <= 75) return { color: "#FFD700", glow: "#FFD70040", bar: "bg-[#FFD700]",  text: "text-[#FFD700]",  border: "border-[#FFD700]/30 bg-[#FFD700]/10",  label: "Elevated" };
  return                  { color: "#f87171", glow: "#f8717140", bar: "bg-danger",     text: "text-danger",     border: "border-danger/30 bg-danger/10",         label: "Critical" };
}

function getComponentConfig(score: number) {
  if (score <= 25) return { bar: "bg-success", icon: <TrendingDown className="h-2.5 w-2.5 text-success" /> };
  if (score <= 50) return { bar: "bg-cyan-400",   icon: <Minus className="h-2.5 w-2.5 text-cyan-400" /> };
  if (score <= 75) return { bar: "bg-[#FFD700]",  icon: <TrendingUp className="h-2.5 w-2.5 text-[#FFD700]" /> };
  return                  { bar: "bg-danger",     icon: <TrendingUp className="h-2.5 w-2.5 text-danger" /> };
}

function isFragilityComponents(v: unknown): v is FragilityData["fragilityComponents"] {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.volatilityFragility === "number" &&
    typeof o.correlationFragility === "number" &&
    typeof o.liquidityFragility === "number" &&
    typeof o.factorRotationFragility === "number" &&
    typeof o.concentrationFragility === "number"
  );
}

function extractFragilityData(snapshot: PortfolioHealthSnapshot): FragilityData | null {
  if (!snapshot.fragilityScore || !snapshot.riskMetrics) return null;
  const metrics = snapshot.riskMetrics as Record<string, unknown>;
  const rawComponents = metrics.fragilityComponents;
  return {
    fragilityScore: snapshot.fragilityScore,
    fragilityClassification: typeof metrics.fragilityClassification === "string" ? metrics.fragilityClassification : "Unknown",
    fragilityTopDrivers: Array.isArray(metrics.fragilityTopDrivers) ? (metrics.fragilityTopDrivers as string[]) : [],
    fragilityComponents: isFragilityComponents(rawComponents) ? rawComponents : {
      volatilityFragility: 0,
      correlationFragility: 0,
      liquidityFragility: 0,
      factorRotationFragility: 0,
      concentrationFragility: 0,
    },
  };
}

function FragilityGauge({ score, cfg }: { score: number; cfg: ReturnType<typeof getFragilityConfig> }) {
  const clamp = Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - clamp / 100);

  return (
    <div className="relative flex items-center justify-center w-44 h-24 mx-auto">
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ backgroundColor: cfg.color }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.22, 0.1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg viewBox="0 0 120 68" className="w-full h-full overflow-visible relative z-10">
        <path
          d={`M 8 62 A ${radius} ${radius} 0 0 1 112 62`}
          fill="none" stroke="currentColor" strokeWidth="9"
          className="text-muted/15" strokeLinecap="round"
        />
        {[25, 50, 75].map((pct) => {
          const angle = Math.PI * (pct / 100);
          const x = 60 - radius * Math.cos(angle);
          const y = 62 - radius * Math.sin(angle);
          return <circle key={pct} cx={x} cy={y} r="2" fill="currentColor" className="text-muted/25" />;
        })}
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
      <div className="absolute bottom-0 flex flex-col items-center z-20 pb-1">
        <motion.span
          className="text-4xl font-bold tabular-nums leading-none"
          style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.glow}` }}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring", bounce: 0.3 }}
        >
          {clamp.toFixed(0)}
        </motion.span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

export function PortfolioFragilityCard({ snapshot, isLoading, plan }: PortfolioFragilityCardProps) {
  const isElite = plan === "ELITE" || plan === "ENTERPRISE";

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 bg-muted/30 rounded-full" />
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

  if (!isElite) {
    return (
      <div className="relative rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 overflow-hidden min-h-[260px] shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
        <div className="blur-sm pointer-events-none select-none opacity-30 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-bold">Portfolio Fragility</h3>
          </div>
          <div className="h-24 w-44 bg-muted/20 rounded-2xl mx-auto" />
          <div className="space-y-2">
            {Object.keys(COMPONENT_LABELS).map((k) => (
              <div key={k} className="h-3 bg-muted/30 rounded-full" />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-warning" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Portfolio Fragility Engine</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
              Structural instability analysis under regime deterioration
            </p>
          </div>
          <span className="text-[10px] font-bold text-warning border border-warning/30 bg-warning/10 px-3 py-1.5 rounded-full">
            Elite Only
          </span>
        </div>
      </div>
    );
  }

  const fragility = snapshot ? extractFragilityData(snapshot) : null;

  if (!fragility) {
    return (
      <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="h-12 w-12 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center">
          <Zap className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">No fragility data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add holdings and run a health check</p>
        </div>
      </div>
    );
  }

  const cfg = getFragilityConfig(fragility.fragilityScore);
  const components = Object.entries(fragility.fragilityComponents) as [string, number][];

  return (
    <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 space-y-4 hover:border-warning/20 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.glow }}>
            <Zap className="h-3.5 w-3.5" style={{ color: cfg.color }} />
          </div>
          <h3 className="text-sm font-bold text-foreground">Portfolio Fragility</h3>
        </div>
        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cfg.text, cfg.border)}>
          {fragility.fragilityClassification || cfg.label}
        </span>
      </div>

      {/* Gauge */}
      <FragilityGauge score={fragility.fragilityScore} cfg={cfg} />

      {/* Top drivers */}
      {fragility.fragilityTopDrivers.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-warning/15 bg-warning/5 p-3">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1.5">Top Risk Drivers</p>
            <ul className="space-y-1">
              {fragility.fragilityTopDrivers.map((d) => (
                <li key={d} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-warning/60 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Component bars */}
      <div className="space-y-3 pt-1 border-t border-white/5">
        {components.map(([key, value], i) => {
          const compCfg = getComponentConfig(value ?? 0);
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {compCfg.icon}
                  <span className="text-[11px] text-muted-foreground font-medium">{COMPONENT_LABELS[key] ?? key}</span>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-foreground">{(value ?? 0).toFixed(0)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", compCfg.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${value ?? 0}%` }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.08 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
