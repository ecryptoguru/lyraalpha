"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClientLogger } from "@/lib/logger/client";
import {
  AlertTriangle,
  TrendingDown,
  Shield,
  X,
  Loader2,
  Sparkles,
  Info,
  Flame,
  Landmark,
  Cpu,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";
import { usePlan } from "@/hooks/use-plan";
import { EliteGate } from "@/components/dashboard/elite-gate";
import { AssetSearchInput } from "@/components/dashboard/asset-search-input";
import { useRegion } from "@/lib/context/RegionContext";
import dynamic from "next/dynamic";
import { parseLyraMessage } from "@/lib/lyra-utils";
import { getScenario, STRESS_SCENARIO_IDS, type StressScenarioId, type StressResult } from "@/lib/stress-scenarios";
import { fmt, buildChartData, getStressTestErrorMessage, formatScenarioPeriod } from "@/lib/stress-scenarios/stress-test-utils";
import { calculateMultiAssetAnalysisCredits } from "@/lib/credits/cost";
import { AnalysisLoadingState } from "@/components/lyra/analysis-loading-state";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { buildShockShareObject } from "@/lib/intelligence-share";
import { applyOptimisticCreditDelta, revalidateCreditViews, setAuthoritativeCreditBalance } from "@/lib/credits/client";

const AnswerWithSources = dynamic(
  () => import("@/components/lyra/answer-with-sources").then((m) => m.AnswerWithSources),
  { ssr: false },
);
// Recharts <Line stroke> requires a parseable CSS color string — CSS custom properties
// (var(--color-*)) are not supported. These hex values mirror the design system palette.
const SCENARIO_COLORS = [
  "#22d3ee", // Signal Cyan
  "#818cf8", // Electric Indigo
  "#f43f5e", // Rose (danger)
  "#a3e635", // Lime
  "#c4b5fd", // Neural Purple
  "#fb923c", // Orange (warning)
  "#34d399", // Emerald (success)
  "#e879f9", // Fuchsia
];
const MAX_STRESS_TEST_ASSETS = 3;
const MAX_STRESS_TEST_ASSETS_MESSAGE = "Shock Simulator supports up to 3 assets. Remove one to continue.";
const DEFAULT_SCENARIO_ID = STRESS_SCENARIO_IDS[0]!;

const SCENARIO_UI_CHROME: Record<StressScenarioId, { color: string; icon: React.ReactNode }> = {
  "gfc-2008": {
    color: "text-danger border-danger/30 bg-danger/5",
    icon: <Shield className="h-4 w-4" />,
  },
  "covid-2020": {
    color: "text-info border-info/30 bg-info/5",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  "rate-shock-2022": {
    color: "text-warning border-warning/30 bg-warning/5",
    icon: <TrendingDown className="h-4 w-4" />,
  },
  recession: {
    color: "text-foreground border-foreground/15 bg-foreground/5",
    icon: <Landmark className="h-4 w-4" />,
  },
  "interest-rate-shock": {
    color: "text-warning border-warning/20 bg-warning/3",
    icon: <TrendingDown className="h-4 w-4" />,
  },
  "tech-bubble-crash": {
    color: "text-info border-info/30 bg-info/5",
    icon: <Cpu className="h-4 w-4" />,
  },
  "oil-spike": {
    color: "text-warning border-warning/30 bg-warning/5",
    icon: <Flame className="h-4 w-4" />,
  },
};

const SCENARIOS = STRESS_SCENARIO_IDS.flatMap((id) => {
  let us: ReturnType<typeof getScenario>;
  let inRegion: ReturnType<typeof getScenario>;
  try {
    us = getScenario(id, "US");
    inRegion = getScenario(id, "IN");
  } catch (err) {
    if (typeof window !== "undefined") createClientLogger("stress-test").error("Failed to load scenario metadata", { id, err: String(err) });
    return [];
  }

  if (!us || !inRegion) {
    if (typeof window !== "undefined") createClientLogger("stress-test").error("Missing scenario metadata", { id });
    return [];
  }

  return [{
    id,
    name: us.name.replace(/\s+\(India\)$/, ""),
    description: us.narrative?.headline ?? us.description,
    color: SCENARIO_UI_CHROME[id]?.color ?? "text-muted-foreground border-white/10 bg-white/3",
    icon: SCENARIO_UI_CHROME[id]?.icon ?? <Shield className="h-4 w-4" />,
    us: { period: formatScenarioPeriod(us.period), severity: us.severity ?? "Moderate" },
    in: { period: formatScenarioPeriod(inRegion.period), severity: inRegion.severity ?? "Moderate" },
  }];
});


const MethodBadge = ({ method, proxy }: { method: string; proxy?: string | null }) => {
  if (method === "DIRECT")
    return (
      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-success/10 text-success border border-success/20">
        Direct
      </span>
    );
  if (method === "PROXY")
    return (
      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-warning/10 text-warning border border-warning/20" title={`Proxy: ${proxy}`}>
        Proxy {proxy ? `· ${getFriendlySymbol(proxy)}` : ""}
      </span>
    );
  return (
    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-danger/10 text-danger border border-danger/20">
      No data
    </span>
  );
};

const ConfidenceMeter = ({ confidence }: { confidence: number }) => {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-1.5" title={`Confidence: ${pct}%`}>
      <div className="w-16 h-1.5 bg-muted/20 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[8px] text-muted-foreground/50">{pct}%</span>
    </div>
  );
};

const ScenarioNarrativeCard = React.memo(function ScenarioNarrativeCard({ result }: { result: StressResult }) {
  const hasNarrative = Boolean(
    result.driverSummary
    || result.transmissionMechanism
    || result.pressurePoints?.length
    || result.resilienceThemes?.length,
  );

  if (!hasNarrative) {
    return null;
  }

  return (
    <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Scenario Overview</p>
          <h3 className="text-sm font-black">{result.driverSummary}</h3>
        </div>
        {result.scenarioSeverity && (
          <span className={cn(
            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
            result.scenarioSeverity === "Extreme" ? "bg-danger/15 text-danger border border-danger/20" :
            result.scenarioSeverity === "Severe" ? "bg-danger/10 text-danger" :
            "bg-warning/10 text-warning",
          )}>
            {result.scenarioSeverity}
          </span>
        )}
      </div>
      {result.transmissionMechanism && (
        <p className="text-xs leading-relaxed text-muted-foreground/80">{result.transmissionMechanism}</p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Dominant Drivers</p>
          <div className="flex flex-wrap gap-1.5">
            {(result.dominantDrivers ?? []).map((driver) => (
              <span key={driver} className="rounded-full border border-info/20 bg-info/10 px-2 py-1 text-[10px] font-bold text-info">
                {driver}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Pressure Points</p>
          <div className="flex flex-wrap gap-1.5">
            {(result.pressurePoints ?? []).map((point) => (
              <span key={point} className="rounded-full border border-danger/20 bg-danger/10 px-2 py-1 text-[10px] font-bold text-danger">
                {point}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Resilience Themes</p>
          <div className="flex flex-wrap gap-1.5">
            {(result.resilienceThemes ?? []).map((theme) => (
              <span key={theme} className="rounded-full border border-success/20 bg-success/10 px-2 py-1 text-[10px] font-bold text-success">
                {theme}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

const AssetReplayCard = React.memo(function AssetReplayCard({ result }: { result: StressResult | null }) {
  if (!result) {
    return null;
  }

  return (
    <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Selected Asset Replay</p>
          <h3 className="text-sm font-black">{getFriendlySymbol(result.symbol)}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={result.method} proxy={result.proxyUsed} />
          {result.explanationMethod && (
            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-white/10 bg-card/50 text-muted-foreground/70">
              {result.explanationMethod.replaceAll("-", " ")}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-card/40 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Max Drawdown</p>
          <p className="mt-1 text-sm font-black text-danger">{fmt(result.maxDrawdown)}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-card/40 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Period Return</p>
          <p className={cn("mt-1 text-sm font-black", (result.periodReturn ?? 0) < 0 ? "text-danger" : "text-success")}>
            {fmt(result.periodReturn)}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-card/40 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Confidence</p>
          <div className="mt-2">
            <ConfidenceMeter confidence={result.confidence} />
          </div>
        </div>
      </div>
      {result.rationale && (
        <div className="rounded-3xl border border-white/10 bg-card/40 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Replay Rationale</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/75">{result.rationale}</p>
        </div>
      )}
    </div>
  );
});


// Custom animated tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/5 bg-card/95 backdrop-blur-xl p-3 shadow-xl text-xs space-y-1 min-w-[120px]">
      <p className="text-[9px] text-muted-foreground/60 font-bold uppercase">Day {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="font-bold">{getFriendlySymbol(p.name)}</span>
          </div>
          <span className={cn("font-black tabular-nums", Math.abs(p.value) < 0.05 ? "text-muted-foreground" : p.value < 0 ? "text-danger" : "text-success")}>
            {Math.abs(p.value) < 0.05 ? "0.0" : `${p.value > 0 ? "+" : ""}${p.value.toFixed(1)}`}%
          </span>
        </div>
      ))}
    </div>
  );
}

function FactorDrivers({ factors }: { factors: NonNullable<StressResult["factors"]> }) {
  const entries = [
    { label: "Equity", value: factors.equity },
    { label: "Long Bonds", value: factors.rates },
    { label: "Gold", value: factors.gold },
    { label: "USD", value: factors.usd },
    { label: "Oil", value: factors.oil },
    { label: "Credit", value: factors.credit },
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Scenario Factor Returns</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map((e) => (
          <div key={e.label} className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", e.value < 0 ? "bg-danger" : e.value > 0 ? "bg-success" : "bg-muted-foreground/40")} />
            <span className="text-[9px] text-muted-foreground/70 w-16 shrink-0">{e.label}</span>
            <span className={cn("text-[9px] font-black tabular-nums ml-auto", e.value < 0 ? "text-danger" : e.value > 0 ? "text-success" : "text-muted-foreground")}>
              {fmt(e.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AssetBreakdownRow = React.memo(function AssetBreakdownRow({
  r, index, isSelected, onSelectSymbol,
}: {
  r: StressResult; index: number; isSelected: boolean; onSelectSymbol: (symbol: string) => void;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5 pb-3 border-b border-border/20 last:border-0 last:pb-0 rounded-xl transition-colors",
        isSelected ? "bg-primary/5" : "",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SCENARIO_COLORS[index % SCENARIO_COLORS.length] }} />
        <Link
          href={`/dashboard/assets/${r.symbol}`}
          className="text-[10px] font-black w-24 truncate hover:text-primary transition-colors"
        >
          {getFriendlySymbol(r.symbol)}
        </Link>
        <MethodBadge method={r.method} proxy={r.proxyUsed} />
        <div className="ml-auto flex items-center gap-2">
          <ConfidenceMeter confidence={r.confidence} />
          {r.beta != null && (
            <span className="text-[8px] text-muted-foreground/40">β {r.beta.toFixed(2)}</span>
          )}
          <button
            type="button"
            onClick={() => onSelectSymbol(r.symbol)}
            className={cn(
              "rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              isSelected
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/10 bg-card/40 text-muted-foreground/70 hover:border-border/60",
            )}
            aria-pressed={isSelected}
            aria-label={`Show replay details for ${getFriendlySymbol(r.symbol)}`}
          >
            Details
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-4">
        <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              (r.maxDrawdown ?? 0) < -0.30 ? "bg-danger" :
              (r.maxDrawdown ?? 0) < -0.15 ? "bg-danger/70" :
              (r.maxDrawdown ?? 0) < 0 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${Math.max(2, Math.min(Math.abs((r.maxDrawdown ?? 0) * 100), 100))}%` }}
          />
        </div>
        <span className={cn(
          "text-[10px] font-black w-14 text-right tabular-nums",
          (r.maxDrawdown ?? 0) < 0 ? "text-danger" : "text-success",
        )}>
          {fmt(r.maxDrawdown)}
        </span>
        <span className="text-[9px] font-bold w-16 text-right tabular-nums text-muted-foreground/50">
          {fmt(r.periodReturn)} return
        </span>
      </div>
    </div>
  );
});

export default function StressTestPage() {
  const { plan } = usePlan();
  const isElite = plan === "ELITE" || plan === "ENTERPRISE";

  const { region: activeRegion } = useRegion();
  const searchParams = useSearchParams();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState(DEFAULT_SCENARIO_ID);
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
  const [results, setResults] = useState<StressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lyraAnalysis, setLyraAnalysis] = useState<string | null>(null);
  const [lyraLoading, setLyraLoading] = useState(false);
  const [lyraElapsedSeconds, setLyraElapsedSeconds] = useState(0);
  const lyraLoadStartTimeRef = useRef<number>(0);
  const [chartAnimated, setChartAnimated] = useState(false);
  const chartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lyraRef = useRef<HTMLDivElement>(null);
  const lyraAbortRef = useRef<AbortController | null>(null);
  const restoredQueryKeyRef = useRef<string | null>(null);
  const pendingRestoreRunRef = useRef(false);
  const validResultsRef = useRef<StressResult[]>([]);
  const symbolsRef = useRef<string[]>([]);

  // Clear results when universal region changes
  useEffect(() => {
    lyraAbortRef.current?.abort();
    setResults([]);
    setErrorMessage(null);
    setLyraAnalysis(null);
    setSymbols([]);
    setSelectedAssetSymbol(null);
    setSelectedScenario(DEFAULT_SCENARIO_ID);
    validResultsRef.current = [];
    symbolsRef.current = [];
  }, [activeRegion]);

  const restoredScenario = useMemo(() => {
    const rawScenario = searchParams.get("scenario");
    if (rawScenario && SCENARIOS.some((scenario) => scenario.id === rawScenario)) {
      return rawScenario as StressScenarioId;
    }
    return SCENARIOS[0]?.id ?? DEFAULT_SCENARIO_ID;
  }, [searchParams]);

  const restoredSymbols = useMemo(() => {
    const rawSymbols = searchParams.get("symbols");
    if (!rawSymbols) return [];

    return Array.from(
      new Set(
        rawSymbols
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }, [searchParams]);

  const restoredQueryKey = useMemo(
    () => `${restoredScenario}|${restoredSymbols.join(",")}`,
    [restoredScenario, restoredSymbols],
  );

  useEffect(() => {
    if (restoredQueryKeyRef.current === restoredQueryKey) return;

    restoredQueryKeyRef.current = restoredQueryKey;
    setSelectedScenario(restoredScenario);
    setSymbols(restoredSymbols);
    symbolsRef.current = restoredSymbols;
    setResults([]);
    setErrorMessage(restoredSymbols.length > MAX_STRESS_TEST_ASSETS ? MAX_STRESS_TEST_ASSETS_MESSAGE : null);
    setLyraAnalysis(null);
    setSelectedAssetSymbol(null);
    pendingRestoreRunRef.current = restoredSymbols.length > 0 && restoredSymbols.length <= MAX_STRESS_TEST_ASSETS;
  }, [restoredQueryKey, restoredScenario, restoredSymbols]);

  const addSymbol = useCallback((sym: string) => {
    const upper = sym.trim().toUpperCase();
    if (!upper) return;
    let outcome: "added" | "duplicate" | "at_capacity" = "added";
    setSymbols((prev) => {
      if (prev.includes(upper)) { outcome = "duplicate"; return prev; }
      if (prev.length >= MAX_STRESS_TEST_ASSETS) { outcome = "at_capacity"; return prev; }
      outcome = "added";
      symbolsRef.current = [...prev, upper];
      return [...prev, upper];
    });
    // setErrorMessage must be in a separate microtask to avoid React 18 bailout
    // when setSymbols returns the same reference (duplicate/at_capacity)
    queueMicrotask(() => {
      if (outcome === "at_capacity") {
        setErrorMessage(MAX_STRESS_TEST_ASSETS_MESSAGE);
      } else if (outcome === "duplicate") {
        setErrorMessage(`${getFriendlySymbol(upper)} is already in the list.`);
        setTimeout(() => setErrorMessage((prev) => prev?.includes("already in the list") ? null : prev), 3000);
      } else {
        setErrorMessage(null);
      }
    });
  }, []);

  const handleSelectAsset = useCallback((symbol: string) => {
    setSelectedAssetSymbol(symbol);
  }, []);

  const removeSymbol = useCallback((sym: string) => {
    setSymbols((prev) => {
      const next = prev.filter((s) => s !== sym);
      symbolsRef.current = next;
      return next;
    });
    setResults((prev) => prev.filter((r) => r.symbol !== sym));
    setSelectedAssetSymbol((prev) => prev === sym ? null : prev);
    setErrorMessage(null);
  }, []);

  const validResults = useMemo(() => {
    const vr = results.filter((r) => r.method !== "ERROR" && r.maxDrawdown != null && r.dailyPath.length > 0);
    validResultsRef.current = vr;
    return vr;
  }, [results]);
  const errorResults = useMemo(
    () => results.filter((r) => r.method === "ERROR" || r.error),
    [results],
  );
  const sortedValidResults = useMemo(
    () => [...validResults].sort((a, b) => (a.maxDrawdown ?? 0) - (b.maxDrawdown ?? 0)),
    [validResults],
  );
  const { proxyCount, directCount, avgDrawdown, worstAsset, bestAsset } = useMemo(() => {
    if (validResults.length === 0) return { proxyCount: 0, directCount: 0, avgDrawdown: null as number | null, worstAsset: null as StressResult | null, bestAsset: null as StressResult | null };
    let proxy = 0, direct = 0, sum = 0, worst = validResults[0], best = validResults[0];
    for (const r of validResults) {
      if (r.method === "PROXY") proxy++;
      if (r.method === "DIRECT") direct++;
      sum += r.maxDrawdown ?? 0;
      if ((r.maxDrawdown ?? 0) < (worst.maxDrawdown ?? 0)) worst = r;
      if ((r.maxDrawdown ?? 0) > (best.maxDrawdown ?? 0)) best = r;
    }
    return { proxyCount: proxy, directCount: direct, avgDrawdown: sum / validResults.length, worstAsset: worst, bestAsset: best };
  }, [validResults]);
  const selectedAsset = useMemo(
    () => sortedValidResults.find((result) => result.symbol === selectedAssetSymbol) ?? worstAsset ?? sortedValidResults[0] ?? null,
    [selectedAssetSymbol, sortedValidResults, worstAsset],
  );
  const chartData = useMemo(
    () => (validResults.length > 0 ? buildChartData(validResults) : []),
    [validResults],
  );
  const scenarioDef = useMemo(
    () => SCENARIOS.find((s) => s.id === selectedScenario),
    [selectedScenario],
  );
  const scenarioInfo = useMemo(
    () => (activeRegion === "IN" ? scenarioDef?.in : scenarioDef?.us),
    [activeRegion, scenarioDef],
  );
  const shockShare = useMemo(() => validResults.length > 0 && worstAsset && bestAsset && scenarioDef
    ? buildShockShareObject({
        title: `${scenarioDef.name} stress test flagged ${getFriendlySymbol(worstAsset.symbol)} as the weakest link`,
        takeaway: `${getFriendlySymbol(worstAsset.symbol)} absorbed the deepest hit at ${fmt(worstAsset.maxDrawdown ?? null)} max drawdown, while ${getFriendlySymbol(bestAsset.symbol)} held up best.`,
        context: `Stress tested across ${validResults.map((result) => getFriendlySymbol(result.symbol)).join(", ")}. Open Lyra's hedge brief to review protection trade-offs, resilience gaps and the cleanest next-step ideas.`,
        scoreValue: scenarioDef.name,
        href: `/dashboard/stress-test?scenario=${selectedScenario}&symbols=${validResults.map((result) => result.symbol).join(",")}`,
      })
    : null, [validResults, worstAsset, bestAsset, scenarioDef, selectedScenario]);

  const parsedLyraAnalysis = useMemo(
    () => lyraAnalysis ? parseLyraMessage(lyraAnalysis) : null,
    [lyraAnalysis],
  );

  useEffect(() => {
    if (selectedAssetSymbol && sortedValidResults.some((result) => result.symbol === selectedAssetSymbol)) {
      return;
    }

    setSelectedAssetSymbol(worstAsset?.symbol ?? sortedValidResults[0]?.symbol ?? null);
  }, [selectedAssetSymbol, sortedValidResults, worstAsset]);

  const askLyraForHedges = useCallback(async (freshResults?: StressResult[]) => {
    const resultsToUse = freshResults ?? validResultsRef.current;
    if (resultsToUse.length === 0) return;

    // Abort any in-flight Lyra stream before starting a new one
    lyraAbortRef.current?.abort();
    const controller = new AbortController();
    lyraAbortRef.current = controller;

    setLyraLoading(true);
    lyraLoadStartTimeRef.current = Date.now();
    setLyraAnalysis("");

    // Auto-scroll down when Lyra analysis begins
    requestAnimationFrame(() => {
      lyraRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const resultSummary = resultsToUse
      .map((r) => `${r.symbol}: ${fmt(r.maxDrawdown)} max drawdown, ${fmt(r.periodReturn)} period return`)
      .join("; ");

    const query = `Stress test during ${scenarioDef?.name} (${activeRegion} market, ${scenarioInfo?.period}): ${resultSummary}. What are the best hedging strategies for this portfolio? Which assets provided the best protection? What should I add or remove to improve resilience? Format your response using well-structured markdown (headers, bullet points, bold text) exactly like you do in the Lyra Intel Chat.`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: query }],
          contextData: { symbol: "GLOBAL", assetType: "GLOBAL", assetName: "Shock Simulator", scores: {}, chatMode: "stress-test" },
          symbol: "GLOBAL",
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Lyra error");
      const creditsRemaining = response.headers.get("X-Credits-Remaining");
      if (creditsRemaining !== null) {
        const nextCredits = Number(creditsRemaining);
        if (Number.isFinite(nextCredits)) {
          void setAuthoritativeCreditBalance(nextCredits);
          void revalidateCreditViews();
        }
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) return;
        text += decoder.decode(value, { stream: true });
        setLyraAnalysis(text);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      createClientLogger("stress-test").error("askLyraForHedges failed", { err: String(err) });
      setLyraAnalysis("Lyra is unavailable. Please try again.");
    } finally {
      if (lyraAbortRef.current === controller) {
        setLyraLoading(false);
      }
    }
  }, [scenarioDef, activeRegion, scenarioInfo]);

  useEffect(() => {
    if (!lyraLoading || !lyraLoadStartTimeRef.current) {
      setLyraElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setLyraElapsedSeconds(Math.floor((Date.now() - lyraLoadStartTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [lyraLoading]);

  const runStressTest = useCallback(async () => {
    const currentSymbols = symbolsRef.current;
    if (currentSymbols.length === 0) return;
    if (currentSymbols.length > MAX_STRESS_TEST_ASSETS) {
      setErrorMessage(MAX_STRESS_TEST_ASSETS_MESSAGE);
      return;
    }
    setLoading(true);
    setResults([]);
    setErrorMessage(null);
    setLyraAnalysis(null);
    setChartAnimated(false);

    const creditCost = calculateMultiAssetAnalysisCredits(currentSymbols.length);
    void applyOptimisticCreditDelta(-creditCost);
    try {
      const res = await fetch("/api/stocks/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: currentSymbols,
          scenarioId: selectedScenario,
          region: activeRegion,
        }),
      });
      if (!res.ok) {
        let payload: { error?: string; message?: string; remaining?: number } | null = null;
        try { payload = await res.json(); } catch { payload = null; }
        const errMsg = getStressTestErrorMessage(res.status, payload);
        // Prefer authoritative balance from server if available; otherwise refund optimistically
        const remaining = typeof payload?.remaining === "number" ? payload.remaining : null;
        if (remaining !== null) {
          void setAuthoritativeCreditBalance(remaining);
        } else {
          void applyOptimisticCreditDelta(creditCost);
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      const newResults = data.results || [];
      setResults(newResults);
      setSelectedAssetSymbol(newResults.find((r: StressResult) => r.method !== "ERROR" && r.maxDrawdown != null)?.symbol ?? null);
      void revalidateCreditViews();

      // Identify valid results
      const valid = newResults.filter((r: StressResult) => r.method !== "ERROR" && r.maxDrawdown != null && r.dailyPath?.length > 0);
      
      // Auto-trigger Lyra Analysis
      if (valid.length > 0) {
        askLyraForHedges(valid);
      }

      // Trigger chart animation after a short delay
      if (chartTimer.current) clearTimeout(chartTimer.current);
      chartTimer.current = setTimeout(() => { setChartAnimated(true); chartTimer.current = null; }, 200);
    } catch (error) {
      void revalidateCreditViews();
      setErrorMessage(error instanceof Error ? error.message : "Stress test failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedScenario, activeRegion, askLyraForHedges]);

  useEffect(() => {
    if (!pendingRestoreRunRef.current || loading || symbols.length === 0) return;

    pendingRestoreRunRef.current = false;
    void runStressTest();
  }, [loading, runStressTest, symbols.length]);

  useEffect(() => {
    return () => {
      if (chartTimer.current) clearTimeout(chartTimer.current);
    };
  }, []);


  return (
    <div className="relative pb-6 p-3 sm:p-4 md:p-6 space-y-6 w-full min-w-0 overflow-x-hidden">
      <PageHeader
        icon={<Shield className="h-5 w-5" />}
        title="Shock Simulator"
        eyebrow="Downside rehearsal"
        chips={
          <>
            {scenarioDef ? (
              <StatChip value={scenarioDef.name} label="Scenario" variant="red" />
            ) : (
              <StatChip value="Select" label="Scenario" variant="muted" />
            )}
            {symbols.length > 0 && (
              <StatChip value={symbols.length} label="Assets" variant="gold" />
            )}
          </>
        }
        actions={shockShare ? <ShareInsightButton share={shockShare} label="Share" /> : undefined}
      />

      {!isElite ? (
        <EliteGate
          feature="discovery_feed"
          plan={plan}
          teaser="Run Shock Simulator across historical crash scenarios with up to 3 assets, see projected drawdowns and use credit pricing of 5 for the first asset plus 3 for each additional asset."
        >
          {null}
        </EliteGate>
      ) : (
        <>

          {/* Scenario Selection */}
          <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Select Scenario</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" role="radiogroup" aria-label="Stress scenario">
              {SCENARIOS.map((s) => {
                const info = activeRegion === "IN" ? s.in : s.us;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedScenario === s.id}
                    onClick={() => setSelectedScenario(s.id)}
                    aria-label={`${s.name} scenario for ${activeRegion === "IN" ? "India" : "US"} market`}
                    className={cn(
                      "text-left p-4 rounded-3xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selectedScenario === s.id
                        ? s.color + " ring-1 ring-current/30"
                        : "border-white/10 bg-card/40 hover:border-border/60",
                    )}
                  >
                    <div className={cn("mb-2", selectedScenario === s.id ? "" : "text-muted-foreground/50")}>
                      {s.icon}
                    </div>
                    <p className="text-xs font-black">{s.name}</p>
                    <p className="text-[9px] text-muted-foreground/70 mt-1 leading-relaxed">{s.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[8px] font-bold text-muted-foreground/40 font-mono">{info.period}</p>
                      <span className={cn(
                        "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                        info.severity === "Extreme" ? "bg-danger/15 text-danger" :
                        info.severity === "Severe" ? "bg-danger/10 text-danger/80" :
                        "bg-warning/10 text-warning",
                      )}>
                        {info.severity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symbol Input */}
          <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Add crypto assets to test (up to 3) · 5 credits for the first asset + 3 credits per additional asset
            </p>
            <div className="flex flex-wrap gap-2">
              {symbols.map((sym) => (
                <div
                  key={sym}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-primary/30 bg-primary/8 text-xs font-bold text-primary"
                >
                  {sym}
                  <button type="button" onClick={() => removeSymbol(sym)} className="opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm" aria-label={`Remove ${sym}`}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {symbols.length < MAX_STRESS_TEST_ASSETS && (
                <AssetSearchInput
                  onSelect={addSymbol}
                  region={activeRegion}
                  global={true}
                  placeholder="Search BTC, ETH, SOL, BNB"
                  className="w-[312px] max-w-full"
                />
              )}
            </div>
            <button
              type="button"
              onClick={runStressTest}
              disabled={symbols.length === 0 || symbols.length > MAX_STRESS_TEST_ASSETS || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              {loading ? "Running..." : "Run Stress Test"}
            </button>
            {errorMessage && (
              <div className="rounded-2xl border border-danger/20 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Loading skeleton */}
          {loading && validResults.length === 0 && (
            <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading stress test results">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-card/40 border border-white/5 rounded-3xl p-4 h-20" />
                <div className="bg-card/40 border border-white/5 rounded-3xl p-4 h-20" />
                <div className="bg-card/40 border border-white/5 rounded-3xl p-4 h-20" />
              </div>
              <div className="bg-card/40 border border-white/5 rounded-3xl p-5 h-52" />
              <div className="bg-card/40 border border-white/5 rounded-3xl p-5 h-32" />
            </div>
          )}

          {/* Results */}
          {validResults.length > 0 && (
            <div className="space-y-5">
              {shockShare ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/15 bg-primary/5 p-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Share the stress result</p>
                    <p className="text-sm font-semibold text-foreground">Package the scenario outcome, replay context and share card into a polished post.</p>
                  </div>
                  <ShareInsightButton share={shockShare} label="Share result" />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                  <Info className="h-3 w-3" />
                  <span>{directCount} direct · {proxyCount} proxy replay</span>
                </div>
                {proxyCount > 0 && (
                  <span className="text-[9px] text-warning/80 font-bold">
                    Proxy replay uses BTC / ETH / SOL historical drawdown paths scaled by asset beta
                  </span>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-3 sm:p-4 text-center">
                  <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Avg Max Drawdown</p>
                  <p className={cn("text-lg sm:text-2xl font-black", (avgDrawdown ?? 0) < -0.20 ? "text-danger" : "text-warning")}>
                    {avgDrawdown != null ? `${(avgDrawdown * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="bg-card/60 backdrop-blur-2xl border shadow-xl rounded-3xl p-4 border-danger/20 text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Worst Hit</p>
                  <p className="text-sm font-black text-danger">{worstAsset ? getFriendlySymbol(worstAsset.symbol) : ""}</p>
                  <p className="text-lg font-black text-danger">{fmt(worstAsset?.maxDrawdown ?? null)}</p>
                </div>
                <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-4 text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Most Resilient</p>
                  <p className="text-sm font-black text-success">{bestAsset ? getFriendlySymbol(bestAsset.symbol) : ""}</p>
                  <p className="text-lg font-black text-success">{fmt(bestAsset?.maxDrawdown ?? null)}</p>
                </div>
              </div>

              {/* All assets share the same scenario, so narrative/factors are identical for any result — use [0] */}
              {validResults[0] && <ScenarioNarrativeCard result={validResults[0]} />}

              {/* Animated Drawdown Chart */}
              <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider">Drawdown Path</h3>
                  <span className="text-[9px] text-muted-foreground/50 font-bold">{scenarioDef?.name} · {activeRegion} · {scenarioInfo?.period}</span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 8, fill: "var(--muted-foreground)", opacity: 0.5 }}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "Trading Days", position: "insideBottom", fontSize: 8, fill: "var(--muted-foreground)", dy: 6 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 8, fill: "var(--muted-foreground)", opacity: 0.5 }}
                        tickLine={false}
                        axisLine={false}
                        width={42}
                      />
                      <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.4} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={6}
                        wrapperStyle={{ fontSize: "9px", paddingTop: "8px" }}
                        formatter={(v: string) => getFriendlySymbol(v)}
                      />
                      {validResults.map((r, i) => (
                        <Line
                          key={r.symbol}
                          type="monotone"
                          dataKey={r.symbol}
                          stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={chartAnimated}
                          animationDuration={1200}
                          animationEasing="ease-out"
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Asset Breakdown with method badges + confidence */}
              <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5 space-y-3">
                <h3 className="text-sm font-black uppercase tracking-wider">Asset Breakdown</h3>
                {sortedValidResults
                  .map((r, i) => (
                    <AssetBreakdownRow
                      key={r.symbol}
                      r={r}
                      index={i}
                      isSelected={selectedAsset?.symbol === r.symbol}
                      onSelectSymbol={handleSelectAsset}
                    />
                  ))}
              </div>

              <AssetReplayCard result={selectedAsset} />

              {/* Scenario factor drivers — same for all assets in a single-scenario run */}
              {validResults[0]?.factors && (
                <div className="bg-card/60 backdrop-blur-2xl border border-white/10 shadow-xl rounded-3xl p-5">
                  <FactorDrivers factors={validResults[0].factors} />
                </div>
              )}

              {/* Error rows */}
              {errorResults.length > 0 && (
                <div className="bg-card/60 backdrop-blur-2xl border shadow-xl rounded-3xl p-4 border-danger/20 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-danger">Assets with no data</p>
                  {errorResults.map((r) => (
                    <div key={r.symbol} className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <span className="font-black text-danger/70">{getFriendlySymbol(r.symbol)}</span>
                      <span className="truncate">{r.error}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Lyra Hedging Recommendations */}
              <div ref={lyraRef} className="bg-card/60 backdrop-blur-2xl border shadow-xl rounded-2xl p-5 border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {lyraLoading ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    <h3 className="text-sm font-black uppercase tracking-wider">Lyra hedge ideas</h3>
                  </div>
                </div>
                {parsedLyraAnalysis && (
                    <div className="rounded-2xl border border-primary/20 bg-card/60 overflow-hidden text-sm text-foreground/90">
                      <AnswerWithSources
                        content={parsedLyraAnalysis.text}
                        sources={parsedLyraAnalysis.sources}
                        relatedQuestions={[]}
                        onRelatedQuestionClick={() => {}}
                        className="bg-transparent border-none shadow-none w-full min-w-0 p-4"
                        showSources={true}
                      />
                    </div>
                )}
                {!lyraAnalysis && lyraLoading && (
                  <AnalysisLoadingState
                    elapsedSeconds={lyraElapsedSeconds}
                    initialLabel="Lyra is analyzing shock simulation results..."
                    reasoningLabel="Lyra is reasoning deeply..."
                    reasoningDetail="Cross-referencing drawdowns, proxies and regime context"
                    finalLabel="Running hedge and drawdown analysis..."
                    finalDetail="GPT deep synthesis — usually 20–45s for multi-asset queries"
                  />
                )}
                {!lyraAnalysis && !lyraLoading && (
                  <p className="text-xs text-muted-foreground/50">
                    Lyra will automatically analyze your stress test results and suggest hedging strategies.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No data at all state */}
          {validResults.length === 0 && errorResults.length > 0 && !loading && (
            <div className="bg-card/60 backdrop-blur-2xl border shadow-xl rounded-2xl p-5 border-danger/20 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider">No data available</h3>
              <p className="text-xs text-muted-foreground/70">
                None of the selected assets could be found in the database for region <strong>{activeRegion}</strong>.
              </p>
              {errorResults.map((r) => (
                <div key={r.symbol} className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                  <span className="font-black text-danger/70">{getFriendlySymbol(r.symbol)}</span>
                  <span className="truncate">{r.error}</span>
                </div>
              ))}
            </div>
          )}

          {symbols.length === 0 && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
              <Shield className="h-12 w-12 opacity-20" />
              <p className="text-sm font-bold">Add assets to begin the shock simulation</p>
              <p className="text-xs opacity-50 text-center max-w-xs">
                A scenario is pre-selected — just search and add up to 3 crypto assets to see how they perform under historical stress
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
