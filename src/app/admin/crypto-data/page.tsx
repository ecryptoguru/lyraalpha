"use client";

import React from "react";
import { useAdminCryptoData } from "@/hooks/use-admin";
import {
  Loader2,
  ShieldAlert,
  Database,
  Newspaper,
  BarChart3,
  DollarSign,
  TrendingUp,
  Activity,
  Coins,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div
        className="text-2xl font-bold tracking-tight"
        style={{ color: color || "inherit" }}
      >
        {value}
      </div>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      )}
    </div>
  );
}

function SourceCard({
  name,
  icon: Icon,
  coverage,
  total,
  lastSync,
  staleCount,
  statusColor,
}: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  coverage: number;
  total: number;
  lastSync: string;
  staleCount: number;
  statusColor: string;
}) {
  const pct = total > 0 ? Math.round((coverage / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: statusColor }}><Icon className="h-4 w-4" /></span>
          <span className="text-xs font-bold text-foreground">{name}</span>
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: statusColor }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Coverage</span>
        <span className="font-bold" style={{ color: statusColor }}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-muted/30 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: statusColor,
            opacity: 0.7,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {coverage}/{total} assets
        </span>
        <span>{lastSync}</span>
      </div>
      {staleCount > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {staleCount} stale
        </div>
      )}
    </div>
  );
}

