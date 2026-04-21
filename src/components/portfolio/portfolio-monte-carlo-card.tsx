"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Activity, Loader2, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanTier } from "@/lib/ai/config";
import type { MCSimulationResult, SimulationMode } from "@/lib/engines/portfolio-monte-carlo";

interface PortfolioMonteCarloCardProps {
  portfolioId: string | null;
  plan: PlanTier;
  onResult?: (result: MCSimulationResult) => void;
}

type Horizon = "20" | "60";

const MODE_LABELS: Record<SimulationMode, string> = {
  A: "Stable Regime",
  B: "Markov Switching",
  C: "Stress Injection",
  D: "Factor Shock",
};

const MODE_DESCRIPTIONS: Record<SimulationMode, string> = {
  A: "Hold current regime constant",
  B: "Full stochastic regime transitions",
  C: "Force RISK_OFF mid-simulation",
  D: "Override factor preferences mid-path",
};

const REGIME_COLORS: Record<string, string> = {
  STRONG_RISK_ON: "bg-success",
  RISK_ON:        "bg-success",
  NEUTRAL:        "bg-cyan-400",
  DEFENSIVE:      "bg-[#FFD700]",
  RISK_OFF:       "bg-danger",
};

const REGIME_TEXT: Record<string, string> = {
  STRONG_RISK_ON: "text-success",
  RISK_ON:        "text-success",
  NEUTRAL:        "text-cyan-400",
  DEFENSIVE:      "text-[#FFD700]",
  RISK_OFF:       "text-danger",
};

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

const DIST_POINTS = [
  { key: "var5",          label: "VaR 5%",  color: "#ef4444", glow: "#ef444440" },
  { key: "p25Return",     label: "P25",     color: "#f97316", glow: "#f9731640" },
  { key: "medianReturn",  label: "Median",  color: "#fbbf24", glow: "#fbbf2440" },
  { key: "p75Return",     label: "P75",     color: "#34d399", glow: "#34d39940" },
  { key: "expectedReturn",label: "Expected",color: "#60a5fa", glow: "#60a5fa40" },
] as const;

