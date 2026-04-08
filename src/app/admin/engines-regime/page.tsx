"use client";

import React, { useState } from "react";
import { useAdminEngines, useAdminRegime } from "@/hooks/use-admin";
import { Loader2, ShieldAlert, Cpu, Target, Layers, Activity, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const EngineScoreChart = dynamic(() => import("../_charts/engines-charts").then(m => m.EngineScoreChart), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" /> });
const CompatibilityChart = dynamic(() => import("../_charts/engines-charts").then(m => m.CompatibilityChart), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> });

const SCORE_COLORS: Record<string, string> = {
  TREND: "#3b82f6", MOMENTUM: "#22c55e", VOLATILITY: "#ef4444",
  SENTIMENT: "#f59e0b", LIQUIDITY: "#0ea5e9", TRUST: "#06b6d4", PORTFOLIO_HEALTH: "#ec4899",
};

const REGIME_COLORS: Record<string, string> = {
  STRONG_RISK_ON: "#22c55e",
  RISK_ON: "#4ade80",
  NEUTRAL: "#94a3b8",
  DEFENSIVE: "#f59e0b",
  RISK_OFF: "#ef4444",
};

const REGIME_VALUES: Record<string, number> = {
  STRONG_RISK_ON: 5,
  RISK_ON: 4,
  NEUTRAL: 3,
  DEFENSIVE: 2,
  RISK_OFF: 1,
};

function MetricCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: color || "inherit" }}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function EnginesTab({ data }: { data: Awaited<ReturnType<typeof useAdminEngines>['data']> }) {
  if (!data) return null;
  const scoreData = (data.scoreDistributions || []) as { type: string; avg: number; min: number; max: number; count: number }[];

  return (
    <div className="space-y-6">
      {/* Score Distribution Chart */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5" />Engine Score Averages (Latest)
        </h3>
        {scoreData.length > 0 ? <EngineScoreChart data={scoreData} /> : <p className="text-xs text-muted-foreground">No score data</p>}
      </div>

      {/* Score Details Table */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Target className="h-3.5 w-3.5" />Score Distribution Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Engine</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Avg</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Min</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Max</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Assets</th>
                <th className="text-left py-2 text-muted-foreground font-semibold pl-4">Spread</th>
              </tr>
            </thead>
            <tbody>
              {scoreData.map((s) => {
                const fill = SCORE_COLORS[s.type] || "#64748b";
                return (
                  <tr key={s.type} className="border-b border-border/20">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: fill }} />
                        <span className="font-bold text-foreground">{s.type}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-foreground">{s.avg}</td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">{s.min}</td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">{s.max}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{s.count}</td>
                    <td className="py-2.5 pl-4">
                      <div className="w-full bg-muted/30 rounded-full h-1.5 relative">
                        <div className="absolute h-1.5 rounded-full" style={{ left: `${s.min}%`, width: `${Math.max(s.max - s.min, 1)}%`, background: fill, opacity: 0.6 }} />
                        <div className="absolute w-1.5 h-1.5 rounded-full border border-background" style={{ left: `${s.avg}%`, background: fill, transform: "translateX(-50%)" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compatibility Distribution */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" />Compatibility Label Distribution
        </h3>
        {(data.compatibilityDistribution || []).length > 0 ? <CompatibilityChart data={data.compatibilityDistribution} /> : <p className="text-xs text-muted-foreground">No compatibility data</p>}
      </div>

      {/* Asset Coverage */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Asset Coverage by Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Type</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Total</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">With Scores</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">With Signal</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {(data.assetCoverage || []).map((row: { type: string; total: number; withScores: number; withSignalStrength: number }) => (
                <tr key={row.type} className="border-b border-border/20">
                  <td className="py-2 font-bold text-foreground">{row.type}</td>
                  <td className="py-2 text-right text-muted-foreground">{row.total}</td>
                  <td className="py-2 text-right text-foreground">{row.withScores}</td>
                  <td className="py-2 text-right text-foreground">{row.withSignalStrength}</td>
                  <td className="py-2 text-right">
                    <span className={`font-bold ${row.total > 0 && row.withScores / row.total > 0.8 ? "text-emerald-400" : "text-amber-400"}`}>
                      {row.total > 0 ? Math.round((row.withScores / row.total) * 100) : 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RegimeTab({ data }: { data: Awaited<ReturnType<typeof useAdminRegime>['data']> }) {
  if (!data) return null;

  const currentState = data.currentRegime?.state ?? "—";
  const currentColor = REGIME_COLORS[currentState] || "#94a3b8";

  const historyData = (data.regimeHistory || []).map((r: { date: string; state: string; breadthScore: number | null }) => ({
    date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    rawDate: r.date,
    state: r.state,
    stateValue: REGIME_VALUES[r.state] ?? 3,
    breadthScore: r.breadthScore ?? 0,
  }));

  const mh = data.multiHorizon;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Current Regime" value={currentState} icon={Activity} color={currentColor} />
        <MetricCard
          label="Breadth Score"
          value={data.currentRegime?.breadthScore?.toFixed(1) ?? "—"}
          icon={TrendingUp}
        />
        <MetricCard
          label="VIX Value"
          value={data.currentRegime?.vixValue?.toFixed(1) ?? "—"}
          icon={AlertTriangle}
        />
        <MetricCard
          label="Transitions (30d)"
          value={data.transitionCount30d ?? 0}
          icon={Clock}
        />
      </div>

      {/* Regime History Chart */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Regime State History (30d)</h3>
        {historyData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }} />
                <YAxis
                  domain={[0.5, 5.5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tickFormatter={(v: number) => {
                    const labels: Record<number, string> = { 1: "Risk Off", 2: "Defensive", 3: "Neutral", 4: "Risk On", 5: "Strong Risk On" };
                    return labels[v] || "";
                  }}
                  tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value, name) => {
                    const v = value ?? 0;
                    if (name === "stateValue") {
                      const labels: Record<number, string> = { 1: "RISK_OFF", 2: "DEFENSIVE", 3: "NEUTRAL", 4: "RISK_ON", 5: "STRONG_RISK_ON" };
                      return [labels[v as number] || v, "Regime"];
                    }
                    return [v, name];
                  }}
                />
                <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Line type="stepAfter" dataKey="stateValue" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="stateValue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-xs text-muted-foreground">No regime history</p>}
      </div>

      {/* Breadth Score History */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Breadth Score History (30d)</h3>
        {historyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="breadthScore" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="Breadth" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-xs text-muted-foreground">No breadth data</p>}
      </div>

      {/* Multi-Horizon Regime */}
      {mh && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Multi-Horizon Regime (Latest)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Current", data: mh.current },
              { label: "Short-Term (5d)", data: mh.shortTerm },
              { label: "Medium-Term (20d)", data: mh.mediumTerm },
              { label: "Long-Term (60d)", data: mh.longTerm },
            ].map((horizon) => {
              const h = horizon.data as { regime?: { label?: string; score?: number } } | null;
              const state = h?.regime?.label ?? "—";
              return (
                <div key={horizon.label} className="rounded-xl border border-border/30 bg-muted/20 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{horizon.label}</span>
                  <div className="text-sm font-bold" style={{ color: REGIME_COLORS[state] || "#94a3b8" }}>
                    {state}
                  </div>
                  {h?.regime?.score !== undefined && (
                    <span className="text-[10px] text-muted-foreground">Score: {typeof h.regime.score === "number" ? h.regime.score.toFixed(1) : h.regime.score}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Transition Probability:</span>
            <span className="font-bold text-foreground">{Number(mh.transitionProbability).toFixed(1)}%</span>
            <span className="text-muted-foreground">Direction:</span>
            <span className="font-bold text-foreground">{mh.transitionDirection}</span>
          </div>
        </div>
      )}

      {/* Cross-Sector Correlation */}
      {data.crossSectorCorrelation && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Cross-Sector Correlation</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Regime</span>
              <div className="text-sm font-bold text-foreground">{data.crossSectorCorrelation.regime}</div>
            </div>
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dispersion</span>
              <div className="text-sm font-bold text-foreground">{typeof data.crossSectorCorrelation.dispersion === "number" ? data.crossSectorCorrelation.dispersion.toFixed(2) : "—"}</div>
            </div>
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Avg Correlation</span>
              <div className="text-sm font-bold text-foreground">{typeof data.crossSectorCorrelation.trend === "number" ? data.crossSectorCorrelation.trend.toFixed(1) : "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Regime Legend */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Regime Legend</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(REGIME_COLORS).map(([state, color]) => (
            <div key={state} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-xs font-semibold text-foreground">{state.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminEnginesRegimePage() {
  const [tab, setTab] = useState<"engines" | "regime">("engines");
  const { data: enginesData, error: enginesError, isLoading: enginesLoading } = useAdminEngines();
  const { data: regimeData, error: regimeError, isLoading: regimeLoading } = useAdminRegime();

  const isLoading = tab === "engines" ? enginesLoading : regimeLoading;
  const error = tab === "engines" ? enginesError : regimeError;

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load data.</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Engines & Regime</h1>
          <p className="text-xs text-muted-foreground mt-1">Engine health telemetry and market regime analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <TabButton active={tab === "engines"} onClick={() => setTab("engines")} label="Engines" icon={Cpu} />
          <TabButton active={tab === "regime"} onClick={() => setTab("regime")} label="Regime" icon={Activity} />
        </div>
      </div>

      {tab === "engines" ? <EnginesTab data={enginesData} /> : <RegimeTab data={regimeData} />}
    </div>
  );
}
