"use client";

import { cn } from "@/lib/utils";
import { Radar, BarChart3 } from "lucide-react";
import type { MFLookthroughResult, ConcentrationMetrics, StyleAnalysis } from "@/lib/engines/mf-lookthrough";

interface MFLookthroughSnapshotProps {
  lookthrough: MFLookthroughResult;
  className?: string;
}

const SECTOR_COLORS: Record<string, string> = {
  technology: "bg-amber-500",
  financial_services: "bg-emerald-500",
  healthcare: "bg-cyan-500",
  consumer_cyclical: "bg-pink-500",
  consumer_defensive: "bg-teal-500",
  industrials: "bg-slate-500",
  energy: "bg-red-500",
  basic_materials: "bg-orange-500",
  communication_services: "bg-amber-500",
  utilities: "bg-yellow-500",
  realestate: "bg-amber-500",
};

const formatSectorName = (raw: string): string =>
  raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

function StyleAnalysisCard({ style }: { style: StyleAnalysis }) {
  const segments = [
    { label: "Large", pct: style.actualLargeCapPct, color: "bg-amber-500" },
    { label: "Mid", pct: style.actualMidCapPct, color: "bg-amber-500" },
    { label: "Small", pct: style.actualSmallCapPct, color: "bg-pink-500" },
  ].filter((s) => s.pct > 0);

  const totalMapped = segments.reduce((s, seg) => s + seg.pct, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Market Cap Split</span>
        {style.styleDriftDetected && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-amber-500 bg-amber-500/10 border-amber-500/20">
            Style Drift
          </span>
        )}
      </div>
      {totalMapped > 0 && (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted/20">
            {segments.map((s) => (
              <div key={s.label} className={cn("h-full", s.color)} style={{ width: `${(s.pct / totalMapped) * 100}%` }} />
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
        </>
      )}
      {style.styleDriftDetected && style.driftDescription && (
        <p className="text-[10px] text-amber-500/80 leading-relaxed">{style.driftDescription}</p>
      )}
    </div>
  );
}

export function MFLookthroughSnapshot({ lookthrough, className }: MFLookthroughSnapshotProps) {
  const { concentration, sectorBreakdown, styleAnalysis, lookthroughScores } = lookthrough;

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
        {/* Style Analysis (market cap split) */}
        <StyleAnalysisCard style={styleAnalysis} />

        {/* Sector Breakdown */}
        {sectorBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3 text-sky-500" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Sector Exposure
              </span>
            </div>
            {sectorBreakdown.slice(0, 6).map((sw) => {
              const key = sw.sector.toLowerCase().replace(/\s+/g, "_");
              return (
                <div key={sw.sector} className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", SECTOR_COLORS[key] || "bg-foreground/30")} />
                  <span className="text-[9px] font-bold text-muted-foreground w-24 truncate">{formatSectorName(sw.sector)}</span>
                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", SECTOR_COLORS[key] || "bg-foreground/20")} style={{ width: `${Math.min(100, sw.weight)}%` }} />
                  </div>
                  <span className="text-[9px] font-bold text-foreground w-10 text-right">{sw.weight.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Concentration */}
        <ConcentrationBar concentration={concentration} />

        {/* Lookthrough Scores */}
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
