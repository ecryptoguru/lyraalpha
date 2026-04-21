"use client";

import React, { useState, useEffect } from "react";
import { createClientLogger } from "@/lib/logger/client";
import { useAdminCredits } from "@/hooks/use-admin";
import {
  Loader2,
  ShieldAlert,
  Coins,
  TrendingDown,
  TrendingUp,
  Users,
  Gift,
  Package,
  UserCheck,
  Send,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  PURCHASE: "#22c55e",
  SUBSCRIPTION_MONTHLY: "#3b82f6",
  REFERRAL_BONUS: "#f59e0b",
  REFERRAL_REDEEMED: "#f97316",
  BONUS: "#0ea5e9",
  SPENT: "#ef4444",
  ADJUSTMENT: "#64748b",
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#64748b",
  PRO: "#3b82f6",
  ELITE: "#f59e0b",
  ENTERPRISE: "#22c55e",
};

interface BulkAwardUser {
  id: string;
  email: string;
  credits: number;
}

function BulkCreditAward({ onAwarded }: { onAwarded: () => Promise<unknown> | unknown }) {
  const [users, setUsers] = useState<BulkAwardUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/admin/credits/bulk-award");
      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (err) {
      createClientLogger("admin-credits").error("Failed to load users", { err: String(err) });
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filtered = users.filter(
    (u) => u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAward = async () => {
    if (!reason || selected.length === 0 || amount <= 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/credits/bulk-award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selected, amount, reason }),
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        message: res.ok
          ? `Awarded ${data.totalCredits?.toLocaleString()} credits to ${data.awarded} users`
          : data.error || "Failed",
      });
      if (res.ok) {
        setSelected([]);
        setReason("");
        await Promise.all([loadUsers(), Promise.resolve(onAwarded())]);
      }
    } catch {
      setResult({ success: false, message: "Request failed" });
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Send className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-primary">Bulk Credit Award</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Amount per user</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Reason (for audit trail)</label>
          <input
            type="text"
            placeholder="e.g., Bug bounty reward, VIP promotion, Customer support goodwill"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto border border-border rounded-xl mb-4">
        {filtered.slice(0, 50).map((user) => (
          <label
            key={user.id}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${
              selected.includes(user.id) ? "bg-primary/10" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(user.id)}
              onChange={() => toggleUser(user.id)}
              className="rounded border-border"
            />
            <span className="text-sm flex-1 truncate">{user.email}</span>
            <span className="text-xs text-muted-foreground">{user.credits?.toLocaleString() || 0} credits</span>
          </label>
        ))}
        {filtered.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No users found</div>}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {selected.length > 0 ? (
            <span className="text-primary font-medium">{selected.length} user(s) selected</span>
          ) : (
            <span className="text-muted-foreground">Select users to award credits</span>
          )}
        </div>
        <button
          onClick={handleAward}
          disabled={loading || selected.length === 0 || !reason || amount <= 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          Award Credits
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 flex items-center gap-2 text-sm ${
            result.success ? "text-success" : "text-danger"
          }`}
        >
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  accent?: "green" | "red" | "blue" | "amber";
}) {
  const accentMap: Record<string, string> = {
    green: "text-success",
    red: "text-danger",
    blue: "text-warning",
    amber: "text-warning",
  };
  const accentClass = accent ? (accentMap[accent] ?? "text-muted-foreground/60") : "text-muted-foreground/60";

  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-3.5 w-3.5 ${accentClass}`} />
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

export default function AdminCreditsPage() {
  const { data, error, isLoading, mutate } = useAdminCredits();

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
        <p className="text-sm text-muted-foreground">Failed to load credit stats.</p>
      </div>
    );
  if (!data) return null;

  const txTypeData = (data.transactionsByType || []).map(
    (r: { type: string; count: number; totalAmount: number }) => ({
      name: r.type.replace(/_/g, " "),
      count: r.count,
      amount: Math.abs(r.totalAmount),
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credits & Referrals</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Credit economy — issuance, spend, referrals and top users
        </p>
      </div>

      {/* Bulk Credit Award */}
      <BulkCreditAward onAwarded={mutate} />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <MetricCard
          label="Total Issued"
          value={data.totalCreditsIssued?.toLocaleString() ?? 0}
          icon={TrendingUp}
          accent="green"
        />
        <MetricCard
          label="Total Spent"
          value={data.totalCreditsSpent?.toLocaleString() ?? 0}
          icon={TrendingDown}
          accent="red"
        />
        <MetricCard
          label="Purchased"
          value={data.totalCreditsPurchased?.toLocaleString() ?? 0}
          icon={Coins}
          accent="amber"
          subtitle="via Stripe/Razorpay"
        />
        <MetricCard
          label="Subscription"
          value={data.totalCreditsFromSubscription?.toLocaleString() ?? 0}
          icon={Package}
          accent="blue"
          subtitle="monthly allocations"
        />
        <MetricCard
          label="Referral Credits"
          value={data.totalCreditsFromReferral?.toLocaleString() ?? 0}
          icon={UserCheck}
          accent="amber"
        />
        <MetricCard
          label="Bonus Credits"
          value={data.totalCreditsBonus?.toLocaleString() ?? 0}
          icon={Gift}
        />
        <MetricCard
          label="Users w/ Txns"
          value={data.usersWithTransactions ?? 0}
          icon={Users}
        />
        <MetricCard
          label="Avg Spent/User"
          value={data.avgCreditsSpentPerUser ?? 0}
          icon={TrendingDown}
          accent="red"
          subtitle="credits"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Current Active"
          value={data.liveActiveBalances?.total?.toLocaleString() ?? 0}
          icon={Coins}
          accent="green"
          subtitle="active credits now"
        />
        <MetricCard
          label="Monthly Active"
          value={data.liveActiveBalances?.monthly?.toLocaleString() ?? 0}
          icon={Package}
          accent="blue"
        />
        <MetricCard
          label="Bonus Active"
          value={data.liveActiveBalances?.bonus?.toLocaleString() ?? 0}
          icon={Gift}
          accent="amber"
        />
        <MetricCard
          label="Purchased Active"
          value={data.liveActiveBalances?.purchased?.toLocaleString() ?? 0}
          icon={Coins}
          accent="green"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          label="Expiring 30d"
          value={data.expiringNext30Days?.total?.toLocaleString() ?? 0}
          icon={AlertCircle}
          accent="red"
          subtitle={`${data.expiringNext30Days?.lots ?? 0} active lots`}
        />
        <MetricCard
          label="Bonus Expiring"
          value={data.expiringNext30Days?.bonus?.toLocaleString() ?? 0}
          icon={Gift}
          accent="red"
        />
        <MetricCard
          label="Purchased Expiring"
          value={data.expiringNext30Days?.purchased?.toLocaleString() ?? 0}
          icon={Coins}
          accent="amber"
        />
      </div>

      {/* Referral Stats */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">
          Referral Programme
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Total Referrals"
            value={data.referralStats?.totalReferrals ?? 0}
            icon={UserCheck}
          />
          <MetricCard
            label="Activated"
            value={data.referralStats?.activatedReferrals ?? 0}
            icon={UserCheck}
            accent="blue"
            subtitle="referee used 10+ credits"
          />
          <MetricCard
            label="Completed"
            value={data.referralStats?.completedReferrals ?? 0}
            icon={UserCheck}
            accent="green"
            subtitle="both parties rewarded"
          />
          <MetricCard
            label="Activation Rate"
            value={`${data.referralStats?.activationRate ?? 0}%`}
            icon={TrendingUp}
            accent="amber"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend vs Issued (30d) */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Credits Issued vs Spent (30d)
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.spendByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }}
                  tickFormatter={(v: string) => v.slice(5)}
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
                <Line
                  type="monotone"
                  dataKey="issued"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Issued"
                />
                <Line
                  type="monotone"
                  dataKey="spent"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="Spent"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions by Type */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Transactions by Type
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={txTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222 47% 8%)",
                    border: "1px solid hsl(217 32% 12%)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                  {txTypeData.map((entry: { name: string }) => {
                    const key = entry.name.replace(/ /g, "_");
                    return (
                      <Cell key={key} fill={TYPE_COLORS[key] || "#64748b"} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      {data.creditPackages && data.creditPackages.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Credit Packages
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.creditPackages.map(
              (pkg: { name: string; credits: number; priceUsd: number; isActive: boolean }) => (
                <div
                  key={pkg.name}
                  className={`rounded-xl border p-3 space-y-1 ${
                    pkg.isActive
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/30 opacity-50"
                  }`}
                >
                  <p className="text-xs font-bold">{pkg.name}</p>
                  <p className="text-lg font-bold text-primary">{pkg.credits.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">credits</p>
                  <p className="text-xs text-muted-foreground">${pkg.priceUsd.toFixed(2)} USD</p>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      pkg.isActive
                        ? "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {pkg.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Top Spenders */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Top Credit Spenders
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">#</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">User</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Plan</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Spent</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(
                data.topSpenders as {
                  userId: string;
                  email: string;
                  plan: string;
                  spent: number;
                  balance: number;
                }[]
              ).map((row, i) => (
                <tr key={row.userId} className="border-b border-border/20">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 text-muted-foreground">{row.email}</td>
                  <td className="py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: `${PLAN_COLORS[row.plan] || "#64748b"}20`,
                        color: PLAN_COLORS[row.plan] || "#64748b",
                      }}
                    >
                      {row.plan}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-danger">
                    {row.spent.toLocaleString()}
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${
                      row.balance >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {row.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!data.topSpenders || data.topSpenders.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    No credit transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
