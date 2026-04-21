"use client";

import React, { useState } from "react";
import { Loader2, ShieldAlert, Sliders, Bell, RotateCcw, Save, Activity, AlertTriangle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import useSWR from "swr";
import { useAdminAIOps } from "@/hooks/use-admin";

interface AILimitsData {
  caps: Record<string, number>;
  defaults: Record<string, number>;
  alertThresholds: Record<string, number>;
  alertThresholdsDefaults: Record<string, number>;
}

async function fetchLimits(): Promise<AILimitsData> {
  const res = await fetch("/api/admin/ai-limits");
  if (!res.ok) throw new Error("Failed to fetch AI limits");
  return res.json() as Promise<AILimitsData>;
}

async function updateLimit(payload: {
  type: "caps" | "alertThresholds";
  plan?: string;
  key?: string;
  value: number | null;
}) {
  const res = await fetch("/api/admin/ai-limits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Update failed");
  }
}

const PLAN_ORDER = ["STARTER", "PRO", "ELITE"] as const;

const ALERT_THRESHOLD_LABELS: Record<string, { label: string; unit: string; description: string }> = {
  dailyCostUsd: { label: "Daily Cost Alert", unit: "USD", description: "Alert when today's total AI spend (interactive + cron) exceeds this amount" },
  ragZeroResultRatePct: { label: "RAG Zero-Result Rate", unit: "%", description: "Alert when % of requests with 0 RAG chunks exceeds this (15-min window)" },
  webSearchConsecutiveFailures: { label: "Web Search Failures", unit: "consecutive", description: "Alert after this many consecutive Tavily failures. Circuit breaker trips at 3." },
  outputValidationFailureRatePct: { label: "Output Validation Failure Rate", unit: "%", description: "Alert when % of responses failing section checks exceeds this (15-min window)" },
  fallbackRatePct: { label: "Nano Fallback Alert", unit: "%", description: "Alert when % of requests falling back to nano exceeds this (15-min window). Warn-level." },
  fallbackRateMitigationPct: { label: "Nano Fallback Auto-Mitigation", unit: "%", description: "Above this rate, service auto-flips primary to backup model for 30 min (critical-level). Must be > alert threshold." },
  latencyViolationRatePct: { label: "Latency Budget Violation Rate", unit: "%", description: "Alert when % of requests exceeding their per-tier latency budget exceeds this (15-min window)" },
  costEstimationDriftPct: { label: "Token-Estimator Drift", unit: "%", description: "Alert when the char→token ratio drifts this far from actual tokenizer over a 1h window. Signals tokenizer/model change." },
};

