"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

import type { PlanTier } from "@/lib/ai/config";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, Lock, ArrowRight } from "lucide-react";

interface ScenarioCase {
  expectedReturn: number;
  regime: string;
  confidence: number;
}

interface BaseCase {
  expectedReturn: number;
  regimeProbabilities: Record<string, number>;
}

interface ScenarioData {
  bullCase: ScenarioCase;
  baseCase: BaseCase;
  bearCase: ScenarioCase;
  var5: number;
  es5: number;
  fragility: number;
  metadata: {
    currentRegime: string;
    factorAlignment: Record<string, number>;
    liquidityFragility: number;
    risk?: {
      method: "empirical" | "normal";
      confidence: 0.95 | 0.99;
      horizon: "1D" | "1W";
      sampleSize: number;
      displayCapLossPct: number;
    };
  };
  riskVariants?: Record<
    string,
    {
      method: "empirical" | "normal";
      confidence: 0.95 | 0.99;
      horizon: "1D" | "1W";
      sampleSize: number;
      displayCapLossPct: number;
      varPct: number;
      esPct: number;
    }
  >;
}

interface ScenarioAnalysisCardProps {
  symbol: string;
  plan: PlanTier;
  className?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Horizon = "1D" | "1W";
type Confidence = 0.95 | 0.99;

function pctKey(h: Horizon, c: Confidence): string {
  return `${h}_${c === 0.95 ? "95" : "99"}`;
}

function displayCapped(xPct: number, capLossPct: number): { value: number; capped: boolean } {
  if (!Number.isFinite(xPct) || !Number.isFinite(capLossPct)) return { value: xPct, capped: false };
  if (capLossPct >= 0) return { value: xPct, capped: false };
  return xPct < capLossPct ? { value: capLossPct, capped: true } : { value: xPct, capped: false };
}

type ScenarioApiResponse =
  | { ready: true; symbol: string; name: string; type: string; scenarios: ScenarioData }
  | {
      ready: false;
      status: "not_ready";
      symbol: string;
      name: string;
      type: string;
      scenarios: null;
      message: string;
    };

export function ScenarioAnalysisCard({ symbol, plan, className }: ScenarioAnalysisCardProps) {
  const [horizon, setHorizon] = useState<Horizon>("1D");
  const [confidence, setConfidence] = useState<Confidence>(0.95);

  const { data: apiData, isLoading, error } = useSWR<ScenarioApiResponse>(
    `/api/crypto/${symbol}/scenarios`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 60000 },
  );

  const data = apiData && apiData.ready ? apiData.scenarios : null;

  const selectedRisk = useMemo(() => {
    if (!data) return null;
    const key = pctKey(horizon, confidence);
    return data.riskVariants?.[key] ?? null;
  }, [confidence, data, horizon]);

  const fallbackRisk = data?.metadata?.risk ?? null;
  const risk = selectedRisk ?? fallbackRisk;
  const varPct = selectedRisk?.varPct ?? data?.var5 ?? null;
  const esPct = selectedRisk?.esPct ?? data?.es5 ?? null;

