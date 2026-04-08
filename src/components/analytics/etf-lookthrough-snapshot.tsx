"use client";

import { cn } from "@/lib/utils";
import { Radar, Globe, BarChart3 } from "lucide-react";
import type { ETFLookthroughResult, ConcentrationMetrics, GeographicExposure } from "@/lib/engines/etf-lookthrough";

interface ETFLookthroughSnapshotProps {
  lookthrough: ETFLookthroughResult;
  className?: string;
}

const FACTOR_LABELS: Record<string, string> = {
  value: "Value",
  growth: "Growth",
  momentum: "Momentum",
  quality: "Quality",
  size: "Size",
};

const FACTOR_COLORS: Record<string, string> = {
  value: "bg-amber-500",
  growth: "bg-emerald-500",
  momentum: "bg-amber-500",
  quality: "bg-cyan-500",
  size: "bg-pink-500",
};

function FactorBar({ factor, value, max }: { factor: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider w-16 shrink-0">
        {FACTOR_LABELS[factor] || factor}
      </span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", FACTOR_COLORS[factor] || "bg-foreground/30")}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-foreground w-8 text-right">{value}</span>
    </div>
  );
}

function ConcentrationBar({ concentration }: { concentration: ConcentrationMetrics }) {
  const levelColors = {
    low: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    moderate: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    high: "text-red-500 bg-red-500/10 border-red-500/20",
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Concentration</span>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", levelColors[concentration.level])}>
          {concentration.level}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{concentration.top1Weight.toFixed(1)}%</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase">Top 1</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{concentration.top5Weight.toFixed(1)}%</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase">Top 5</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{concentration.top10Weight.toFixed(1)}%</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase">Top 10</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{concentration.hhi.toFixed(3)}</p>
          <p className="text-[8px] text-muted-foreground font-bold uppercase">HHI</p>
        </div>
      </div>
    </div>
  );
}

function GeoExposure({ geographic }: { geographic: GeographicExposure }) {
  const total = geographic.US + geographic.IN + geographic.other;
  if (total <= 0) return null;

  const segments = [
    { label: "US", pct: geographic.US, color: "bg-amber-500" },
    { label: "IN", pct: geographic.IN, color: "bg-emerald-500" },
    { label: "Other", pct: geographic.other, color: "bg-muted-foreground/30" },
  ].filter((s) => s.pct > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-sky-500" />
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Geographic</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {geographic.matchedCount}/{geographic.totalCount} matched
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/20">
        {segments.map((s) => (
          <div key={s.label} className={cn("h-full", s.color)} style={{ width: `${s.pct}%` }} />
        ))}
      </div>
      <div className="flex gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", s.color)} />
            <span className="text-[9px] font-bold text-muted-foreground">{s.label} {s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ETFLookthroughSnapshot({ lookthrough, className }: ETFLookthroughSnapshotProps) {
  const { factorExposure, concentration, geographic, lookthroughScores } = lookthrough;
  const maxFactor = Math.max(factorExposure.value, factorExposure.growth, factorExposure.momentum, factorExposure.quality, factorExposure.size, 1);

  return (
    <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-3xl border border-white/5 bg-card/60 backdrop-blur-2xl overflow-hidden", className)}>
      <div className="px-5 py-3 border-b border-border/30 flex items-center gap-2">
        <Radar className="w-4 h-4 text-sky-500" />
        <h3 className="text-sm font-bold text-foreground">Lookthrough Analysis</h3>
        {lookthroughScores.matchRate > 0 && (
          <span className="ml-auto text-[9px] font-bold text-muted-foreground">
            {lookthroughScores.matchRate.toFixed(0)}% holdings matched
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Factor Exposure */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-sky-500" />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Factor Exposure
            </span>
            <span className="ml-auto text-[9px] text-muted-foreground italic">
              Dominant: {FACTOR_LABELS[factorExposure.dominant] || factorExposure.dominant}
            </span>
          </div>
          {(["value", "growth", "momentum", "quality", "size"] as const).map((f) => (
            <FactorBar key={f} factor={f} value={factorExposure[f]} max={maxFactor} />
          ))}
        </div>

        {/* Concentration */}
        <ConcentrationBar concentration={concentration} />

        {/* Geographic */}
        <GeoExposure geographic={geographic} />

        {/* Lookthrough Scores Summary */}
        {lookthroughScores.weightedAvg != null && (
          <div className="pt-3 border-t border-border/30">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              Weighted Constituent Scores
            </span>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "trend", label: "Trend" },
                { key: "momentum", label: "Mom." },
                { key: "volatility", label: "Vol." },
                { key: "sentiment", label: "Sent." },
                { key: "liquidity", label: "Liq." },
                { key: "trust", label: "Trust" },
              ] as const).map(({ key, label }) => {
                const val = lookthroughScores[key];
                if (val == null) return null;
                return (
                  <div key={key} className="text-center p-1.5 rounded-2xl bg-background/30">
                    <p className="text-sm font-bold text-foreground">{val.toFixed(0)}</p>
                    <p className="text-[8px] text-muted-foreground font-bold uppercase">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
