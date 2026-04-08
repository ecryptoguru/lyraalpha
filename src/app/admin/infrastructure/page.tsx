"use client";

import React from "react";
import { useAdminInfrastructure } from "@/hooks/use-admin";
import { Loader2, ShieldAlert, Server, Database, HardDrive, Gauge } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function MetricCard({ label, value, icon: Icon, subtitle, color }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; subtitle?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: color || "inherit" }}>{value}</div>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

export default function AdminInfrastructurePage() {
  const { data, error, isLoading } = useAdminInfrastructure();

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load infrastructure data.</p></div>;
  if (!data) return null;

  const cacheHitRate = data.cacheStats?.hitRate ?? 0;
  const cacheColor = cacheHitRate >= 60 ? "#22c55e" : cacheHitRate >= 40 ? "#f59e0b" : "#ef4444";

  const tableData = Object.entries(data.dbTableCounts || {}).map(([table, count]) => ({
    name: table,
    count: count as number,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure Monitoring</h1>
        <p className="text-xs text-muted-foreground mt-1">Cache health, database stats, Redis info</p>
      </div>

      {/* Cache KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Cache Hit Rate"
          value={`${cacheHitRate}%`}
          icon={Gauge}
          color={cacheColor}
          subtitle={data.cacheStats ? `${data.cacheStats.hits?.toLocaleString()} hits / ${data.cacheStats.misses?.toLocaleString()} misses` : "No cache data"}
        />
        <MetricCard
          label="Cache Hits"
          value={data.cacheStats?.hits?.toLocaleString() ?? "N/A"}
          icon={Server}
        />
        <MetricCard
          label="Cache Misses"
          value={data.cacheStats?.misses?.toLocaleString() ?? "N/A"}
          icon={Server}
        />
        <MetricCard
          label="Redis Memory"
          value={data.redisInfo?.used_memory_human ?? "N/A"}
          icon={HardDrive}
          subtitle={data.redisInfo?.maxmemory_human ? `Max: ${data.redisInfo.maxmemory_human}` : undefined}
        />
      </div>

      {/* Cache Hit Rate Visual */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Cache Performance</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-muted/30 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cacheHitRate}%`,
                  background: `linear-gradient(90deg, ${cacheColor}80, ${cacheColor})`,
                }}
              />
            </div>
          </div>
          <span className="text-lg font-bold" style={{ color: cacheColor }}>
            {cacheHitRate}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>Target: &gt;60%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Database Table Counts */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Database className="h-3.5 w-3.5" />Database Table Row Counts
        </h3>
        {tableData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tableData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} width={120} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value) => [(value ?? 0).toLocaleString(), "Rows"]}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Rows" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-xs text-muted-foreground">No table data</p>}
      </div>

      {/* Redis Info */}
      {data.redisInfo && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Redis Info</h3>
          <div className="space-y-2">
            {Object.entries(data.redisInfo).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">{key}</span>
                <span className="text-xs font-bold text-foreground">{value as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DB Table Details */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Database Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Table</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Row Count</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = tableData.reduce((s, r) => s + r.count, 0);
                return tableData
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr key={row.name} className="border-b border-border/20">
                      <td className="py-2 font-medium text-foreground capitalize">{row.name}</td>
                      <td className="py-2 text-right font-mono text-foreground">{row.count.toLocaleString()}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {total > 0 ? ((row.count / total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
