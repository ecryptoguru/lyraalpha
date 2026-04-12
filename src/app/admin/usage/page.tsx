"use client";

import React from "react";
import { type AdminUsageRange, useAdminUsage, useAdminMyra } from "@/hooks/use-admin";
import { Loader2, ShieldAlert, BarChart3, Eye, Bookmark, GraduationCap, Globe, Users, MessageCircle, Sparkles, Bot } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  CRYPTO: "#f59e0b",
};

const REGION_COLORS: Record<string, string> = {
  US: "#3b82f6",
  IN: "#f59e0b",
  BOTH: "#22c55e",
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#64748b",
  PRO: "#3b82f6",
  ELITE: "#f59e0b",
  ENTERPRISE: "#22c55e",
};

const SECTION_COLORS: Record<string, string> = {
  LYRA_INTEL: "#60a5fa",
  MARKET_INTEL: "#34d399",
  DISCOVERY: "#f59e0b",
  TIMELINE: "#f97316",
  LEARNING: "#818cf8",
  PORTFOLIO: "#ef4444",
};

const USAGE_RANGES: { value: AdminUsageRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

function MetricCard({ label, value, icon: Icon, subtitle }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

export default function AdminUsagePage() {
  const [selectedRange, setSelectedRange] = React.useState<AdminUsageRange>("30d");
  const [chartsReady, setChartsReady] = React.useState(false);
  const { data, error, isLoading } = useAdminUsage(selectedRange);
  const { data: myraData } = useAdminMyra();

  React.useEffect(() => {
    setChartsReady(true);
  }, []);

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load usage data.</p></div>;
  if (!data) return null;

  const assetTypeData = Object.entries(data.assetTypeDistribution || {}).map(([type, count]) => ({
    name: type,
    value: count as number,
  }));

  const regionData = Object.entries(data.regionDistribution || {}).map(([region, count]) => ({
    name: region,
    value: count as number,
  }));

  const experienceData = Object.entries(data.experienceLevelDistribution || {}).map(([level, count]) => ({
    name: level,
    value: count as number,
  }));

  const rangeDays = data.selectedRangeDays ?? 30;
  const rangeLabel = `${rangeDays}d`;
  const activation = data.activationFunnel;
  const retention = data.retention;
  const cohortData = [...(data.cohortRetention || [])].reverse();
  const sectionData: {
    section: string;
    activeUsers: number;
    requests: number;
    totalActiveMinutes: number;
    avgActiveMinutesPerUser: number;
    avgRequestsPerUser: number;
  }[] = data.sectionEngagement || [];
  const intentData: { intent: string; count: number }[] = data.intentDistribution || [];
  const upgradeSignals = data.upgradeSignals14d;
  const beginnerKpis = data.beginnerKpis;
  const experimentComparison = data.beginnerExperimentComparison;
  const ctaExperiment = data.upgradeCtaExperiment;
  const shareSheet = data.shareSheetEngagement;
  const topUsers: {
    userId: string;
    email: string;
    plan: string;
    requests: number;
    activeMinutes: number;
    topSection: string;
  }[] = data.topUsersByActiveTime || [];

  const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Usage & Product Analytics</h1>
          <div className="inline-flex items-center rounded-xl border border-white/5 bg-background/40 p-1">
            {USAGE_RANGES.map((option) => {
              const isActive = option.value === selectedRange;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRange(option.value)}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Activation, retention, active-time engagement and Pro-to-Elite conversion intelligence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-11 gap-3">
        <MetricCard label="Discovery Items" value={data.discoveryItemCount?.toLocaleString() ?? 0} icon={BarChart3} />
        <MetricCard label="Watchlist Items" value={data.watchlistItemCount?.toLocaleString() ?? 0} icon={Bookmark} />
        <MetricCard label="Onboarding Rate" value={`${data.onboardingCompletionRate ?? 0}%`} icon={GraduationCap} subtitle="Users who completed onboarding" />
        <MetricCard label="Asset Types" value={Object.keys(data.assetTypeDistribution || {}).length} icon={Eye} />
        <MetricCard label={`${rangeLabel} Signups`} value={activation?.signedUp?.toLocaleString() ?? 0} icon={Users} />
        <MetricCard label="DAU / WAU" value={`${retention?.dau ?? 0} / ${retention?.wau ?? 0}`} icon={Users} subtitle={`${retention?.dauWauStickiness ?? 0}% stickiness`} />
        <MetricCard label="Pro Active (14D)" value={upgradeSignals?.proActiveUsers ?? 0} icon={Users} subtitle={`${upgradeSignals?.proUsers ?? 0} total Pro`} />
        <MetricCard label="Upgrade Rate" value={`${upgradeSignals?.estimatedUpgradeRateFromActivePro ?? 0}%`} icon={BarChart3} subtitle="Pro active to detected Elite upgrades" />
        <MetricCard label="Share Opens" value={shareSheet?.opens ?? 0} icon={Sparkles} subtitle={`${rangeLabel} share sheet opens`} />
        <MetricCard label="Share Attempts" value={shareSheet?.actionAttempts ?? 0} icon={MessageCircle} subtitle={`${shareSheet?.openToAttemptRate ?? 0}% open-to-attempt`} />
        <MetricCard label="Share Successes" value={shareSheet?.successfulActions ?? 0} icon={MessageCircle} subtitle={`${shareSheet?.openToSuccessRate ?? 0}% open-to-success`} />
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Beginner North-Star KPIs ({rangeLabel})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Cohort Users"
            value={beginnerKpis?.cohortUsers?.toLocaleString() ?? 0}
            icon={Users}
            subtitle="New users in selected range"
          />
          <MetricCard
            label="Onboarding Completion"
            value={`${beginnerKpis?.onboardingCompletionRate ?? 0}%`}
            icon={GraduationCap}
            subtitle="Completed onboarding among cohort"
          />
          <MetricCard
            label="First Value Action"
            value={`${beginnerKpis?.firstValueActionRate ?? 0}%`}
            icon={Bookmark}
            subtitle={`${beginnerKpis?.firstValueActionUsers ?? 0} users did AI request or watchlist action`}
          />
          <MetricCard
            label="D7 Retention"
            value={`${beginnerKpis?.d7RetentionRate ?? 0}%`}
            icon={Eye}
            subtitle={`${beginnerKpis?.d7ReturnedUsers ?? 0}/${beginnerKpis?.d7EligibleUsers ?? 0} returned on day 7`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Beginner Experiment Cohorts ({rangeLabel})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Control</p>
              <p className="text-xs text-muted-foreground">Cohort: {experimentComparison?.control?.cohortUsers ?? 0}</p>
              <p className="text-xs text-muted-foreground">Onboarding: {experimentComparison?.control?.onboardingCompletionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">First Value: {experimentComparison?.control?.firstValueActionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">D7: {experimentComparison?.control?.d7RetentionRate ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Treatment</p>
              <p className="text-xs text-muted-foreground">Cohort: {experimentComparison?.treatment?.cohortUsers ?? 0}</p>
              <p className="text-xs text-muted-foreground">Onboarding: {experimentComparison?.treatment?.onboardingCompletionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">First Value: {experimentComparison?.treatment?.firstValueActionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">D7: {experimentComparison?.treatment?.d7RetentionRate ?? 0}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Upgrade CTA Experiment (last 14d)
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <MetricCard label="Impressions" value={ctaExperiment?.impressions?.all ?? 0} icon={Eye} />
            <MetricCard label="Clicks" value={ctaExperiment?.clicks?.all ?? 0} icon={BarChart3} />
            <MetricCard label="CTR" value={`${ctaExperiment?.ctrPercent?.all ?? 0}%`} icon={Users} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">By Action Bucket</p>
              <p className="text-xs text-muted-foreground">0 actions CTR: {ctaExperiment?.ctrPercent?.byBucket?.["0"] ?? 0}%</p>
              <p className="text-xs text-muted-foreground">1 action CTR: {ctaExperiment?.ctrPercent?.byBucket?.["1"] ?? 0}%</p>
              <p className="text-xs text-muted-foreground">2+ actions CTR: {ctaExperiment?.ctrPercent?.byBucket?.["2_plus"] ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-white/5 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">By Variant</p>
              <p className="text-xs text-muted-foreground">Control CTR: {ctaExperiment?.byVariant?.control?.ctrPercent ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Treatment CTR: {ctaExperiment?.byVariant?.treatment?.ctrPercent ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Treatment clicks: {ctaExperiment?.byVariant?.treatment?.clicks ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Share Sheet Engagement ({rangeLabel})</h3>
            <p className="text-xs text-muted-foreground mt-1">How often users open the share sheet, which actions they actually use and which surfaces generate the most sharing intent.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top Actions</p>
            {(shareSheet?.topActions ?? []).length > 0 ? (shareSheet?.topActions ?? []).map((row: { action: string; count: number }) => (
              <div key={row.action} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{row.action.replace(/_/g, " ")}</span>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No share actions yet for this range.</p>}
          </div>
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmed Successes</p>
            {(shareSheet?.topSuccessActions ?? []).length > 0 ? (shareSheet?.topSuccessActions ?? []).map((row: { action: string; count: number }) => (
              <div key={row.action} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{row.action.replace(/_/g, " ")}</span>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No confirmed share successes yet.</p>}
          </div>
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top Content Types</p>
            {(shareSheet?.topKinds ?? []).length > 0 ? (shareSheet?.topKinds ?? []).map((row: { kind: string; count: number }) => (
              <div key={row.kind} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{row.kind.replace(/_/g, " ")}</span>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No share kinds recorded yet.</p>}
          </div>
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top Surfaces</p>
            {(shareSheet?.topPaths ?? []).length > 0 ? (shareSheet?.topPaths ?? []).map((row: { path: string; count: number }) => (
              <div key={row.path} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground break-all">{row.path}</span>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No share surfaces recorded yet.</p>}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Route × Action</p>
            {(shareSheet?.pathActionBreakdown ?? []).length > 0 ? (shareSheet?.pathActionBreakdown ?? []).map((row: { path: string; action: string; count: number }) => (
              <div key={`${row.path}-${row.action}`} className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-all">{row.path}</p>
                  <p>{row.action.replace(/_/g, " ")}</p>
                </div>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No route/action pairs recorded yet.</p>}
          </div>
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Kind × Action</p>
            {(shareSheet?.kindActionBreakdown ?? []).length > 0 ? (shareSheet?.kindActionBreakdown ?? []).map((row: { kind: string; action: string; count: number }) => (
              <div key={`${row.kind}-${row.action}`} className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">{row.kind.replace(/_/g, " ")}</p>
                  <p>{row.action.replace(/_/g, " ")}</p>
                </div>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No kind/action pairs recorded yet.</p>}
          </div>
          <div className="rounded-xl border border-white/5 bg-card/80 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Route × Kind</p>
            {(shareSheet?.pathKindBreakdown ?? []).length > 0 ? (shareSheet?.pathKindBreakdown ?? []).map((row: { path: string; kind: string; count: number }) => (
              <div key={`${row.path}-${row.kind}`} className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-all">{row.path}</p>
                  <p>{row.kind.replace(/_/g, " ")}</p>
                </div>
                <span>{row.count}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">No route/kind pairs recorded yet.</p>}
          </div>
        </div>
      </div>

      {/* Activation + Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Activation Funnel ({rangeLabel})</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Signed Up" value={activation?.signedUp ?? 0} icon={Users} />
            <MetricCard label="Onboarded" value={activation?.onboarded ?? 0} icon={GraduationCap} subtitle={`${pct(activation?.onboarded ?? 0, activation?.signedUp ?? 0)}%`} />
            <MetricCard label="Asked AI" value={activation?.withAiRequest ?? 0} icon={BarChart3} subtitle={`${pct(activation?.withAiRequest ?? 0, activation?.signedUp ?? 0)}%`} />
            <MetricCard label="Used Watchlist" value={activation?.withWatchlist ?? 0} icon={Bookmark} subtitle={`${pct(activation?.withWatchlist ?? 0, activation?.signedUp ?? 0)}%`} />
            <MetricCard label="Median TTFQ" value={`${activation?.timeToFirstAiMedianMinutes ?? 0}m`} icon={Eye} subtitle="time to first AI query" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Retention Snapshot</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="DAU" value={retention?.dau ?? 0} icon={Users} />
            <MetricCard label="WAU" value={retention?.wau ?? 0} icon={Users} />
            <MetricCard label="MAU" value={retention?.mau ?? 0} icon={Users} />
            <MetricCard label="DAU/WAU" value={`${retention?.dauWauStickiness ?? 0}%`} icon={BarChart3} subtitle="daily habit" />
            <MetricCard label="WAU/MAU" value={`${retention?.wauMauStickiness ?? 0}%`} icon={BarChart3} subtitle="weekly habit" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Asset Type Distribution */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Asset Type Distribution</h3>
          {chartsReady && assetTypeData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={assetTypeData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2} dataKey="value">
                    {assetTypeData.map((entry) => (
                      <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No data</p>}
          <div className="space-y-1 mt-2">
            {assetTypeData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[entry.name] || "#64748b" }} />
                  <span className="text-[10px] font-semibold">{entry.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Region Distribution */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Region Preference</h3>
          {chartsReady && regionData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={regionData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2} dataKey="value">
                    {regionData.map((entry) => (
                      <Cell key={entry.name} fill={REGION_COLORS[entry.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No data</p>}
          <div className="space-y-1 mt-2">
            {regionData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: REGION_COLORS[entry.name] || "#64748b" }} />
                  <span className="text-[10px] font-semibold flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{entry.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Level */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Experience Level</h3>
          {chartsReady && experienceData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={experienceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} width={90} />
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Users" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No data</p>}
        </div>
      </div>

      {/* Cohorts + Section engagement + Intent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Cohort Retention</h3>
          <div className="h-56">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cohortData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis dataKey="cohortWeek" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="week1Retention" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="week2Retention" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="week4Retention" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Section Active Time ({rangeLabel})</h3>
          <div className="h-56">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis dataKey="section" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="totalActiveMinutes" radius={[4, 4, 0, 0]}>
                  {sectionData.map((entry) => (
                    <Cell key={entry.section} fill={SECTION_COLORS[entry.section] || "#64748b"} />
                  ))}
                </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">User Intent Mix ({rangeLabel})</h3>
          <div className="h-56">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie data={intentData.map((r) => ({ name: r.intent, value: r.count }))} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2} dataKey="value">
                  {intentData.map((entry, i) => (
                    <Cell key={entry.intent} fill={["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#64748b"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>

      {/* Upgrade conversion + section drilldown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Pro → Elite Signals (14d)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Pro Users" value={upgradeSignals?.proUsers ?? 0} icon={Users} />
            <MetricCard label="Pro Active" value={upgradeSignals?.proActiveUsers ?? 0} icon={Users} />
            <MetricCard label="Elite Intent" value={upgradeSignals?.proUsersWithEliteIntent ?? 0} icon={BarChart3} subtitle="advanced/elite query language" />
            <MetricCard label="Detected Upgrades" value={upgradeSignals?.eliteUpgradesDetected ?? 0} icon={BarChart3} />
            <MetricCard label="Rate" value={`${upgradeSignals?.estimatedUpgradeRateFromActivePro ?? 0}%`} icon={BarChart3} subtitle="upgrades / active Pro" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Section Engagement Drilldown ({rangeLabel})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 text-muted-foreground font-semibold">Section</th>
                  <th className="text-right py-2 text-muted-foreground font-semibold">Users</th>
                  <th className="text-right py-2 text-muted-foreground font-semibold">Requests</th>
                  <th className="text-right py-2 text-muted-foreground font-semibold">Active Min</th>
                  <th className="text-right py-2 text-muted-foreground font-semibold">Avg Min/User</th>
                </tr>
              </thead>
              <tbody>
                {sectionData.map((row) => (
                  <tr key={row.section} className="border-b border-border/20">
                    <td className="py-2 font-semibold">{row.section}</td>
                    <td className="py-2 text-right">{row.activeUsers}</td>
                    <td className="py-2 text-right">{row.requests}</td>
                    <td className="py-2 text-right">{row.totalActiveMinutes}</td>
                    <td className="py-2 text-right">{row.avgActiveMinutesPerUser}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Viewed Assets */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />Most Queried Assets (by AI requests)</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">#</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Symbol</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Name</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Type</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Mentions</th>
              </tr>
            </thead>
            <tbody>
              {(data.topViewedAssets || []).map((asset: { symbol: string; name: string; type: string; viewCount: number }, i: number) => (
                <tr key={asset.symbol} className="border-b border-border/20">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-bold text-foreground">{asset.symbol}</td>
                  <td className="py-2 text-muted-foreground">{asset.name}</td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${TYPE_COLORS[asset.type] || "#64748b"}20`, color: TYPE_COLORS[asset.type] || "#64748b" }}>
                      {asset.type}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-foreground">{asset.viewCount}</td>
                </tr>
              ))}
              {(!data.topViewedAssets || data.topViewedAssets.length === 0) && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No asset data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Myra Support Chat Stats */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Bot className="h-3.5 w-3.5" />Myra Support Chat
        </h3>
        {myraData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <MetricCard label="Total Convos" value={myraData.totalConversations ?? 0} icon={MessageCircle} />
              <MetricCard label="Open" value={myraData.openConversations ?? 0} icon={MessageCircle} subtitle="awaiting reply" />
              <MetricCard label="Resolved" value={myraData.resolvedConversations ?? 0} icon={MessageCircle} />
              <MetricCard label="Unread" value={myraData.unreadMessages ?? 0} icon={Eye} subtitle="user msgs unread" />
              <MetricCard label="Total Messages" value={myraData.totalMessages ?? 0} icon={MessageCircle} />
              <MetricCard label="AI Auto-Replies" value={myraData.aiAutoReplies ?? 0} icon={Sparkles} subtitle={`${myraData.aiAutoReplyRate ?? 0}% of replies`} />
              <MetricCard label="Agent Replies" value={myraData.windsurfReplies ?? 0} icon={Users} />
              <MetricCard label="Avg Msgs/Convo" value={myraData.avgMessagesPerConversation ?? 0} icon={BarChart3} />
            </div>
            {(myraData.conversationsByPlan || []).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Conversations by Plan</p>
                  <div className="space-y-1.5">
                    {(myraData.conversationsByPlan as { plan: string; count: number }[]).map((row) => (
                      <div key={row.plan} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[row.plan] || "#64748b" }} />
                          <span className="text-xs font-semibold">{row.plan}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Avg Resolution Time</p>
                  <p className="text-2xl font-bold">{myraData.avgResolutionMinutes ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">min</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1">Average time from open to resolved</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Loading Myra stats...</p>
        )}
      </div>

      {/* User-level drilldown */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Top Users by Active Time ({rangeLabel})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">User</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Plan</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Requests</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Active Min</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Top Section</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((row) => (
                <tr key={row.userId} className="border-b border-border/20">
                  <td className="py-2 text-muted-foreground">{row.email}</td>
                  <td className="py-2"><span className="font-semibold">{row.plan}</span></td>
                  <td className="py-2 text-right">{row.requests}</td>
                  <td className="py-2 text-right font-mono">{row.activeMinutes}</td>
                  <td className="py-2">{row.topSection}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No user activity data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier & Complexity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Requests by Plan Tier ({rangeLabel})</h3>
          {chartsReady && (data.tierDistribution || []).length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tierDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                  <YAxis dataKey="tier" type="category" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} width={80} />
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="requests" name="Requests" radius={[0, 4, 4, 0]}>
                    {(data.tierDistribution || []).map((entry: { tier: string }) => (
                      <rect key={entry.tier} fill={PLAN_COLORS[entry.tier] || "#64748b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No tier data</p>}
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Requests by Query Complexity ({rangeLabel})</h3>
          {chartsReady && (data.complexityDistribution || []).length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.complexityDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                  <YAxis dataKey="complexity" type="category" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} width={80} />
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="requests" fill="#22c55e" name="Requests" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No complexity data</p>}
        </div>
      </div>

      {/* Tier × Complexity Matrix */}
      {(data.tierComplexityMatrix || []).length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Plan × Query Complexity Matrix ({rangeLabel})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 text-muted-foreground font-semibold">Plan</th>
                  <th className="text-left py-2 text-muted-foreground font-semibold">Complexity</th>
                  <th className="text-right py-2 text-muted-foreground font-semibold">Requests</th>
                </tr>
              </thead>
              <tbody>
                {(data.tierComplexityMatrix || []).map((row: { tier: string; complexity: string; count: number }) => (
                  <tr key={`${row.tier}-${row.complexity}`} className="border-b border-border/20">
                    <td className="py-2">
                      <span className="font-bold" style={{ color: PLAN_COLORS[row.tier] || "#64748b" }}>{row.tier}</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{row.complexity}</td>
                    <td className="py-2 text-right font-mono text-foreground">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
