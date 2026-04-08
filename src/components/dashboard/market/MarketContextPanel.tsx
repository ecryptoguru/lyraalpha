"use client";

import { useMemo } from "react";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { cn } from "@/lib/utils";
import {
  Info,
  ShieldCheck,
  Waves,
  BarChart3,
  Activity,
} from "lucide-react";

interface MarketContextPanelProps {
  context: MarketContextSnapshot | null;
}

export function MarketContextPanel({ context }: MarketContextPanelProps) {
  const safeContext = context ?? null;

  const getStatusColor = (level: string | undefined) => {
    if (!level) return "text-slate-400 bg-slate-400/10 border-slate-400/20";

    const positive = new Set([
      "STRONG_RISK_ON",
      "RISK_ON",
      "SUPPRESSED",
      "STABLE",
      "VERY_BROAD",
      "BROAD",
      "VERY_STRONG",
      "STRONG",
      "RISK_EMBRACING",
      "RISK_SEEKING",
    ]);
    const neutral = new Set(["NEUTRAL", "NORMAL", "MIXED", "ADEQUATE", "BALANCED"]);
    const warning = new Set(["DEFENSIVE", "ELEVATED", "WEAK", "THIN", "CAUTIOUS"]);
    const critical = new Set([
      "RISK_OFF",
      "STRESS",
      "NARROW",
      "FRAGILE",
      "RISK_AVERSION",
    ]);

    if (positive.has(level)) {
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    }
    if (neutral.has(level)) {
      return "text-slate-300 bg-slate-400/10 border-slate-400/20";
    }
    if (warning.has(level)) {
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    }
    if (critical.has(level)) {
      return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    }
    return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  };

  const formatLabel = (label: string | undefined) => label?.replace(/_/g, " ") || "Unknown";
  const regimeScore = Math.max(0, Math.min(100, Math.round(safeContext?.regime.score ?? 50)));
  const parsedConfidence = typeof safeContext?.regime.confidence === "number"
    ? safeContext.regime.confidence
    : Number(safeContext?.regime.confidence ?? 50);
  const regimeConfidence = Math.max(0, Math.min(100, Math.round(Number.isFinite(parsedConfidence) ? parsedConfidence : 50)));
  const referenceId = safeContext?.lastUpdated && typeof safeContext.lastUpdated === "string"
    ? safeContext.lastUpdated.split("T")[0]?.replace(/-/g, "")
    : "N/A";

  const detailMetrics = useMemo(() => {
    if (!safeContext) return [];

    const items = [
      {
        key: "volatility",
        icon: <Waves className="h-4 w-4" />,
        label: "Volatility Dynamics",
        value: formatLabel(safeContext.volatility?.label),
        score: safeContext.volatility?.score ?? 50,
        drivers: safeContext.volatility?.drivers || ["No data"],
        statusClass: getStatusColor(safeContext.volatility?.label),
      },
      {
        key: "risk",
        icon: <ShieldCheck className="h-4 w-4" />,
        label: "Risk Sentiment",
        value: formatLabel(safeContext.risk?.label),
        score: safeContext.risk?.score ?? 50,
        drivers: safeContext.risk?.drivers || ["No data"],
        statusClass: getStatusColor(safeContext.risk?.label),
      },
      {
        key: "breadth",
        icon: <BarChart3 className="h-4 w-4" />,
        label: "Breadth Index",
        value: formatLabel(safeContext.breadth?.label),
        score: safeContext.breadth?.score ?? 50,
        drivers: safeContext.breadth?.drivers || ["No data"],
        statusClass: getStatusColor(safeContext.breadth?.label),
      },
    ];

    if (safeContext.liquidity) {
      items.push({
        key: "liquidity",
        icon: <Activity className="h-4 w-4" />,
        label: "Liquidity Capacity",
        value: formatLabel(safeContext.liquidity.label),
        score: safeContext.liquidity.score ?? 50,
        drivers: safeContext.liquidity.drivers || ["No data"],
        statusClass: getStatusColor(safeContext.liquidity.label),
      });
    }

    return items;
  }, [safeContext]);

  if (!safeContext) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Market context unavailable
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-2">
      {/* Premium Header - Hyper Compact */}
      <div className="flex flex-col gap-1 relative">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
          <h2 className="text-xl font-bold uppercase premium-gradient-text tracking-tighter">
            Market Context Engine
          </h2>
        </div>
        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-80 pl-3">
          Institutional Analysis Layer • v4.2.1 • MARKET INTELLIGENCE
        </p>
      </div>

      <div className="grid flex-1 auto-rows-fr gap-2.5 sm:gap-3 md:grid-cols-2">
        {/* Primary Regime Card - Hyper Compact */}
        <div className="md:col-span-2 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 shadow-xl backdrop-blur-2xl relative overflow-hidden group sm:p-4 md:p-6">
          {/* Subtle Background Accent */}
          <div className="absolute -top-12 -right-12 h-64 w-64 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/20 transition-all duration-1000" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 min-w-0">
            <div className="space-y-3 max-w-2xl min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em] bg-primary/20 px-2.5 py-0.5 rounded-full border border-primary/20">
                  Execution Framework
                </span>
                <span className="text-[8px] font-bold text-muted-foreground opacity-80 uppercase tracking-widest flex items-center gap-1.5">
                  Confidence:{" "}
                  <span className="text-foreground font-bold">
                    {regimeConfidence}
                  </span>
                </span>
              </div>

              <div className="space-y-0.5">
                <h3 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase leading-none text-foreground drop-shadow-lg truncate">
                  {formatLabel(safeContext.regime.label)}
                </h3>
              </div>
              <p className="text-sm font-bold text-muted-foreground leading-snug max-w-xl">
                {safeContext.regime.drivers?.[0] || "No drivers available"}
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[180px] min-w-0">
              <div
                className={cn(
                  "p-4 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all shadow-md",
                  getStatusColor(safeContext.regime.label),
                )}
              >
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-80">
                  Regime Score
                </span>
                <span className="text-4xl font-bold tabular-nums tracking-tighter">
                  {regimeScore}
                </span>
              </div>
              <div className="w-full flex items-center justify-center text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-4 py-2.5 rounded-2xl border border-white/5 bg-background/50 backdrop-blur-2xl">
                Historical drift unavailable
              </div>
            </div>
          </div>
        </div>

        {/* Dimension Grid - Hyper Density */}
        {detailMetrics.map((metric) => (
          <DetailMetric
            key={metric.key}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            score={metric.score}
            drivers={metric.drivers}
            statusClass={metric.statusClass}
          />
        ))}
      </div>

      {/* Interpretive Note - Hyper Compact */}
      <div className="rounded-2xl border border-white/5 bg-background/40 p-3 backdrop-blur-2xl transition-all shadow-md group hover:border-primary/30 sm:p-3.5 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="p-2 bg-primary/10 rounded-2xl border border-primary/20">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-0.5 flex-1 text-center md:text-left">
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary">
            Compliance & Interpretive Constraints
          </p>
          <p className="text-[10px] font-bold leading-tight text-muted-foreground opacity-90 max-w-4xl">
            Signals derived from deterministic multi-asset aggregates via MCE
            Engine v4. Signals are non-directional and reflect signal stability
            across primary exchange baskets.
          </p>
        </div>
        <div className="text-[8px] font-mono font-bold text-muted-foreground/30 whitespace-nowrap bg-muted/10 px-2 py-1 rounded-xl">
          REF_ID: {referenceId}
        </div>
      </div>
    </div>
  );
}

