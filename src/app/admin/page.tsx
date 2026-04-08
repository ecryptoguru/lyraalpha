"use client";

import React from "react";
import { useAdminOverview } from "@/hooks/use-admin";
import {
  Users,
  CreditCard,
  Brain,
  Database,
  TrendingUp,
  Activity,
  Zap,
  UserPlus,
  Loader2,
  ShieldAlert,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import dynamic from "next/dynamic";

const PlanDistributionChart = dynamic(
  () => import("./_charts/overview-chart").then(m => m.PlanDistributionChart),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl bg-muted" /> }
);

const PLAN_COLORS: Record<string, string> = {
  STARTER: "text-slate-400",
  PRO: "text-amber-400",
  ELITE: "text-amber-400",
  ENTERPRISE: "text-amber-400",
};

function KPICard({
  label,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendUp,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean | null;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-3 sm:p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${accent || "text-muted-foreground/60"}`} />
      </div>
      <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold ${
              trendUp === true ? "text-emerald-400" : trendUp === false ? "text-red-400" : "text-muted-foreground"
            }`}>
              {trendUp === true ? <ArrowUpRight className="h-2.5 w-2.5" /> : trendUp === false ? <ArrowDownRight className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              {trend}
            </span>
          )}
          {subtitle && (
            <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/20 last:border-0">
      <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</span>
      <span className={`text-[10px] sm:text-xs font-bold shrink-0 ${valueClass || "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, error, isLoading } = useAdminOverview();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {error.message?.includes("403")
            ? "No admin access. Set publicMetadata.role = \"admin\" in Clerk."
            : "Failed to load admin data."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const planData = Object.entries(data.planDistribution || {}).map(([plan, count]) => ({
    name: plan,
    value: count as number,
  }));

  const totalUsers = data.totalUsers ?? 0;
  const paidSubscriptions = data.paidSubscriptions ?? data.paidUsers ?? 0;
  const mrr = data.mrr ?? 0;
  const arr = data.arr ?? 0;
  const conversionRate = (data.freeToPaidConversionRate ?? 0).toFixed(1);

  const aiPerUser = totalUsers > 0 ? (data.totalAIRequests / totalUsers).toFixed(1) : "0";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            Current platform health — {dateStr}
          </p>
        </div>
        <div className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
          data.currentRegime
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-white/5 text-muted-foreground"
        }`}>
          {data.currentRegime ?? "No Regime Data"}
        </div>
      </div>

      {/* Revenue KPIs — most important first */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Revenue</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <KPICard
            label="MRR"
            value={`$${mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            subtitle="Monthly recurring"
            accent="text-emerald-400"
          />
          <KPICard
            label="ARR"
            value={`$${arr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            subtitle="Annual run rate"
          />
          <KPICard
            label="Active Subscriptions"
            value={data.activeSubscriptions ?? 0}
            icon={CreditCard}
            subtitle={`${paidSubscriptions} paid subscriptions`}
          />
          <KPICard
            label="Conversion Rate"
            value={`${conversionRate}%`}
            icon={Activity}
            subtitle="Free → Paid"
            trendUp={parseFloat(conversionRate) > 5 ? true : parseFloat(conversionRate) < 2 ? false : null}
          />
        </div>
      </div>

      {/* Users KPIs */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Users</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <KPICard
            label="Total Users"
            value={totalUsers.toLocaleString()}
            icon={Users}
            subtitle="All time"
          />
          <KPICard
            label="New (7d)"
            value={data.recentSignups7d ?? 0}
            icon={UserPlus}
            trend={data.recentSignups7d > 0 ? `+${data.recentSignups7d}` : "0"}
            trendUp={data.recentSignups7d > 0}
          />
          <KPICard
            label="New (30d)"
            value={data.recentSignups30d ?? 0}
            icon={UserPlus}
          />
          <KPICard
            label="AI Reqs / User"
            value={aiPerUser}
            icon={Brain}
            subtitle="Lifetime avg"
          />
        </div>
      </div>

      {/* AI / Platform KPIs */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">AI Activity</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <KPICard
            label="AI Requests Today"
            value={data.aiRequestsToday?.toLocaleString() ?? 0}
            icon={Zap}
            accent="text-amber-400"
          />
          <KPICard
            label="AI Requests (7d)"
            value={data.aiRequestsLast7d?.toLocaleString() ?? 0}
            icon={Brain}
          />
          <KPICard
            label="Total AI Requests"
            value={data.totalAIRequests?.toLocaleString() ?? 0}
            icon={Database}
          />
          <KPICard
            label="Assets Tracked"
            value={data.totalAssets?.toLocaleString() ?? 0}
            icon={Database}
            subtitle="In universe"
          />
        </div>
      </div>

      {/* Plan Distribution + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Plan Distribution Chart */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 sm:p-5">
          <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            Plan Distribution
          </h3>
          {planData.length > 0 ? (
            <PlanDistributionChart data={planData} />
          ) : (
            <p className="text-xs text-muted-foreground">No plan data available</p>
          )}
        </div>

        {/* Plan mix */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 sm:p-5">
          <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
            Plan Mix
          </h3>
          <div className="space-y-0">
            {planData.map(({ name, value }) => {
              const pct = totalUsers > 0 ? (value / totalUsers) * 100 : 0;
              return (
                <div key={name} className="py-2 border-b border-border/20 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${PLAN_COLORS[name] || "text-foreground"}`}>{name}</span>
                    <span className="text-xs font-bold text-foreground">
                      {value} users
                      <span className="text-muted-foreground font-normal ml-1">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: name === "ELITE" ? "#f59e0b" : name === "PRO" ? "#3b82f6" : name === "ENTERPRISE" ? "#10b981" : "#64748b",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {planData.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No plan data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Platform Health Summary */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 sm:p-5">
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Platform Health Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
          <div>
            <StatRow label="Total Users" value={totalUsers.toLocaleString()} />
            <StatRow label="Paid Subscriptions" value={paidSubscriptions} valueClass="text-emerald-400" />
            <StatRow label="Free Users" value={((data.planDistribution?.["STARTER"] as number) ?? 0).toLocaleString()} />
            <StatRow label="Active Subscriptions" value={data.activeSubscriptions ?? 0} />
          </div>
          <div>
            <StatRow label="MRR" value={`$${mrr.toFixed(0)}`} valueClass="text-emerald-400" />
            <StatRow label="ARR" value={`$${arr.toFixed(0)}`} valueClass="text-emerald-400" />
            <StatRow label="Free→Paid Conversion" value={`${conversionRate}%`} />
            <StatRow label="AI Requests / User" value={aiPerUser} />
          </div>
          <div>
            <StatRow label="AI Requests Today" value={(data.aiRequestsToday ?? 0).toLocaleString()} />
            <StatRow label="AI Requests (7d)" value={(data.aiRequestsLast7d ?? 0).toLocaleString()} />
            <StatRow label="Lifetime AI Requests" value={(data.totalAIRequests ?? 0).toLocaleString()} />
            <StatRow label="Assets Tracked" value={(data.totalAssets ?? 0).toLocaleString()} />
          </div>
        </div>
      </div>
    </div>
  );
}
