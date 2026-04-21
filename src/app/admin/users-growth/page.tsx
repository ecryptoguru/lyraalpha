"use client";

import React, { useState } from "react";
import { type AdminUsageRange, useAdminUsers, useAdminGrowthRange } from "@/hooks/use-admin";
import {
  Loader2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
  UserPlus,
  Target,
  Activity,
  Users,
  Gift,
  Repeat2,
} from "lucide-react";
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
} from "recharts";

const PLAN_BADGE: Record<string, { bg: string; text: string }> = {
  STARTER: { bg: "bg-muted/10", text: "text-muted-foreground" },
  PRO: { bg: "bg-warning/10", text: "text-warning" },
  ELITE: { bg: "bg-warning/10", text: "text-warning" },
  ENTERPRISE: { bg: "bg-warning/10", text: "text-warning" },
};

const PLAN_ORDER = ["ENTERPRISE", "ELITE", "PRO", "STARTER"];

const CHART_STYLE = {
  contentStyle: { background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 },
  tickStyle: { fontSize: 9, fill: "hsl(215 20% 65%)" },
  gridStyle: { strokeDasharray: "3 3" as const, stroke: "hsl(217 32% 12%)" },
};

const PERIODS = ["7d", "30d", "90d"] as const;

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

function FunnelBar({ label, value, total, color, sub }: { label: string; value: number; total: number; color: string; sub?: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {sub && <span className="text-[10px] text-muted-foreground ml-2">{sub}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{value.toLocaleString()} <span className="text-[10px]">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="w-full bg-muted/30 rounded-full h-2.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
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

function UsersTab({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const pageSize = 50;
  const { data, error, isLoading } = useAdminUsers(page, pageSize);

  if (isLoading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load user data.</p></div>;
  if (!data) return null;

  const totalPages = Math.ceil((data.totalCount || 0) / pageSize);

  const filteredUsers = (data.users || []).filter((u: { email: string; plan: string; id: string }) => {
    const matchesSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.plan.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "ALL" || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.totalCount?.toLocaleString()} total users — page {page} of {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PLAN_ORDER.map((plan) => {
            const count = (data.planBreakdown || {})[plan] as number | undefined;
            if (!count) return null;
            const badge = PLAN_BADGE[plan] || PLAN_BADGE.STARTER;
            return (
              <button
                key={plan}
                onClick={() => setPlanFilter(planFilter === plan ? "ALL" : plan)}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-opacity ${badge.bg} ${badge.text} ${planFilter !== "ALL" && planFilter !== plan ? "opacity-40" : "opacity-100"}`}
              >
                {plan}: {count}
              </button>
            );
          })}
          {planFilter !== "ALL" && (
            <button onClick={() => setPlanFilter("ALL")} className="text-[10px] text-muted-foreground hover:text-foreground underline">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by email, plan or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/5 bg-card/80 pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredUsers.length} shown
        </span>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-muted/20">
                <th className="text-left py-2.5 px-3 text-muted-foreground font-semibold">Email</th>
                <th className="text-left py-2.5 px-3 text-muted-foreground font-semibold">Plan</th>
                <th className="text-left py-2.5 px-3 text-muted-foreground font-semibold">Region</th>
                <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">AI Requests</th>
                <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">Tokens</th>
                <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">Credits</th>
                <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">Watchlist</th>
                <th className="text-center py-2.5 px-3 text-muted-foreground font-semibold">Onboarded</th>
                <th className="text-left py-2.5 px-3 text-muted-foreground font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user: {
                id: string; email: string; plan: string; region: string | null;
                aiRequestCount: number; totalTokens: number; watchlistCount: number;
                onboardingCompleted: boolean; createdAt: string; credits?: number;
              }) => {
                const badge = PLAN_BADGE[user.plan] || PLAN_BADGE.STARTER;
                return (
                  <tr key={user.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground max-w-[200px] truncate">{user.email}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{user.region || "—"}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">{user.aiRequestCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{user.totalTokens.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={user.credits !== undefined && user.credits < 10 ? "text-danger" : "text-foreground"}>
                        {user.credits?.toLocaleString() ?? "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{user.watchlistCount}</td>
                    <td className="py-2.5 px-3 text-center">
                      {user.onboardingCompleted ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-success" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">
                  {search || planFilter !== "ALL" ? "No users match your filter" : "No users found"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && !search && planFilter === "ALL" && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.totalCount)} of {data.totalCount?.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-xl border border-white/5 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-3 text-xs font-bold text-foreground">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-xl border border-white/5 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrowthTab() {
  const [period, setPeriod] = useState<AdminUsageRange>("30d");
  const { data, error, isLoading } = useAdminGrowthRange(period);

  if (isLoading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load growth data.</p></div>;
  if (!data) return null;

  const funnel = data.onboardingFunnel || {};
  const retention = data.retentionProxy || {};
  const beginnerKpis = data.beginnerKpis;
  const viral = data.viralStats || {};

  const dau = retention.activeLastDay ?? 0;
  const wau = retention.activeLast7d ?? 0;
  const mau = retention.activeLast30d ?? 0;
  const total = retention.totalUsers ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Range-sensitive KPIs
        </p>
        <div className="inline-flex items-center rounded-xl border border-white/5 bg-background/40 p-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Active Users</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="DAU (fixed 1d)" value={dau} icon={Activity} subtitle={`${(total > 0 ? dau / total * 100 : 0).toFixed(1)}% of users`} color="#22c55e" />
          <MetricCard label="WAU (fixed 7d)" value={wau} icon={TrendingUp} subtitle={`${(total > 0 ? wau / total * 100 : 0).toFixed(1)}% of users`} color="#3b82f6" />
          <MetricCard label="MAU (fixed 30d)" value={mau} icon={UserPlus} subtitle={`${(total > 0 ? mau / total * 100 : 0).toFixed(1)}% of users`} color="#f59e0b" />
          <MetricCard
            label="DAU/MAU Stickiness"
            value={`${(mau > 0 ? dau / mau * 100 : 0).toFixed(1)}%`}
            icon={Target}
            subtitle="Uses fixed 1d / 30d windows"
            color={mau > 0 && dau / mau > 0.2 ? "#22c55e" : "#f59e0b"}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">
          North-Star KPIs ({beginnerKpis?.cohortWindowDays ?? 30}d Cohort)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Cohort Users"
            value={beginnerKpis?.cohortUsers?.toLocaleString() ?? 0}
            icon={UserPlus}
            subtitle={`New users in ${data.selectedRangeDays ?? 30}d window`}
          />
          <MetricCard
            label="Onboarding Rate"
            value={`${beginnerKpis?.onboardingCompletionRate ?? 0}%`}
            icon={Target}
            subtitle={`Completed onboarding in ${data.selectedRangeDays ?? 30}d cohort`}
          />
          <MetricCard
            label="First Value Action"
            value={`${beginnerKpis?.firstValueActionRate ?? 0}%`}
            icon={TrendingUp}
            subtitle={`Used AI or watchlist in ${data.selectedRangeDays ?? 30}d cohort`}
          />
          <MetricCard
            label="D7 Retention"
            value={`${beginnerKpis?.d7RetentionRate ?? 0}%`}
            icon={Activity}
            subtitle={`${beginnerKpis?.d7ReturnedUsers ?? 0}/${beginnerKpis?.d7EligibleUsers ?? 0} returned`}
          />
        </div>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Viral & Referrals</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total Referrals" value={viral.totalReferrals ?? 0} icon={Users} subtitle="All time" color="#3b82f6" />
          <MetricCard label="K-Factor" value={viral.kFactor != null ? `${viral.kFactor}x` : "—"} icon={Repeat2} subtitle={`${viral.referredUsersInRange ?? 0} referred signups in ${data.selectedRangeDays ?? 30}d`} color={viral.kFactor >= 1 ? "#22c55e" : "#f59e0b"} />
          <MetricCard label="Referral Conversion" value={viral.referralConversionRate != null ? `${viral.referralConversionRate}%` : "—"} icon={Target} subtitle={`${viral.convertedReferrals ?? 0} paid conversions`} color="#0ea5e9" />
          <MetricCard label="New Referrals" value={viral.newReferralsInRange ?? 0} icon={Gift} subtitle={`Created in ${data.selectedRangeDays ?? 30}d`} color="#10b981" />
        </div>
      </div>

      {(viral.totalReferrals > 0) && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Referral Funnel (All Time Status Mix)</h3>
          <div className="space-y-3">
            <FunnelBar label="Total Referrals" value={viral.totalReferrals ?? 0} total={viral.totalReferrals ?? 1} color="#3b82f6" />
            <FunnelBar label="Activated" value={viral.activatedReferrals ?? 0} total={viral.totalReferrals ?? 1} color="#0ea5e9" sub="Referee signed up" />
            <FunnelBar label="Completed" value={viral.completedReferrals ?? 0} total={viral.totalReferrals ?? 1} color="#22c55e" sub="Reward earned" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Weekly Signups (Fixed 12 weeks)</h3>
          {(data.signupsByWeek || []).length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.signupsByWeek}>
                  <CartesianGrid {...CHART_STYLE.gridStyle} />
                  <XAxis dataKey="week" tick={CHART_STYLE.tickStyle} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={CHART_STYLE.tickStyle} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Signups" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No weekly data yet</p>}
        </div>

        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Monthly Signups (Fixed 12 months)</h3>
          {(data.signupsByMonth || []).length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.signupsByMonth}>
                  <CartesianGrid {...CHART_STYLE.gridStyle} />
                  <XAxis dataKey="month" tick={CHART_STYLE.tickStyle} />
                  <YAxis tick={CHART_STYLE.tickStyle} />
                  <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Signups" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No monthly data yet</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Onboarding Funnel (All Time)</h3>
        <div className="space-y-3">
          <FunnelBar label="Signed Up" value={funnel.totalUsers ?? 0} total={funnel.totalUsers ?? 1} color="#3b82f6" />
          <FunnelBar label="Set Preferences" value={funnel.withPreferences ?? 0} total={funnel.totalUsers ?? 1} color="#0ea5e9" sub="Region + experience selected" />
          <FunnelBar label="Completed Onboarding" value={funnel.onboardingCompleted ?? 0} total={funnel.totalUsers ?? 1} color="#f59e0b" />
          <FunnelBar label="Made AI Request" value={funnel.withAIRequest ?? 0} total={funnel.totalUsers ?? 1} color="#22c55e" sub="First Lyra query" />
          <FunnelBar label="Created Watchlist" value={funnel.withWatchlist ?? 0} total={funnel.totalUsers ?? 1} color="#06b6d4" sub="Added ≥1 asset" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Retention Proxy (Fixed 1d / 7d / 30d AI Activity)</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Today", value: dau, color: "#22c55e" },
            { label: "Active 7d", value: wau, color: "#3b82f6" },
            { label: "Active 30d", value: mau, color: "#f59e0b" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border/30 bg-muted/20 p-4 text-center space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</span>
              <div className="text-3xl font-bold" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] text-muted-foreground">
                {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}% of {total.toLocaleString()} users
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 italic">
          Retention is proxied via AI request activity. True session-based DAU/MAU still requires event instrumentation.
        </p>
      </div>
    </div>
  );
}

export default function AdminUsersGrowthPage() {
  const [tab, setTab] = useState<"users" | "growth">("users");
  const [userPage, setUserPage] = useState(1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Growth</h1>
          <p className="text-xs text-muted-foreground mt-1">User management, retention, viral analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <TabButton active={tab === "users"} onClick={() => setTab("users")} label="Users" icon={Users} />
          <TabButton active={tab === "growth"} onClick={() => setTab("growth")} label="Growth" icon={TrendingUp} />
        </div>
      </div>

      {tab === "users" ? <UsersTab page={userPage} setPage={setUserPage} /> : <GrowthTab />}
    </div>
  );
}