export default function AdminCryptoDataPage() {
  const { data, error, isLoading } = useAdminCryptoData();

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Failed to load crypto data source stats.
        </p>
      </div>
    );
  if (!data) return null;

  const cg = data.coingecko;
  const nd = data.newsdata;
  const gt = data.geckoTerminal;
  const dl = data.defiLlama;
  const cglass = data.coinglass;
  const ms = data.messari;
  const mr = data.marketRegime;

  const cgPct = cg.totalAssets > 0 ? Math.round((cg.freshCount / cg.totalAssets) * 100) : 0;
  const ndStatusColor = nd.events24h > 0 ? "#22c55e" : nd.events7d > 0 ? "#f59e0b" : "#ef4444";
  const gtStatusColor = gt.assetsWithPoolData > 0 ? "#22c55e" : "#64748b";
  const dlStatusColor = dl.assetsWithTvl > 0 ? "#22c55e" : "#64748b";
  const cglassStatusColor = cglass.assetsWithFuturesMetadata > 0 ? "#22c55e" : "#64748b";
  const msStatusColor = ms.assetsWithMessariData > 0 ? "#22c55e" : "#64748b";

  const cgLastSync = cg.lastSync
    ? new Date(cg.lastSync).toLocaleString()
    : "Never";
  const ndLastSync = nd.lastEvent
    ? new Date(nd.lastEvent).toLocaleString()
    : "Never";

  // Price freshness chart data
  const freshnessData = data.priceFreshness.map((r: { bucket: string; fresh: number; stale: number; missing: number }) => ({
    bucket: r.bucket,
    Fresh: r.fresh,
    Stale: r.stale,
    Missing: r.missing,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crypto Data Sources</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Data source coverage, sync health, and API monitoring
        </p>
      </div>

      {/* Data Source Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SourceCard
          name="CoinGecko"
          icon={Database}
          coverage={cg.freshCount}
          total={cg.totalAssets}
          lastSync={cgLastSync}
          staleCount={cg.staleCount}
          statusColor={cgPct >= 80 ? "#22c55e" : cgPct >= 50 ? "#f59e0b" : "#ef4444"}
        />
        <SourceCard
          name="NewsData.io"
          icon={Newspaper}
          coverage={nd.events24h}
          total={nd.events7d > 0 ? Math.round(nd.events7d / 7) : 0}
          lastSync={ndLastSync}
          staleCount={0}
          statusColor={ndStatusColor}
        />
        <SourceCard
          name="GeckoTerminal"
          icon={BarChart3}
          coverage={gt.assetsWithPoolData}
          total={cg.totalAssets}
          lastSync="On-chain"
          staleCount={0}
          statusColor={gtStatusColor}
        />
        <SourceCard
          name="DefiLlama"
          icon={DollarSign}
          coverage={dl.assetsWithTvl}
          total={cg.totalAssets}
          lastSync="TVL data"
          staleCount={0}
          statusColor={dlStatusColor}
        />
        <SourceCard
          name="Coinglass"
          icon={TrendingUp}
          coverage={cglass.assetsWithFuturesMetadata}
          total={cg.totalAssets}
          lastSync="OI/Futures"
          staleCount={0}
          statusColor={cglassStatusColor}
        />
        <SourceCard
          name="Messari"
          icon={Activity}
          coverage={ms.assetsWithMessariData}
          total={cg.totalAssets}
          lastSync="Research"
          staleCount={0}
          statusColor={msStatusColor}
        />
      </div>

      {/* CoinGecko Coverage Details */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Database className="h-3.5 w-3.5" />
          CoinGecko Coverage Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            label="Total Assets"
            value={cg.totalAssets.toLocaleString()}
            icon={Coins}
          />
          <MetricCard
            label="With Metadata"
            value={cg.withMetadata.toLocaleString()}
            icon={CheckCircle2}
            color={cg.totalAssets > 0 && cg.withMetadata / cg.totalAssets > 0.8 ? "#22c55e" : "#f59e0b"}
            subtitle={cg.totalAssets > 0 ? `${Math.round((cg.withMetadata / cg.totalAssets) * 100)}%` : ""}
          />
          <MetricCard
            label="Fresh (<24h)"
            value={cg.freshCount.toLocaleString()}
            icon={CheckCircle2}
            color="#22c55e"
          />
          <MetricCard
            label="Stale (>24h)"
            value={cg.staleCount.toLocaleString()}
            icon={AlertTriangle}
            color={cg.staleCount > 0 ? "#f59e0b" : "#22c55e"}
          />
          <MetricCard
            label="No Metadata"
            value={cg.noMetadataCount.toLocaleString()}
            icon={XCircle}
            color={cg.noMetadataCount > 0 ? "#ef4444" : "#22c55e"}
          />
        </div>
      </div>

      {/* Crypto News Feed Health */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5" />
          Crypto News Feed Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Events (24h)"
            value={nd.events24h.toLocaleString()}
            icon={Newspaper}
            color={nd.events24h > 0 ? "#22c55e" : "#ef4444"}
          />
          <MetricCard
            label="Events (7d)"
            value={nd.events7d.toLocaleString()}
            icon={Newspaper}
            color={nd.events7d > 0 ? "#22c55e" : "#f59e0b"}
          />
          <MetricCard
            label="Avg / Day"
            value={nd.avgPerDay}
            icon={BarChart3}
          />
          <MetricCard
            label="Last Event"
            value={nd.lastEvent ? new Date(nd.lastEvent).toLocaleTimeString() : "Never"}
            icon={Activity}
            color={ndStatusColor}
          />
        </div>
      </div>

      {/* On-Chain Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            GeckoTerminal (DEX Pools)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Assets with Pools"
              value={gt.assetsWithPoolData.toLocaleString()}
              icon={BarChart3}
              color={gtStatusColor}
              subtitle={`${cg.totalAssets > 0 ? Math.round((gt.assetsWithPoolData / cg.totalAssets) * 100) : 0}% coverage`}
            />
            <MetricCard
              label="Total Pools"
              value={gt.totalPools.toLocaleString()}
              icon={Coins}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5" />
            DefiLlama (TVL)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Assets with TVL"
              value={dl.assetsWithTvl.toLocaleString()}
              icon={DollarSign}
              color={dlStatusColor}
              subtitle={`${cg.totalAssets > 0 ? Math.round((dl.assetsWithTvl / cg.totalAssets) * 100) : 0}% coverage`}
            />
            <MetricCard
              label="Total TVL (USD)"
              value={`$${(dl.totalTvlUsd / 1e9).toFixed(2)}B`}
              icon={DollarSign}
            />
          </div>
        </div>
      </div>

      {/* Coinglass + Messari */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Coinglass (OI / Futures)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Assets with OI Data"
              value={cglass.assetsWithOiData.toLocaleString()}
              icon={TrendingUp}
              color={cglassStatusColor}
            />
            <MetricCard
              label="Futures Metadata"
              value={cglass.assetsWithFuturesMetadata.toLocaleString()}
              icon={Activity}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            Messari (Research)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Assets with Data"
              value={ms.assetsWithMessariData.toLocaleString()}
              icon={Activity}
              color={msStatusColor}
              subtitle={`${cg.totalAssets > 0 ? Math.round((ms.assetsWithMessariData / cg.totalAssets) * 100) : 0}% coverage`}
            />
            <MetricCard
              label="Total Crypto Assets"
              value={cg.totalAssets.toLocaleString()}
              icon={Coins}
            />
          </div>
        </div>
      </div>

      {/* Market Regime Health */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          Market Regime Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard
            label="Current State"
            value={mr.currentState ?? "—"}
            icon={Activity}
            color={
              mr.currentState === "STRONG_RISK_ON" || mr.currentState === "RISK_ON"
                ? "#22c55e"
                : mr.currentState === "NEUTRAL"
                ? "#94a3b8"
                : "#ef4444"
            }
          />
          <MetricCard
            label="Last Calculated"
            value={
              mr.lastCalculated
                ? new Date(mr.lastCalculated).toLocaleDateString()
                : "Never"
            }
            icon={Activity}
          />
          <MetricCard
            label="Crypto Benchmarks"
            value={mr.cryptoBenchmarks.join(", ")}
            icon={Coins}
          />
        </div>
      </div>

      {/* Price Freshness Chart */}
      {freshnessData.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Price History Freshness by Market Cap Bucket
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={freshnessData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(217 32% 12%)"
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222 47% 8%)",
                    border: "1px solid hsl(217 32% 12%)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  dataKey="Fresh"
                  stackId="a"
                  fill="#22c55e"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Stale"
                  stackId="a"
                  fill="#f59e0b"
                />
                <Bar
                  dataKey="Missing"
                  stackId="a"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