function DetailMetric({
  icon,
  label,
  value,
  score,
  drivers,
  statusClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  score: number;
  drivers: string[];
  statusClass: string;
}) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const progressBarClass = statusClass.split(" ")[0].replace("text-", "bg-");

  return (
    <div className="flex h-full min-h-[170px] flex-col space-y-2.5 rounded-2xl border border-white/5 bg-card/60 p-3.5 shadow-xl backdrop-blur-2xl transition-all duration-300 group hover:translate-y-[-2px] hover:shadow-primary/5 sm:min-h-[180px] sm:space-y-3 sm:p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div
            className={cn(
              "p-2.5 rounded-2xl border w-fit transition-transform group-hover:rotate-[5deg] duration-500 shadow-inner",
              statusClass,
            )}
          >
            {icon}
          </div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
            {label}
          </p>
        </div>
        <div className="text-right space-y-0">
          <span className="text-[8px] font-mono font-bold text-muted-foreground tracking-widest uppercase">
            Mag.
          </span>
          <div className="text-2xl font-bold tracking-tighter tabular-nums text-foreground">
            {clampedScore}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 min-w-0">
        <div className="flex items-end justify-between gap-2 min-w-0">
          <h4 className="text-lg font-bold tracking-tight uppercase leading-none text-foreground truncate min-w-0">
            {value}
          </h4>
          <span className="text-[8px] font-bold text-muted-foreground opacity-80 uppercase tracking-widest tabular-nums">
            {clampedScore}%
          </span>
        </div>
        <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden shadow-inner">
          <div
            className={cn(
              "h-full transition-all duration-2000 shadow-[0_0_6px_rgba(var(--primary),0.3)]",
              progressBarClass,
            )}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border/10 mt-auto">
        <ul className="space-y-1.5">
          {drivers.map((driver, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[10px] font-bold leading-tight text-muted-foreground hover:text-foreground transition-colors group/item"
            >
              <div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0 shadow-xs shadow-primary/50 group-hover/item:scale-125 transition-transform" />
              {driver}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