  if (isLoading) {
    return (
      <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-2xl p-5", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Scenario Analysis
          </span>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  const errorMessage =
    error && typeof error === "object" && "message" in (error as Record<string, unknown>)
      ? String((error as Record<string, unknown>).message)
      : error
        ? "Failed to load scenario analysis"
        : null;

  const notReadyMessage = apiData && !apiData.ready ? apiData.message : null;

  if (errorMessage || notReadyMessage) {
    return (
      <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-2xl p-5", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Scenario Analysis
          </span>
        </div>
        <p className="text-xs font-bold text-muted-foreground">
          {errorMessage || notReadyMessage}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-2xl p-5", className)}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Scenario Analysis
          </span>
        </div>
        <p className="text-xs font-bold text-muted-foreground">Scenario analysis is unavailable.</p>
      </div>
    );
  }

  const getFragilityLabel = (score: number) => {
    if (score >= 70) return { label: "High Fragility", color: "text-red-500" };
    if (score >= 50) return { label: "Moderate Fragility", color: "text-yellow-500" };
    return { label: "Low Fragility", color: "text-green-500" };
  };

  const fragility = getFragilityLabel(data.fragility);

  const capLossPct = risk?.displayCapLossPct ?? -95;
  const cappedVar = varPct == null ? null : displayCapped(varPct, capLossPct);
  const cappedEs = esPct == null ? null : displayCapped(esPct, capLossPct);
  const showAdvanced = plan === "ELITE" || plan === "ENTERPRISE";
  const showLockedPreview = plan === "PRO";

  return (
    <div className={cn("bg-card/60 backdrop-blur-2xl border border-white/5 shadow-xl rounded-2xl p-5", className)}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Scenario Analysis
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-muted-foreground">
            Forward outcomes under regime shifts (risk framework, not a price prediction)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as Horizon)}
            className="h-8 rounded-2xl border border-white/5 bg-background/40 px-2 text-[11px] font-bold"
            aria-label="Scenario horizon"
          >
            <option value="1D">1D</option>
            <option value="1W">1W</option>
          </select>
          <select
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value) as Confidence)}
            className="h-8 rounded-2xl border border-white/5 bg-background/40 px-2 text-[11px] font-bold"
            aria-label="Scenario confidence"
          >
            <option value={0.95}>95%</option>
            <option value={0.99}>99%</option>
          </select>
        </div>
      </div>

      {/* Bull Case */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="font-medium">Bull Case</span>
            <span className="text-xs text-muted-foreground">
              ({data.bullCase.regime.replace(/_/g, " ")})
            </span>
          </div>
          <span className="text-lg font-semibold text-green-500">
            {data.bullCase.expectedReturn > 0 ? "+" : ""}
            {data.bullCase.expectedReturn.toFixed(1)}%
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Probability: {data.bullCase.confidence}%
        </div>
      </div>

      {/* Base Case */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Minus className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Base Case</span>
            <span className="text-xs text-muted-foreground">
              (Probability-weighted)
            </span>
          </div>
          <span className="text-lg font-semibold text-amber-500">
            {data.baseCase.expectedReturn > 0 ? "+" : ""}
            {data.baseCase.expectedReturn.toFixed(1)}%
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Current regime: {data.metadata.currentRegime.replace(/_/g, " ")}
        </div>
      </div>

      {/* Bear Case */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="font-medium">Bear Case</span>
            <span className="text-xs text-muted-foreground">
              ({data.bearCase.regime.replace(/_/g, " ")})
            </span>
          </div>
          <span className="text-lg font-semibold text-red-500">
            {data.bearCase.expectedReturn > 0 ? "+" : ""}
            {data.bearCase.expectedReturn.toFixed(1)}%
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Probability: {data.bearCase.confidence}%
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">5% Value-at-Risk</span>
          <span className="font-medium text-red-500">
            {cappedVar ? cappedVar.value.toFixed(1) : "—"}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Expected Shortfall (5%)</span>
          <span className="font-medium text-red-500">
            {cappedEs ? cappedEs.value.toFixed(1) : "—"}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${fragility.color}`} />
            <span className="text-muted-foreground">Fragility Score</span>
          </div>
          <span className={`font-medium ${fragility.color}`}>
            {data.fragility}/100 ({fragility.label})
          </span>
        </div>
      </div>

      {(cappedVar?.capped || cappedEs?.capped) && (
        <div className="text-[11px] font-bold text-muted-foreground/80">
          Display-capped for readability ({capLossPct}%).
        </div>
      )}

      {showAdvanced ? (
        <div className="rounded-2xl border border-white/5 bg-background/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Tail model
            </span>
            <span className="text-xs font-bold font-mono text-foreground/90">
              {risk?.method?.toUpperCase?.() ?? "—"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold text-muted-foreground/80">
            <div>Horizon: {risk?.horizon ?? "—"}</div>
            <div>Confidence: {risk?.confidence ? `${Math.round(risk.confidence * 100)}%` : "—"}</div>
            <div>Sample: {risk?.sampleSize ?? 0}</div>
            <div>Cap: {risk?.displayCapLossPct ?? -95}%</div>
          </div>
        </div>
      ) : showLockedPreview ? (
        <Link
          href="/dashboard/upgrade"
          className="block rounded-2xl border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary/80" />
              <div>
                <p className="text-xs font-bold text-foreground">Unlock full scenario breakdown</p>
                <p className="text-[11px] font-bold text-muted-foreground">See tails, method confidence and drivers.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary/70" />
          </div>
        </Link>
      ) : null}

      {/* Guidance */}
      <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">What this means:</p>
        <p>
          These scenarios model conditional forward outcomes under different market regimes.
          Higher fragility indicates sensitivity to volatility shocks, liquidity stress and correlation convergence.
          This is NOT a price prediction—it&apos;s a risk-adjusted scenario framework.
        </p>
      </div>
    </div>
  );
}
