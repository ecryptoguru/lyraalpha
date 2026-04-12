"use client";

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const TOOLTIP_STYLE = { background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 };
const TICK = { fontSize: 10, fill: "hsl(215 20% 65%)" };

const TYPE_COLORS: Record<string, string> = {
  CRYPTO: "#f59e0b",
};
const REGION_COLORS: Record<string, string> = { US: "#3b82f6", IN: "#f59e0b", BOTH: "#22c55e" };
const PLAN_COLORS: Record<string, string> = { STARTER: "#64748b", PRO: "#3b82f6", ELITE: "#f59e0b", ENTERPRISE: "#22c55e" };

type KV = { name: string; value: number };
type DayRow = { date: string; count: number };

export function AssetTypeChart({ data }: { data: KV[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((e) => <Cell key={e.name} fill={TYPE_COLORS[e.name] || "#64748b"} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegionChart({ data }: { data: KV[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((e) => <Cell key={e.name} fill={REGION_COLORS[e.name] || "#64748b"} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlanChart({ data }: { data: KV[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((e) => <Cell key={e.name} fill={PLAN_COLORS[e.name] || "#64748b"} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyViewsChart({ data }: { data: DayRow[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
          <XAxis dataKey="date" tick={TICK} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={TICK} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Views" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SectionBarChart({ data }: { data: { section: string; count: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
          <XAxis type="number" tick={TICK} />
          <YAxis dataKey="section" type="category" tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }} width={130} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Views" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MyraUsageChart({ data }: { data: { date: string; sessions: number; messages: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
          <XAxis dataKey="date" tick={TICK} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={TICK} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="sessions" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Sessions" />
          <Line type="monotone" dataKey="messages" stroke="#06b6d4" strokeWidth={2} dot={false} name="Messages" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
