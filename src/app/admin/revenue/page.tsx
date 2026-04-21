"use client";

import React from "react";
import { useAdminRevenue, useAdminCredits } from "@/hooks/use-admin";
import { Loader2, ShieldAlert, DollarSign, TrendingUp, Users, CreditCard, Coins, AlertTriangle, RotateCcw } from "lucide-react";
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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#22c55e",
  PAST_DUE: "#f59e0b",
  CANCELED: "#ef4444",
  INCOMPLETE: "#64748b",
  TRIALING: "#3b82f6",
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#64748b",
  PRO: "#3b82f6",
  ELITE: "#f59e0b",
  ENTERPRISE: "#0ea5e9",
};

function MetricCard({ label, value, icon: Icon, subtitle, accent }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; subtitle?: string; accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent || "text-muted-foreground/60"}`} />
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

const CHART_STYLE = {
  contentStyle: { background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 },
  tickStyle: { fontSize: 10, fill: "hsl(215 20% 65%)" },
  gridStyle: { strokeDasharray: "3 3" as const, stroke: "hsl(217 32% 12%)" },
};

export default function AdminRevenuePage() {
  const { data, error, isLoading } = useAdminRevenue();
  const { data: creditsData } = useAdminCredits();

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load revenue data.</p></div>;
  if (!data) return null;

  const planDistribution: { plan: string; count: number; revenue: number }[] = data.planDistribution || [];
  const paidSubscriptions = planDistribution.filter(d => d.plan !== "STARTER").reduce((s, d) => s + d.count, 0);
  const arpu = paidSubscriptions > 0 ? (data.mrr / paidSubscriptions) : 0;

  const statusPieData = Object.entries(data.subscriptionsByStatus || {}).map(([status, count]) => ({
    name: status,
    value: count as number,
  }));

  const growthData = [...(data.userGrowthByMonth || [])].reverse();

  const purchasedCredits = creditsData
    ? creditsData.transactionsByType?.find((t: { type: string }) => t.type === "PURCHASE")?.totalAmount ?? 0
    : 0;

  // Event type breakdown
  const paymentEventTypes = Object.entries(data.recentPaymentEvents?.reduce((acc: Record<string, number>, e: { eventType: string }) => {
    acc[e.eventType] = (acc[e.eventType] || 0) + 1;
    return acc;
  }, {}) || {}).map(([type, count]) => ({ type, count: count as number }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue Analytics</h1>
        <p className="text-xs text-muted-foreground mt-1">Subscription-derived MRR/ARR, credit purchases, churn, payment health</p>
      </div>

      {/* Primary Revenue KPIs */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Subscription Revenue</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="MRR"
            value={`$${(data.mrr ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            accent="text-success"
            subtitle="Monthly recurring"
          />
          <MetricCard
            label="ARR"
            value={`$${(data.arr ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            subtitle="Annual run rate"
          />
          <MetricCard
            label="ARPU (Paid)"
            value={`$${arpu.toFixed(2)}`}
            icon={Users}
            subtitle="Monthly avg per paid subscription"
          />
          <MetricCard
            label="Active Subs"
            value={data.subscriptionsByStatus?.ACTIVE ?? 0}
            icon={CreditCard}
            subtitle={`${paidSubscriptions} paid subscription records`}
          />
        </div>
      </div>

      {/* Credit Activity + Churn */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Credit Activity & Health</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Credits Purchased (30d)"
            value={Number(purchasedCredits).toLocaleString()}
            icon={Coins}
            accent="text-warning"
            subtitle="Credit units issued via purchase"
          />
          <MetricCard
            label="Credit Transactions (30d)"
            value={creditsData?.transactionsByType?.find((t: { type: string }) => t.type === "PURCHASE")?.count ?? 0}
            icon={Coins}
            subtitle="Purchase transactions"
          />
          <MetricCard
            label="30d Churn Rate"
            value={`${data.churnRate ?? 0}%`}
            icon={AlertTriangle}
            accent={(data.churnRate ?? 0) > 5 ? "text-danger" : "text-success"}
            subtitle="Cancellations / active subs"
          />
          <MetricCard
            label="Past Due"
            value={data.subscriptionsByStatus?.PAST_DUE ?? 0}
            icon={AlertTriangle}
            accent={(data.subscriptionsByStatus?.PAST_DUE ?? 0) > 0 ? "text-warning" : "text-muted-foreground/60"}
            subtitle="Need payment recovery"
          />
        </div>
      </div>

      {/* Refunds (30d) — Stripe charge.refunded events + credit clawback tracking */}
      {data.refunds && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Refunds & Clawback (30d)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard
              label="Refund Events"
              value={data.refunds.count30d}
              icon={RotateCcw}
              accent={data.refunds.count30d > 0 ? "text-warning" : "text-muted-foreground/60"}
              subtitle="charge.refunded webhook events"
            />
            <MetricCard
              label="Refunded Amount"
              value={`$${(data.refunds.totalAmountMinorUnits / 100).toFixed(2)}`}
              icon={DollarSign}
              accent={data.refunds.totalAmountMinorUnits > 0 ? "text-warning" : "text-muted-foreground/60"}
              subtitle="Gross Stripe amount refunded"
            />
            <MetricCard
              label="Credits Clawed Back"
              value={data.refunds.creditsClawedBack30d.toLocaleString()}
              icon={Coins}
              accent={data.refunds.creditsClawedBack30d > 0 ? "text-warning" : "text-muted-foreground/60"}
              subtitle="Auto-deducted via refund-clawback"
            />
          </div>
          {data.refunds.recent.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 mt-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Refunds</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-2 text-muted-foreground font-semibold">Date</th>
                      <th className="text-left py-2 text-muted-foreground font-semibold">User ID</th>
                      <th className="text-right py-2 text-muted-foreground font-semibold">Amount</th>
                      <th className="text-left py-2 text-muted-foreground font-semibold">Stripe Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.refunds.recent.map((r: { id: string; timestamp: string; userId: string; amount: number | null; currency: string | null; stripeObjectId: string | null }) => (
                      <tr key={r.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                        <td className="py-2 text-muted-foreground whitespace-nowrap">{new Date(r.timestamp).toLocaleDateString()}</td>
                        <td className="py-2 text-muted-foreground font-mono">{r.userId.slice(0, 12)}…</td>
                        <td className="py-2 text-right font-mono text-warning">
                          {r.amount != null ? `$${(r.amount / 100).toFixed(2)}` : "—"}
                          {r.currency && <span className="text-[10px] text-muted-foreground ml-1">{r.currency.toUpperCase()}</span>}
                        </td>
                        <td className="py-2 text-muted-foreground font-mono text-[10px]">
                          {r.stripeObjectId ? `${r.stripeObjectId.slice(0, 16)}…` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Plan (bars) */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Revenue & Subscriptions by Plan</h3>
          {planDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planDistribution.map(d => ({ ...d, name: d.plan }))}>
                  <CartesianGrid {...CHART_STYLE.gridStyle} />
                  <XAxis dataKey="name" tick={CHART_STYLE.tickStyle} />
                  <YAxis tick={CHART_STYLE.tickStyle} />
                  <Tooltip
                    contentStyle={CHART_STYLE.contentStyle}
                    formatter={(value, name) => {
                      const numeric = typeof value === "number" ? value : Number(value);
                      const safeValue = Number.isFinite(numeric) ? numeric : 0;
                      const nameStr = typeof name === "string" ? name : String(name ?? "");
                      return [
                        nameStr === "revenue" ? `$${safeValue.toLocaleString()}` : safeValue.toLocaleString(),
                        nameStr === "revenue" ? "Revenue ($)" : "Subscriptions",
                      ] as [string, string];
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Subscriptions" />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} name="revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No plan data</p>}
        </div>

        {/* Subscription Status Pie */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Subscription Status</h3>
          {statusPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-44 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={32} outerRadius={65} paddingAngle={2} dataKey="value">
                      {statusPieData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {statusPieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.name] || "#64748b" }} />
                      <span className="text-xs font-semibold">{entry.name}</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">No subscription data</p>}
        </div>
      </div>

      {/* User Growth by Month */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">New User Signups by Month (12 months)</h3>
        {growthData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <CartesianGrid {...CHART_STYLE.gridStyle} />
                <XAxis dataKey="month" tick={CHART_STYLE.tickStyle} />
                <YAxis tick={CHART_STYLE.tickStyle} />
                <Tooltip contentStyle={CHART_STYLE.contentStyle} />
                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="New Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-xs text-muted-foreground">No growth data</p>}
      </div>

      {/* Plan Revenue Detail Table */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Plan Subscription Revenue Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Plan</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Subscriptions</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">MRR</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">ARR</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">% of MRR</th>
              </tr>
            </thead>
            <tbody>
              {planDistribution.map((row) => (
                <tr key={row.plan} className="border-b border-border/20">
                  <td className="py-2.5">
                    <span style={{ color: PLAN_COLORS[row.plan] || "#64748b" }} className="font-bold">{row.plan}</span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-foreground">{row.count.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono text-success">${row.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td className="py-2.5 text-right font-mono text-muted-foreground">${(row.revenue * 12).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {(data.mrr ?? 0) > 0 ? `${((row.revenue / data.mrr) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Counts and revenue here are derived from subscription records in billable states, not directly from user profile plan values.</p>
      </div>

      {/* Recent Payment Events */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Payment Events</h3>
          <div className="flex gap-2 flex-wrap">
            {paymentEventTypes.map(({ type, count }) => (
              <span key={type} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                {type}: {count}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Event</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Provider</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">User</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentPaymentEvents || []).slice(0, 15).map((evt: { id: string; eventType: string; provider: string; userId: string | null; processedAt: string }) => (
                <tr key={evt.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="py-2 font-medium text-foreground">{evt.eventType}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${evt.provider === "STRIPE" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                      {evt.provider}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground font-mono">{evt.userId ? evt.userId.slice(0, 12) + "…" : "—"}</td>
                  <td className="py-2 text-muted-foreground">{new Date(evt.processedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!data.recentPaymentEvents || data.recentPaymentEvents.length === 0) && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No payment events</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
