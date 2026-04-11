"use client";

import React from "react";
import { useAdminAICosts } from "@/hooks/use-admin";
import { Loader2, ShieldAlert, Brain, Zap, Database, TrendingUp, Mic } from "lucide-react";
import {
  estimateVoiceSessionCost,
  REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE,
  REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE,
  REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS,
  REALTIME_VOICE_DEFAULT_TEXT_OUTPUT_TOKENS_PER_MINUTE,
  REALTIME_VOICE_PRICING,
} from "@/lib/ai/cost-calculator";
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

export default function AdminAICostsPage() {
  const { data, error, isLoading } = useAdminAICosts();

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3"><ShieldAlert className="h-8 w-8 text-destructive" /><p className="text-sm text-muted-foreground">Failed to load AI cost data.</p></div>;
  if (!data) return null;

  const dailyData = [...(data.requestsByDay || [])].reverse();
  const cacheSharePct = data.inputTokens > 0
    ? (data.cachedInputTokens / data.inputTokens) * 100
    : 0;
  const routeShare = data.modelRouteSharePercent || { gpt: 0, other: 0 };
  const embedding = data.embeddingStatusBreakdown || {
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Cost Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-1">Token usage, cost tracking, heavy user detection</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Requests" value={data.totalRequests?.toLocaleString() ?? 0} icon={Brain} />
        <MetricCard label="Total Tokens" value={data.totalTokens?.toLocaleString() ?? 0} icon={Database} />
        <MetricCard label="Avg Tokens/Request" value={data.avgTokensPerRequest?.toLocaleString() ?? 0} icon={Zap} />
        <MetricCard
          label="Total AI Cost"
          value={`$${(data.totalCostUsd ?? 0).toFixed(2)}`}
          icon={TrendingUp}
          subtitle={`$${(data.avgCostPerRequestUsd ?? 0).toFixed(4)}/request`}
        />
      </div>

      {/* Token Mix */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Input Tokens" value={(data.inputTokens ?? 0).toLocaleString()} icon={Database} />
        <MetricCard label="Output Tokens" value={(data.outputTokens ?? 0).toLocaleString()} icon={Zap} />
        <MetricCard label="Cached Input" value={(data.cachedInputTokens ?? 0).toLocaleString()} icon={Database} subtitle={`${cacheSharePct.toFixed(1)}% of input`} />
        <MetricCard label="Reasoning Tokens" value={(data.reasoningTokens ?? 0).toLocaleString()} icon={Brain} />
      </div>

      {/* Efficiency & Routing KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Cache Efficiency"
          value={`${(data.cacheEfficiencyPercent ?? 0).toFixed(1)}%`}
          icon={Database}
          subtitle="Cached input / total input"
        />
        <MetricCard
          label="Fallback Rate"
          value={`${(data.fallbackRatePercent ?? 0).toFixed(1)}%`}
          icon={ShieldAlert}
          subtitle="Model fallback recoveries"
        />
        <MetricCard
          label="Cost / 1K Tokens"
          value={`$${(data.costPer1kTokensUsd ?? 0).toFixed(4)}`}
          icon={TrendingUp}
          subtitle="Blended effective rate"
        />
        <MetricCard
          label="Model Route Mix"
          value={`GPT:${routeShare.gpt.toFixed(0)}% • Other:${(routeShare.other ?? 0).toFixed(0)}%`}
          icon={Brain}
          subtitle="GPT-5.4 Nano / Mini / Full routing"
        />
      </div>

      {/* Embedding Pipeline Health */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Embedding Pipeline Health</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Pending" value={embedding.pending.toLocaleString()} icon={Database} />
          <MetricCard label="Processing" value={embedding.processing.toLocaleString()} icon={Loader2} />
          <MetricCard label="Done" value={embedding.done.toLocaleString()} icon={TrendingUp} />
          <MetricCard label="Failed" value={embedding.failed.toLocaleString()} icon={ShieldAlert} />
        </div>
      </div>

      {/* Daily Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Requests per Day */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Requests per Day (14d)</h3>
          {dailyData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No daily data</p>}
        </div>

        {/* Token Usage per Day */}
        <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Token Usage per Day (14d)</h3>
          {dailyData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} />
                  <Tooltip contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="tokens" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">No daily data</p>}
        </div>
      </div>

      {/* Cost per Day */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">AI Cost per Day (14d)</h3>
        {dailyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 12%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 65%)" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 65%)" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 8%)", border: "1px solid hsl(217 32% 12%)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value) => [`$${Number(value ?? 0).toFixed(4)}`, "Cost"]}
                />
                <Bar dataKey="costUsd" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-xs text-muted-foreground">No cost data</p>}
      </div>

      {/* Top Users by Token Usage */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Top Users by Token Usage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">#</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Email</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Requests</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Tokens</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {(data.topUsers || []).map((user: { userId: string; email: string; count: number; tokens: number; costUsd: number }, i: number) => {
                return (
                  <tr key={user.userId} className="border-b border-border/20">
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium text-foreground">{user.email}</td>
                    <td className="py-2 text-right text-muted-foreground">{user.count.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-foreground">{user.tokens.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-amber-400">${(user.costUsd ?? 0).toFixed(4)}</td>
                  </tr>
                );
              })}
              {(!data.topUsers || data.topUsers.length === 0) && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No user data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Cost Breakdown */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Model Cost Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Model</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Requests</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Tokens</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Cost</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Avg / Request</th>
              </tr>
            </thead>
            <tbody>
              {(data.modelCostBreakdown || []).map((row: { model: string; count: number; tokens: number; costUsd: number }) => {
                const avgCost = row.count > 0 ? row.costUsd / row.count : 0;
                return (
                  <tr key={row.model} className="border-b border-border/20">
                    <td className="py-2 font-mono text-foreground">{row.model}</td>
                    <td className="py-2 text-right text-muted-foreground">{row.count.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-foreground">{row.tokens.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-amber-400">${row.costUsd.toFixed(4)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">${avgCost.toFixed(5)}</td>
                  </tr>
                );
              })}
              {(!data.modelCostBreakdown || data.modelCostBreakdown.length === 0) && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No model data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voice Agent Cost Reference */}
      {(() => {
        const per1min  = estimateVoiceSessionCost(60,  REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS, 0);
        const per1minC = estimateVoiceSessionCost(60,  REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS, REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS);
        const per3min  = estimateVoiceSessionCost(180, REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS, REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS);
        const per5min  = estimateVoiceSessionCost(300, REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS, REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS);
        const rows = [
          { label: "1 min  (cold — no cache)",   cost: per1min  },
          { label: "1 min  (warm — instructions cached)", cost: per1minC },
          { label: "3 min  (warm)", cost: per3min },
          { label: "5 min  (warm)", cost: per5min },
        ];
        const p = REALTIME_VOICE_PRICING;
        return (
          <div className="rounded-2xl border border-amber-400/20 bg-card/80 backdrop-blur-xl p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Myra Voice Agent — gpt-realtime-mini Cost Reference
              </h3>
            </div>

            {/* Pricing table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 text-muted-foreground font-semibold">Modality</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold">Input / M tokens</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold">Cached Input / M</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold">Output / M tokens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/20">
                    <td className="py-2 font-medium text-foreground">Audio</td>
                    <td className="py-2 text-right font-mono text-amber-400">${p.audioInputPerMillion.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-emerald-400">${p.cachedAudioInputPerMillion.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-amber-400">${p.audioOutputPerMillion.toFixed(2)}</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 font-medium text-foreground">Text</td>
                    <td className="py-2 text-right font-mono text-amber-400">${p.textInputPerMillion.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-emerald-400">${p.cachedTextInputPerMillion.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-amber-400">${p.textOutputPerMillion.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Assumptions note */}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Assumptions: ~{REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE} audio input tokens/min · {REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE} audio output tokens/min · {REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS.toLocaleString()} text tokens for system instructions · {REALTIME_VOICE_DEFAULT_TEXT_OUTPUT_TOKENS_PER_MINUTE} text output tokens/min for transcripts.
            </p>

            {/* Per-session estimates */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 text-muted-foreground font-semibold">Session duration</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold">Audio in</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold">Audio out</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold">Text</th>
                    <th className="text-right py-2 text-muted-foreground font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ label, cost }) => (
                    <tr key={label} className="border-b border-border/20">
                      <td className="py-2 text-foreground">{label}</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">${cost.audioInputCost.toFixed(4)}</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">${cost.audioOutputCost.toFixed(4)}</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        ${(cost.textInputCost + cost.cachedTextInputCost + cost.textOutputCost).toFixed(4)}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-amber-400">${cost.totalCost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick KPI callouts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {[
                { label: "Cost / min (cold)",  value: `$${per1min.totalCost.toFixed(4)}`  },
                { label: "Cost / min (cached)", value: `$${per1minC.totalCost.toFixed(4)}` },
                { label: "Cost / 3 min",        value: `$${per3min.totalCost.toFixed(4)}`  },
                { label: "Cost / 5 min",        value: `$${per5min.totalCost.toFixed(4)}`  },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-white/5 bg-card/60 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                  <div className="text-lg font-bold text-amber-400">{value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Plan × Model Breakdown */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Plan × Model Cost Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 text-muted-foreground font-semibold">Plan</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Model</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Requests</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {(data.planModelBreakdown || []).map((row: { plan: string; model: string; count: number; costUsd: number }) => (
                <tr key={`${row.plan}-${row.model}`} className="border-b border-border/20">
                  <td className="py-2 text-foreground font-medium">{row.plan}</td>
                  <td className="py-2 font-mono text-foreground">{row.model}</td>
                  <td className="py-2 text-right text-muted-foreground">{row.count.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono text-amber-400">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
              {(!data.planModelBreakdown || data.planModelBreakdown.length === 0) && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No plan-model data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
