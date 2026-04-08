"use client";

import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const SCORE_COLORS: Record<string, string> = {
  TREND: "#3b82f6", MOMENTUM: "#22c55e", VOLATILITY: "#ef4444",
  SENTIMENT: "#f59e0b", LIQUIDITY: "#0ea5e9", TRUST: "#06b6d4", PORTFOLIO_HEALTH: "#ec4899",
};

type ScoreRow = { type: string; avg: number; min: number; max: number; count: number };
type CompatRow = { label: string; count: number };

export function EngineScoreChart({ data }: { data: ScoreRow[] }) {
  const enriched = data.map(s => ({ ...s, fill: SCORE_COLORS[s.type] || "#64748b" }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={enriched}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
          <XAxis dataKey="type" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
          <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }}
            formatter={(value) => [Number(value ?? 0).toFixed(1)]} />
          <Bar dataKey="avg" name="Average" radius={[4, 4, 0, 0]}>
            {enriched.map((entry) => <Cell key={entry.type} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompatibilityChart({ data }: { data: CompatRow[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} width={120} />
          <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
          <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Assets" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