function ReturnDistribution({ result }: { result: MCSimulationResult }) {
  const vals = DIST_POINTS.map((p) => result[p.key] as number);
  const min = Math.min(...vals, -0.2);
  const max = Math.max(...vals, 0.2);
  const range = max - min || 0.4;
  const toX = (v: number) => ((v - min) / range) * 100;

  const medX = toX(result.medianReturn);
  const p25X = toX(result.p25Return);
  const p75X = toX(result.p75Return);
  const varX = toX(result.var5);

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Return Distribution</p>

      {/* Distribution bar */}
      <div className="relative h-12 rounded-2xl bg-muted/15 border border-white/5 overflow-hidden">
        {/* IQR band */}
        <motion.div
          className="absolute top-0 bottom-0 bg-warning/10 border-l border-r border-warning/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ left: `${p25X}%`, right: `${100 - p75X}%` }}
        />
        {/* VaR line */}
        <motion.div
          className="absolute top-2 bottom-2 w-0.5 bg-danger rounded-full"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{ left: `${varX}%` }}
        />
        {/* Median line */}
        <motion.div
          className="absolute top-1 bottom-1 w-0.5 bg-warning rounded-full"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{ left: `${medX}%`, filter: "drop-shadow(0 0 4px #fbbf2480)" }}
        />
        {/* Zero line */}
        {min < 0 && max > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/15"
            style={{ left: `${toX(0)}%` }}
          />
        )}
        {/* Labels */}
        <div className="absolute bottom-1 left-1.5 text-[8px] font-bold text-danger">VaR</div>
        <div
          className="absolute bottom-1 text-[8px] font-bold text-warning -translate-x-1/2"
          style={{ left: `${medX}%` }}
        >
          Med
        </div>
      </div>

      {/* Point metrics */}
      <div className="grid grid-cols-5 gap-1">
        {DIST_POINTS.map(({ key, label, color }) => {
          const val = result[key] as number;
          return (
            <div key={key} className="text-center space-y-0.5">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p
                className="text-[11px] font-bold tabular-nums leading-none"
                style={{ color }}
              >
                {formatPct(val)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegimeForecast({ forecast }: { forecast: Record<string, number> }) {
  const entries = Object.entries(forecast).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Regime Forecast</p>
      {entries.map(([regime, prob], i) => (
        <motion.div
          key={regime}
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.06 }}
        >
          <div className={cn("h-2 w-2 rounded-full shrink-0", REGIME_COLORS[regime] ?? "bg-muted")} />
          <span className={cn("text-[10px] flex-1 truncate font-medium", REGIME_TEXT[regime] ?? "text-muted-foreground")}>
            {regime.replace(/_/g, " ")}
          </span>
          <div className="w-24 h-1.5 rounded-full bg-muted/20 overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", REGIME_COLORS[regime] ?? "bg-muted")}
              initial={{ width: 0 }}
              animate={{ width: `${prob * 100}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 + i * 0.06 }}
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums text-foreground w-8 text-right">
            {(prob * 100).toFixed(0)}%
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export function PortfolioMonteCarloCard({ portfolioId, plan, onResult }: PortfolioMonteCarloCardProps) {
  const isPro    = plan === "PRO" || plan === "ELITE" || plan === "ENTERPRISE";
  const isElite  = plan === "ELITE" || plan === "ENTERPRISE";

  const [mode, setMode]         = useState<SimulationMode>("B");
  const [horizon, setHorizon]   = useState<Horizon>("20");
  const [result, setResult]     = useState<MCSimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showModes, setShowModes] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModes) return;
    function handleClickAway(e: MouseEvent) {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setShowModes(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowModes(false);
    }
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModes]);

  const availableModes: SimulationMode[] = isElite ? ["A", "B", "C", "D"] : ["A", "B"];

  async function runSimulation() {
    if (!portfolioId) return;
    setIsRunning(true);
    setError(null);
    try {
      const paths = isElite ? 5000 : 2000;
      const res = await fetch(`/api/portfolio/${portfolioId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, horizon, paths }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error ?? "Simulation failed");
      }
      const data = await res.json() as { simulation: MCSimulationResult };
      setResult(data.simulation);
      onResult?.(data.simulation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setIsRunning(false);
    }
  }

  if (!isPro) {
    return (
      <div className="relative rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 overflow-hidden min-h-[220px] shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
        <div className="blur-sm pointer-events-none select-none opacity-25 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-bold">Monte Carlo Simulation</h3>
          </div>
          <div className="h-12 bg-muted/20 rounded-2xl" />
          <div className="grid grid-cols-5 gap-1">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted/20 rounded-xl" />)}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Activity className="h-5 w-5 text-warning" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Monte Carlo Simulation</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
              RS-MGBM regime-aware path simulation
            </p>
          </div>
          <span className="text-[10px] font-bold text-warning border border-warning/30 bg-warning/10 px-3 py-1.5 rounded-full">
            Pro+ Required
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl p-5 space-y-4 hover:border-warning/20 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Activity className="h-3.5 w-3.5 text-warning" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Monte Carlo</h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted/20 border border-white/5 px-2 py-0.5 rounded-full">RS-MGBM</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mode picker */}
        <div className="relative" ref={modeDropdownRef}>
          <button
            type="button"
            onClick={() => setShowModes(!showModes)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/8 bg-muted/15 text-xs font-medium hover:border-primary/30 hover:bg-muted/25 transition-all"
          >
            <span>{MODE_LABELS[mode]}</span>
            <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", showModes && "rotate-180")} />
          </button>
          {showModes && (
            <div className="absolute top-full left-0 mt-1.5 z-20 w-56 rounded-2xl border border-white/8 bg-card shadow-2xl overflow-hidden">
              {availableModes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setShowModes(false); }}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 text-xs hover:bg-muted/20 transition-colors border-b border-white/5 last:border-0",
                    mode === m && "bg-primary/10 text-primary",
                  )}
                >
                  <p className={cn("font-bold", mode === m ? "text-primary" : "text-foreground")}>{MODE_LABELS[m]}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{MODE_DESCRIPTIONS[m]}</p>
                </button>
              ))}
              {!isElite && (
                <div className="px-3.5 py-2 bg-muted/10">
                  <p className="text-[10px] text-muted-foreground/60">Modes C &amp; D require Elite</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Horizon toggle */}
        <div className="flex rounded-xl border border-white/8 overflow-hidden">
          {(["20", "60"] as Horizon[]).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                horizon === h
                  ? "bg-primary/20 text-primary border-r border-white/8 last:border-r-0"
                  : "bg-transparent text-muted-foreground hover:text-foreground border-r border-white/8 last:border-r-0",
              )}
            >
              {h}d
            </button>
          ))}
        </div>

        <Button
          size="sm"
          onClick={runSimulation}
          disabled={isRunning || !portfolioId}
          className="h-8 text-xs gap-1.5 ml-auto"
        >
          {isRunning ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Running…</>
          ) : (
            <><Activity className="h-3 w-3" />Run</>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      {isRunning && (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-warning/20 animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-warning animate-spin" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Simulating {isElite ? "5,000" : "2,000"} paths…</p>
        </div>
      )}

      {result && !isRunning && (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Return distribution */}
          <ReturnDistribution result={result} />

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                label: "Expected Return",
                value: formatPct(result.expectedReturn),
                sub: `${result.horizon}d horizon`,
                positive: result.expectedReturn >= 0,
                icon: result.expectedReturn >= 0
                  ? <TrendingUp className="h-3.5 w-3.5 text-success" />
                  : <TrendingDown className="h-3.5 w-3.5 text-danger" />,
                color: result.expectedReturn >= 0 ? "text-success" : "text-danger",
              },
              {
                label: "ES 5%",
                value: formatPct(result.es5),
                sub: "Expected shortfall",
                positive: false,
                icon: <TrendingDown className="h-3.5 w-3.5 text-danger" />,
                color: "text-danger",
              },
              {
                label: "Max Drawdown",
                value: `-${result.maxDrawdownMean != null ? (result.maxDrawdownMean * 100).toFixed(1) : "0.0"}%`,
                sub: "Mean across paths",
                positive: false,
                icon: <TrendingDown className="h-3.5 w-3.5 text-warning" />,
                color: "text-warning",
              },
              {
                label: "Fragility",
                value: String(result.fragilityMean?.toFixed(0) ?? "0"),
                sub: "Mean score",
                positive: (result.fragilityMean ?? 0) <= 40,
                icon: <Activity className="h-3.5 w-3.5 text-muted-foreground" />,
                color: (result.fragilityMean ?? 0) <= 25 ? "text-success" :
                       (result.fragilityMean ?? 0) <= 50 ? "text-warning" : "text-danger",
              },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-muted/15 border border-white/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  {m.icon}
                </div>
                <p className={cn("text-lg font-bold tabular-nums leading-none", m.color)}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground/60">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Regime forecast */}
          <RegimeForecast forecast={result.regimeForecast} />

          <p className="text-[10px] text-muted-foreground/50 text-center">
            {result.pathCount.toLocaleString()} paths · {result.horizon}-day horizon · Mode {result.mode}
          </p>
        </motion.div>
      )}

      {!result && !isRunning && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-muted/20 border border-white/5 flex items-center justify-center">
            <Activity className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Ready to simulate</p>
            <p className="text-[10px] text-muted-foreground mt-1">Select mode and horizon, then run</p>
          </div>
        </div>
      )}
    </div>
  );
}