function EditableRow({
  label,
  currentVal,
  defaultVal,
  unit,
  description,
  onSave,
  onReset,
}: {
  label: string;
  currentVal: number;
  defaultVal: number;
  unit: string;
  description?: string;
  onSave: (val: number) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(isFinite(currentVal) ? currentVal : ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOverridden = currentVal !== defaultVal;

  const handleSave = async () => {
    const n = Number(input);
    if (isNaN(n) || n <= 0) { setError("Must be a positive number"); return; }
    setSaving(true); setError(null);
    try { await onSave(n); setEditing(false); } catch (e) { setError((e as Error).message); }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true); setError(null);
    try { await onReset(); setEditing(false); setInput(String(defaultVal)); } catch (e) { setError((e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {isOverridden && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">
              overridden
            </span>
          )}
        </div>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Default: <span className="font-mono">{isFinite(defaultVal) ? `${defaultVal.toLocaleString()} ${unit}` : "Uncapped"}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-28 rounded-lg bg-muted border border-white/10 px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <span className="text-[10px] text-muted-foreground">{unit}</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-primary/90 hover:bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
            {isOverridden && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-muted hover:bg-muted/70 px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
            <button
              onClick={() => { setEditing(false); setError(null); setInput(String(isFinite(currentVal) ? currentVal : "")); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className={`font-mono text-sm font-bold ${isOverridden ? "text-warning" : "text-foreground"}`}>
              {isFinite(currentVal) ? `${currentVal.toLocaleString()} ${unit}` : "Uncapped"}
            </span>
            <button
              onClick={() => { setEditing(true); setInput(String(isFinite(currentVal) ? currentVal : "")); }}
              className="rounded-lg bg-muted hover:bg-muted/70 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Edit
            </button>
          </>
        )}
      </div>

      {error && <p className="text-[10px] text-destructive mt-1 col-span-full">{error}</p>}
    </div>
  );
}

interface AIOpsData {
  dailyCost: { date: string; cumulativeCostUsd: number; thresholdUsd: number; pctOfThreshold: number };
  fallbackMitigation: { active: boolean; ttlSeconds: number | null };
  fallbackByDeployment: {
    windowMinutes: number;
    rows: { deployment: string; total: number; fallbacks: number; fallbackRatePct: number }[];
  };
  cronLlm: {
    windowHours: number;
    rows: { job: string; calls: number; failures: number; failureRatePct: number; avgLatencyMs: number; totalCostUsd: number }[];
  };
  webSearchCircuit: { consecutiveFailures: number; tripped: boolean } | null;
}

function RuntimeOpsPanel() {
  const { data, error, isLoading } = useAdminAIOps();
  const ops = (data ?? null) as AIOpsData | null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ops) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-xs text-destructive">
        Failed to load runtime ops snapshot.
      </div>
    );
  }

  const pct = ops.dailyCost.pctOfThreshold;
  const costColor = pct >= 100 ? "text-danger" : pct >= 75 ? "text-warning" : "text-success";
  const barWidth = Math.min(100, pct);
  const barColor = pct >= 100 ? "#ef4444" : pct >= 75 ? "#f59e0b" : "#22c55e";

  return (
    <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Runtime Ops Snapshot
        </h3>
        <span className="text-[9px] text-muted-foreground ml-auto">Auto-refresh 15s</span>
      </div>

      {/* Daily cost burn bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="text-xs font-semibold text-foreground">Daily AI Spend ({ops.dailyCost.date})</span>
          </div>
          <span className={`text-sm font-bold font-mono ${costColor}`}>
            ${ops.dailyCost.cumulativeCostUsd.toFixed(2)} / ${ops.dailyCost.thresholdUsd}
            <span className="text-[10px] font-normal text-muted-foreground ml-2">({pct}%)</span>
          </span>
        </div>
        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, background: barColor }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Accumulates interactive + cron LLM cost. Alerts when over threshold, cooldown 15 min.
        </p>
      </div>

      {/* Fallback mitigation + web-search circuit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-muted/10 p-3 space-y-1">
          <div className="flex items-center gap-2">
            {ops.fallbackMitigation.active ? (
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            )}
            <span className="text-xs font-semibold text-foreground">Nano Fallback Mitigation</span>
          </div>
          <p className={`text-sm font-mono font-bold ${ops.fallbackMitigation.active ? "text-warning" : "text-success"}`}>
            {ops.fallbackMitigation.active ? "ACTIVE" : "Inactive"}
          </p>
          {ops.fallbackMitigation.active && ops.fallbackMitigation.ttlSeconds && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Auto-resets in {Math.ceil(ops.fallbackMitigation.ttlSeconds / 60)} min
            </p>
          )}
        </div>

        {ops.webSearchCircuit && (
          <div className="rounded-xl border border-white/5 bg-muted/10 p-3 space-y-1">
            <div className="flex items-center gap-2">
              {ops.webSearchCircuit.tripped ? (
                <AlertTriangle className="h-3.5 w-3.5 text-danger" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              )}
              <span className="text-xs font-semibold text-foreground">Web Search Circuit (Tavily)</span>
            </div>
            <p className={`text-sm font-mono font-bold ${ops.webSearchCircuit.tripped ? "text-danger" : "text-success"}`}>
              {ops.webSearchCircuit.consecutiveFailures} consecutive failures
            </p>
            <p className="text-[10px] text-muted-foreground">
              {ops.webSearchCircuit.tripped ? "Tripped — search disabled" : "Healthy"}
            </p>
          </div>
        )}
      </div>

      {/* Per-deployment fallback breakdown (15-min window) */}
      {ops.fallbackByDeployment.rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Per-Deployment Fallback (last {ops.fallbackByDeployment.windowMinutes} min)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-muted-foreground text-[10px] uppercase">
                  <th className="text-left py-1.5 font-semibold">Deployment</th>
                  <th className="text-right py-1.5 font-semibold">Calls</th>
                  <th className="text-right py-1.5 font-semibold">Fallbacks</th>
                  <th className="text-right py-1.5 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {ops.fallbackByDeployment.rows.map((row) => (
                  <tr key={row.deployment} className="border-b border-border/20">
                    <td className="py-1.5 font-mono text-foreground">{row.deployment}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{row.total.toLocaleString()}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{row.fallbacks.toLocaleString()}</td>
                    <td className={`py-1.5 text-right font-mono font-bold ${row.fallbackRatePct >= 15 ? "text-danger" : row.fallbackRatePct >= 10 ? "text-warning" : "text-success"}`}>
                      {row.fallbackRatePct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cron LLM window */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-foreground">Cron LLM Jobs (last {ops.cronLlm.windowHours}h)</span>
        {ops.cronLlm.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-muted-foreground text-[10px] uppercase">
                  <th className="text-left py-1.5 font-semibold">Job</th>
                  <th className="text-right py-1.5 font-semibold">Calls</th>
                  <th className="text-right py-1.5 font-semibold">Failures</th>
                  <th className="text-right py-1.5 font-semibold">Fail %</th>
                  <th className="text-right py-1.5 font-semibold">Avg Latency</th>
                  <th className="text-right py-1.5 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {ops.cronLlm.rows.map((row) => (
                  <tr key={row.job} className="border-b border-border/20">
                    <td className="py-1.5 font-mono text-foreground">{row.job}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{row.calls}</td>
                    <td className={`py-1.5 text-right ${row.failures > 0 ? "text-danger" : "text-muted-foreground"}`}>
                      {row.failures}
                    </td>
                    <td className={`py-1.5 text-right font-mono ${row.failureRatePct > 0 ? "text-danger" : "text-muted-foreground"}`}>
                      {row.failureRatePct}%
                    </td>
                    <td className={`py-1.5 text-right font-mono ${row.avgLatencyMs > 60_000 ? "text-warning" : "text-muted-foreground"}`}>
                      {(row.avgLatencyMs / 1000).toFixed(1)}s
                    </td>
                    <td className="py-1.5 text-right font-mono text-warning">
                      ${row.totalCostUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">No cron LLM calls in the last hour.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminAILimitsPage() {
  const { data, error, isLoading, mutate } = useSWR<AILimitsData>(
    "/api/admin/ai-limits",
    fetchLimits,
    { revalidateOnFocus: false, refreshInterval: 30_000 },
  );
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleUpdate = async (payload: Parameters<typeof updateLimit>[0]) => {
    setMutationError(null);
    try {
      await updateLimit(payload);
      await mutate();
    } catch (e) {
      setMutationError((e as Error).message);
      throw e;
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <ShieldAlert className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">Failed to load AI limits.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Limits & Alerts</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Override daily token caps and alert thresholds. Changes take effect immediately — no deploy required.
        </p>
      </div>

      {/* Runtime Ops Snapshot — current live state of the alerting system */}
      <RuntimeOpsPanel />

      {/* Daily Token Caps */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Daily Token Caps</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">
          Per-user, per-UTC-day token ceiling. Acts as a secondary cost backstop after credits. ENTERPRISE is always uncapped.
        </p>
        {PLAN_ORDER.map((plan) => (
          <EditableRow
            key={plan}
            label={plan}
            currentVal={data.caps[plan] ?? data.defaults[plan]}
            defaultVal={data.defaults[plan]}
            unit="tokens"
            onSave={(val) => handleUpdate({ type: "caps", plan, value: val })}
            onReset={() => handleUpdate({ type: "caps", plan, value: null })}
          />
        ))}
        <div className="flex items-start gap-3 py-3">
          <div className="flex-1">
            <span className="text-xs font-semibold text-muted-foreground">ENTERPRISE</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Governed by contract — always uncapped</p>
          </div>
          <span className="font-mono text-sm font-bold text-muted-foreground">Uncapped</span>
        </div>
      </div>

      {/* Alert Thresholds */}
      <div className="rounded-2xl border border-white/5 bg-card/80 backdrop-blur-xl p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alert Thresholds</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">
          Alerts fire via <code className="font-mono bg-muted px-1 py-0.5 rounded text-[9px]">AI_ALERT_WEBHOOK_URL</code> with a 15-min cooldown per alert type.
          Set the env var to a Slack/Discord incoming webhook URL to enable delivery.
        </p>
        {Object.entries(ALERT_THRESHOLD_LABELS).map(([key, meta]) => (
          <EditableRow
            key={key}
            label={meta.label}
            currentVal={data.alertThresholds[key] ?? data.alertThresholdsDefaults[key]}
            defaultVal={data.alertThresholdsDefaults[key]}
            unit={meta.unit}
            description={meta.description}
            onSave={(val) => handleUpdate({ type: "alertThresholds", key, value: val })}
            onReset={() => handleUpdate({ type: "alertThresholds", key, value: null })}
          />
        ))}
      </div>

      {mutationError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {mutationError}
        </div>
      )}
    </div>
  );
}
