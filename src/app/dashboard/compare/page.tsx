"use client";

import React, { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  GitCompare,
  X,
  Crown,
  TrendingUp,
  TrendingDown,
  Loader2,
  BarChart3,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { cn, getCurrencyConfig, formatPrice } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";
import { usePlan } from "@/hooks/use-plan";
import { EliteGate } from "@/components/dashboard/elite-gate";
import { AssetSearchInput } from "@/components/dashboard/asset-search-input";
import { useRegion } from "@/lib/context/RegionContext";
import { parseLyraMessage } from "@/lib/lyra-utils";
import dynamic from "next/dynamic";
import { calculateMultiAssetAnalysisCredits } from "@/lib/credits/cost";
import { AnalysisLoadingState } from "@/components/lyra/analysis-loading-state";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { buildCompareShareObject } from "@/lib/intelligence-share";
import { applyOptimisticCreditDelta, revalidateCreditViews, setAuthoritativeCreditBalance } from "@/lib/credits/client";
import { Switch } from "@/components/ui/switch";

const AnswerWithSources = dynamic(
  () => import("@/components/lyra/answer-with-sources").then((m) => m.AnswerWithSources),
  { ssr: false, loading: () => <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-4 bg-muted/20 rounded animate-pulse" />)}</div> },
);

interface AssetCompareResult {
  symbol: string;
  name?: string;
  type?: string;
  price?: number | null;
  changePercent?: number | null;
  currency?: string | null;
  error?: string;
  scores?: {
    trend: number | null;
    momentum: number | null;
    volatility: number | null;
    liquidity: number | null;
    sentiment: number | null;
    trust: number | null;
    compatibility: number | null;
  };
  signalStrength?: {
    score: number;
    label: string;
    confidence: string;
  } | null;
  factorAlignment?: {
    score: number;
    regimeFit: string;
    dominantFactor: string;
  } | null;
  performance?: Record<string, number | null>;
  valuation?: {
    peRatio: number | null;
    priceToBook: number | null;
    roe: number | null;
    marketCap: number | null;
  };
  sector?: string | null;
  industry?: string | null;
}

const SCORE_LABELS: Record<string, string> = {
  trend: "Trend",
  momentum: "Momentum",
  volatility: "Volatility",
  liquidity: "Liquidity",
  sentiment: "Sentiment",
  trust: "Trust",
  compatibility: "Regime Fit",
};

const PERF_LABELS: Record<string, string> = {
  "1D": "1 Day",
  "1W": "1 Week",
  "1M": "1 Month",
  "3M": "3 Months",
  "1Y": "1 Year",
};

const COLORS = [
  "text-primary border-primary/30 bg-primary/5",
  "text-sky-400 border-sky-400/30 bg-sky-400/5",
  "text-emerald-500 dark:text-emerald-400 border-emerald-500 dark:border-emerald-400/30 bg-emerald-500 dark:bg-emerald-400/5",
  "text-amber-400 border-amber-400/30 bg-amber-400/5",
  "text-rose-500 dark:text-rose-400 border-rose-500 dark:border-rose-400/30 bg-rose-500 dark:bg-rose-400/5",
];

const BAR_COLORS = [
  "bg-primary",
  "bg-sky-400",
  "bg-emerald-500 dark:bg-emerald-400",
  "bg-amber-400",
  "bg-rose-500 dark:bg-rose-400",
];

const MAX_COMPARE_ASSETS = 3;
const MAX_COMPARE_ASSETS_MESSAGE = "Compare supports up to 3 assets. Remove one to continue.";



function CompareSearchParamsInit({ onSymbols }: { onSymbols: (syms: string[]) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const s = searchParams.get("symbols");
    if (s) {
      const syms = Array.from(new Set(s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean)));
      if (syms.length) onSymbols(syms);
    }
  }, [onSymbols, searchParams]);
  return null;
}

export default function ComparePage() {
  const { plan } = usePlan();
  const isElite = plan === "ELITE" || plan === "ENTERPRISE";

  const { region } = useRegion();
  const [inputSymbols, setInputSymbols] = useState<string[]>([]);
  const [results, setResults] = useState<AssetCompareResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lyraQuery, setLyraQuery] = useState("");
  const [lyraLoading, setLyraLoading] = useState(false);
  const [lyraElapsedSeconds, setLyraElapsedSeconds] = useState(0);
  const [lyraLoadStartTime, setLyraLoadStartTime] = useState<number | null>(null);
  const [lyraResponseText, setLyraResponseText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [smartAutorun, setSmartAutorun] = useState(true); // Default ON for autorun

  // Persist smartAutorun preference to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("compare-smart-autorun");
    if (saved !== null) {
      setSmartAutorun(saved === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("compare-smart-autorun", String(smartAutorun));
  }, [smartAutorun]);

  const handleSymbolsInit = useCallback((syms: string[]) => {
    setErrorMessage(syms.length > MAX_COMPARE_ASSETS ? MAX_COMPARE_ASSETS_MESSAGE : null);
    setInputSymbols((prev) => {
      if (prev.length === syms.length && prev.every((s, i) => s === syms[i])) return prev;
      return syms;
    });
  }, []);

  const addSymbol = useCallback((sym: string) => {
    const upper = sym.trim().toUpperCase();
    if (!upper || inputSymbols.includes(upper)) return;
    if (inputSymbols.length >= MAX_COMPARE_ASSETS) {
      setErrorMessage(MAX_COMPARE_ASSETS_MESSAGE);
      return;
    }
    setErrorMessage(null);
    setInputSymbols((prev) => [...prev, upper]);
  }, [inputSymbols]);

  const streamLyra = useCallback(async (query: string, resultsForBrief: typeof results) => {
    if (!query.trim() || resultsForBrief.length < 2) return;
    setLyraLoading(true);
    setLyraLoadStartTime(Date.now());
    setLyraResponseText("");

    const symbolList = resultsForBrief.map((r) => r.symbol).join(", ");
    const contextQuery = query.startsWith("Compare ") ? query : `Compare ${symbolList}: ${query}`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: contextQuery }],
          contextData: {
            symbol: "GLOBAL",
            assetType: "GLOBAL",
            assetName: `Comparison: ${symbolList}`,
            scores: {},
            chatMode: "compare",
            compareContext: resultsForBrief.map((r) => ({
              symbol: r.symbol,
              name: r.name,
              scores: r.scores,
              signal: r.signalStrength?.score,
              signalLabel: r.signalStrength?.label,
              factorAlignment: r.factorAlignment,
              performance: r.performance,
            })),
          },
          symbol: "GLOBAL",
        }),
      });

      if (!response.ok) throw new Error("Lyra error");

      const creditsRemaining = response.headers.get("X-Credits-Remaining");
      if (creditsRemaining !== null) {
        const nextCredits = Number(creditsRemaining);
        if (Number.isFinite(nextCredits)) {
          await setAuthoritativeCreditBalance(nextCredits);
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
        text += decoder.decode(value, { stream: true });
        const displayText = text.replace(/:::LYRA_SOURCES:::[\s\S]*$/, "").trimEnd();
        setLyraResponseText(displayText);
      }
      const finalText = (text + decoder.decode()).replace(/:::LYRA_SOURCES:::[\s\S]*$/, "").trimEnd();
      const { text: parsedText } = parseLyraMessage(finalText);
      setLyraResponseText(parsedText);
    } catch {
      setLyraResponseText("Lyra is unavailable. Please try again.");
    } finally {
      setLyraLoading(false);
    }
  }, []);

  const runCompare = useCallback(async (symbolsToCompare: string[]) => {
    if (symbolsToCompare.length < 2) return;
    if (symbolsToCompare.length > MAX_COMPARE_ASSETS) {
      setErrorMessage(MAX_COMPARE_ASSETS_MESSAGE);
      return;
    }
    setLoading(true);
    setResults([]);
    setErrorMessage(null);
    setLyraResponseText(null);
    const creditCost = calculateMultiAssetAnalysisCredits(symbolsToCompare.length);
    await applyOptimisticCreditDelta(-creditCost);
    try {
      const res = await fetch(`/api/stocks/compare?symbols=${symbolsToCompare.join(",")}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const remaining = typeof payload?.remaining === "number" ? payload.remaining : null;
        if (remaining !== null) {
          await setAuthoritativeCreditBalance(remaining);
        } else {
          await applyOptimisticCreditDelta(creditCost);
        }
        throw new Error(payload?.error || "Compare failed");
      }
      const data = await res.json();
      const assets = data.assets || [];
      setResults(assets);
      void revalidateCreditViews();
      
      if (assets.length >= 2 && smartAutorun) {
        const symbolList = assets.map((r: AssetCompareResult) => r.symbol).join(", ");
        const autoQuery = `Compare ${symbolList}: Which offers the best risk-adjusted returns and regime alignment? Provide an executive brief.`;
        setTimeout(() => {
          void streamLyra(autoQuery, assets);
        }, 300);
      }
    } catch (error) {
      void revalidateCreditViews();
      setErrorMessage(error instanceof Error ? error.message : "Compare failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [streamLyra, smartAutorun]);

  const removeSymbol = useCallback((sym: string, currentSymbols: string[]) => {
    const nextSymbols = currentSymbols.filter((s) => s !== sym);
    setInputSymbols(nextSymbols);
    if (nextSymbols.length <= MAX_COMPARE_ASSETS) setErrorMessage(null);
    setResults((prev) => prev.filter((r) => r.symbol !== sym));
    
    if (nextSymbols.length >= 2 && results.length > 0) {
      setTimeout(() => {
        void runCompare(nextSymbols);
      }, 100);
    }
  }, [results.length, runCompare]);

  const askLyra = useCallback(async () => {
    if (!lyraQuery.trim() || results.length < 2) return;
    setLyraQuery("");
    await streamLyra(lyraQuery, results);
  }, [lyraQuery, results, streamLyra]);

  const validResults = results.filter((r) => !r.error);
  const comparisonLeader = validResults.reduce<AssetCompareResult | null>((best, current) => {
    if (!best) return current;
    const bestScore = (best.signalStrength?.score ?? 0) + (best.factorAlignment?.score ?? 0);
    const currentScore = (current.signalStrength?.score ?? 0) + (current.factorAlignment?.score ?? 0);
    return currentScore > bestScore ? current : best;
  }, null);
  const compareShare = validResults.length >= 2 && comparisonLeader
    ? buildCompareShareObject({
        title: `${getFriendlySymbol(comparisonLeader.symbol, comparisonLeader.type, comparisonLeader.name)} leads this ${validResults.length}-asset comparison`,
        takeaway: `${getFriendlySymbol(comparisonLeader.symbol, comparisonLeader.type, comparisonLeader.name)} is the cleanest current leader on signal strength${comparisonLeader.factorAlignment?.regimeFit ? ` with ${comparisonLeader.factorAlignment.regimeFit.toLowerCase()} regime fit` : ""}.`,
        context: `Compared against ${validResults.filter((result) => result.symbol !== comparisonLeader.symbol).map((result) => getFriendlySymbol(result.symbol, result.type, result.name)).join(", ")}. Use the executive brief to see the momentum edge, key risk trade-offs and where the comparison still needs caution.`,
        scoreValue: validResults.map((result) => getFriendlySymbol(result.symbol, result.type, result.name)).join(" vs "),
        href: `/dashboard/compare?symbols=${validResults.map((result) => result.symbol).join(",")}`,
      })
    : null;

  // Track elapsed seconds while lyra is loading
  useEffect(() => {
    if (!lyraLoading || !lyraLoadStartTime) {
      setLyraElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setLyraElapsedSeconds(Math.floor((Date.now() - lyraLoadStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lyraLoading, lyraLoadStartTime]);

  // Find best score per dimension
  const getBestIdx = (key: keyof NonNullable<AssetCompareResult["scores"]>) => {
    let best = -1;
    let bestVal = -Infinity;
    validResults.forEach((r, i) => {
      const v = r.scores?.[key] ?? -1;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  };

  return (
    <div className="overflow-x-hidden relative pb-6 p-3 sm:p-4 md:p-6 space-y-6 w-full min-w-0">
      <Suspense fallback={null}>
        <CompareSearchParamsInit onSymbols={handleSymbolsInit} />
      </Suspense>
      <PageHeader
        icon={<GitCompare className="h-5 w-5" />}
        title="Compare"
        eyebrow="Compare up to 3 assets"
        chips={
          <>
            {inputSymbols.length > 0
              ? inputSymbols.map((s) => <StatChip key={s} value={s} label="vs" />)
              : <StatChip value="Up to 3" label="Assets" variant="muted" />
            }
            {comparisonLeader && (
              <StatChip
                value={getFriendlySymbol(comparisonLeader.symbol, comparisonLeader.type, comparisonLeader.name)}
                label="Leader"
                variant="green"
              />
            )}
            <StatChip value={region} label="Market" variant="muted" />
          </>
        }
        actions={compareShare ? <ShareInsightButton share={compareShare} label="Share" /> : undefined}
      />

      {!isElite ? (
        <EliteGate
          feature="discovery_feed"
          plan={plan}
          teaser="Compare up to 3 assets side-by-side with full score breakdowns, factor alignment and credit pricing of 5 for the first asset plus 3 for each additional asset."
        >
          <div />
        </EliteGate>
      ) : (
        <>
          {/* Symbol Input */}
          <div className="rounded-4xl border border-white/10 bg-card/70 p-5 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Add up to 3 assets to compare · 5 credits for the first asset + 3 credits per additional asset
            </p>
            <div className="flex flex-wrap gap-2">
              {inputSymbols.map((sym, i) => (
                <div
                  key={sym}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold",
                    COLORS[i % COLORS.length],
                  )}
                >
                  {sym}
                  <button onClick={() => removeSymbol(sym, inputSymbols)} className="opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {inputSymbols.length < MAX_COMPARE_ASSETS && (
                <AssetSearchInput
                  onSelect={addSymbol}
                  region={region}
                  global={true}
                  placeholder={region === "IN" ? "Search BTC, Bitcoin, ETH" : "Search BTC, Bitcoin, ETH"}
                  className="w-72 max-w-full"
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => runCompare(inputSymbols)}
                disabled={inputSymbols.length < 2 || inputSymbols.length > MAX_COMPARE_ASSETS || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-black text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompare className="h-3.5 w-3.5" />}
                {loading ? "Analyzing..." : "Compare"}
              </button>
              
              {/* Smart Autorun Toggle */}
              <div className="flex items-center gap-2 pl-3 border-l border-white/10">
                <Switch
                  id="smart-autorun"
                  checked={smartAutorun}
                  onCheckedChange={setSmartAutorun}
                  className="data-[state=checked]:bg-primary"
                />
                <label
                  htmlFor="smart-autorun"
                  className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none"
                >
                  Auto-analyze
                </label>
              </div>
            </div>
            {errorMessage ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-semibold text-rose-400">
                {errorMessage}
              </div>
            ) : null}
          </div>

          {/* Results */}
          {validResults.length >= 2 && (
            <div className="space-y-4">
              {compareShare ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/15 bg-primary/5 p-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Share the verdict</p>
                    <p className="text-sm font-semibold text-foreground">Turn this side-by-side comparison into a polished post, preview card or network share.</p>
                  </div>
                  <ShareInsightButton share={compareShare} label="Share result" />
                </div>
              ) : null}
              {/* Asset Headers */}
              <div className={cn("grid gap-3", `grid-cols-${validResults.length}`)}>
                {validResults.map((r, i) => (
                  <Link
                    key={r.symbol}
                    href={`/dashboard/assets/${r.symbol}`}
                    className={cn(
                      "rounded-4xl border border-white/10 bg-card/70 p-4 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl hover:opacity-90 transition-opacity",
                      COLORS[i % COLORS.length],
                    )}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">{r.type}</p>
                    <p className="text-lg font-bold tracking-tight mt-1">{getFriendlySymbol(r.symbol, r.type, r.name)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.name}</p>
                    {r.price != null && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-sm font-bold">{formatPrice(r.price, getCurrencyConfig(r.currency || "USD"))}</span>
                        {r.changePercent != null && (
                          <span className={cn("text-[10px] font-bold flex items-center gap-0.5", r.changePercent >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                            {r.changePercent >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    )}
                    {r.signalStrength && (
                      <div className="mt-2 text-[9px] font-bold uppercase tracking-wider opacity-70">
                        Signal: {r.signalStrength.score}/100 · {r.signalStrength.label}
                      </div>
                    )}
                  </Link>
                ))}
              </div>

              {/* Radar Score Comparison */}
              <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl lg:p-8 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Score comparison</h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  {/* Radar Chart side */}
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={Object.entries(SCORE_LABELS).map(([key, label]) => {
                        const point: Record<string, string | number> = { subject: label };
                        validResults.forEach(r => {
                          point[r.symbol] = r.scores?.[key as keyof typeof r.scores] ?? 0;
                        });
                        return point;
                      })}>
                        <PolarGrid stroke="rgba(255,255,255,0.05)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 800 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'rgb(24 24 27 / 0.95)', border: '1px solid rgb(255 255 255 / 0.1)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        {validResults.map((r, i) => {
                          const COLORS_HEX = ["#fbbf24", "#38bdf8", "#34d399", "#fb923c", "#f87171"];
                          const color = COLORS_HEX[i % COLORS_HEX.length];
                          return (
                            <Radar
                              key={r.symbol}
                              name={r.symbol}
                              dataKey={r.symbol}
                              stroke={color}
                              fill={color}
                              fillOpacity={0.2}
                              strokeWidth={2}
                              dot={{ r: 3, fillOpacity: 1 }}
                            />
                          );
                        })}
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Score Breakdown side */}
                  <div className="space-y-4">
                    {Object.entries(SCORE_LABELS).map(([key, label]) => {
                      const bestIdx = getBestIdx(key as keyof NonNullable<AssetCompareResult["scores"]>);
                      return (
                        <div key={key} className="space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
                          <div className="space-y-1.5">
                            {validResults.map((r, i) => {
                              const v = r.scores?.[key as keyof NonNullable<AssetCompareResult["scores"]>] ?? null;
                              return (
                                <div key={r.symbol} className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold w-14 truncate opacity-60">{getFriendlySymbol(r.symbol, r.type, r.name)}</span>
                                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full transition-all duration-700", BAR_COLORS[i % BAR_COLORS.length])}
                                      style={{ width: `${Math.min(v ?? 0, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold w-8 text-right tabular-nums">
                                    {v != null ? Math.round(v) : "—"}
                                  </span>
                                  {i === bestIdx && v != null && v > 0 && (
                                    <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                                      Best
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Performance Comparison */}
              <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl lg:p-8 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Performance Returns</h3>
                </div>
                <div className="relative overflow-x-auto rounded-3xl border border-white/10 bg-background/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/10">
                        <th className="text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground py-3 pl-4 pr-4">Period</th>
                        {validResults.map((r) => (
                          <th key={r.symbol} className="text-right text-[10px] font-bold uppercase tracking-widest py-3 px-3 text-primary">
                            {getFriendlySymbol(r.symbol, r.type, r.name)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {Object.entries(PERF_LABELS).map(([key, label]) => (
                        <tr key={key} className="hover:bg-muted/5 transition-colors group">
                          <td className="py-3 pl-4 pr-4 text-[10px] text-muted-foreground font-bold">{label}</td>
                          {validResults.map((r) => {
                            const v = r.performance?.[key] ?? null;
                            const allVals = validResults.map((x) => x.performance?.[key] ?? null).filter((x): x is number => x != null);
                            const isBest = v != null && allVals.length > 1 && v === Math.max(...allVals);
                            return (
                              <td key={r.symbol} className={cn("py-3 px-3 relative text-right font-bold tabular-nums transition-colors duration-300", 
                                v == null ? "text-muted-foreground/50 dark:text-muted-foreground/30" : v >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                                isBest && "bg-emerald-500/5 backdrop-blur-md"
                              )}>
                                {isBest && (
                                  <div className="absolute inset-0 border border-emerald-500/20 shadow-[inset_0_0_15px_rgba(52,211,153,0.1)] rounded-md m-0.5 pointer-events-none" />
                                )}
                                <span className="relative z-10 flex justify-end items-center gap-1">
                                  {v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"}
                                  {isBest && <Crown className="h-3 w-3 text-emerald-500 dark:text-emerald-400 ml-1 opacity-70 drop-shadow-[0_0_3px_rgba(52,211,153,0.8)]" />}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Factor Alignment */}
              {validResults.some((r) => r.factorAlignment) && (
                <div className="rounded-4xl border border-white/10 bg-card/70 p-5 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Factor Alignment</h3>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${validResults.length}, 1fr)` }}>
                    {validResults.map((r, i) => (
                      <div key={r.symbol} className={cn("rounded-2xl border p-3 space-y-1", COLORS[i % COLORS.length])}>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">{getFriendlySymbol(r.symbol, r.type, r.name)}</p>
                        {r.factorAlignment ? (
                          <>
                            <p className="text-lg font-bold">{Math.round(r.factorAlignment.score)}</p>
                            <p className="text-[9px] font-bold opacity-70">{r.factorAlignment.regimeFit} fit</p>
                            <p className="text-[9px] opacity-60">{r.factorAlignment.dominantFactor}</p>
                          </>
                        ) : (
                          <p className="text-[9px] opacity-40">N/A</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lyra Synthesis (Floating Executive Brief) */}
              <div className="relative mt-8 group rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(251,191,36,0.15)] transition-all duration-500 hover:shadow-[0_0_50px_rgba(251,191,36,0.25)] border border-primary/20 bg-background/50 backdrop-blur-3xl p-px w-full max-w-full">
                <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
                <div className="relative bg-card/80 backdrop-blur-3xl rounded-2xl p-6 lg:p-8 flex flex-col gap-6 min-w-0 w-full overflow-x-hidden">

                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                      {lyraLoading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Sparkles className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <h3 className="text-base font-bold uppercase tracking-widest premium-gradient-text">Lyra analysis</h3>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">
                        {lyraLoading ? "Analyzing..." : "Ask Lyra a follow-up"}
                      </p>
                    </div>
                  </div>

                  {/* AI Response Display — uses same AnswerWithSources as Lyra chat */}
                  {(lyraResponseText || lyraLoading) ? (
                    <div className="min-h-[60px]">
                      {lyraResponseText ? (
                        <AnswerWithSources
                          content={lyraResponseText}
                          sources={[]}
                          toolResults={[]}
                          relatedQuestions={[]}
                          onRelatedQuestionClick={(q) => streamLyra(q, validResults)}
                          query=""
                        />
                      ) : (
                        <AnalysisLoadingState
                          elapsedSeconds={lyraElapsedSeconds}
                          initialLabel="Lyra is analyzing comparison..."
                          reasoningLabel="Lyra is reasoning deeply..."
                          reasoningDetail="Cross-referencing multi-asset signals & regime context"
                          finalLabel="Running deep multi-asset analysis..."
                          finalDetail="GPT deep synthesis — usually 20–45s for multi-asset queries"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-background/30 px-4 py-3 text-xs text-muted-foreground/70">
                      Ask Lyra for a focused executive brief after the comparison loads.
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-white/5 pt-4 min-w-0 w-full">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Ask a follow-up</p>
                    <div className="flex gap-2 relative z-10">
                      <div className="relative flex-1">
                        <input
                          value={lyraQuery}
                          onChange={(e) => setLyraQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !lyraLoading && askLyra()}
                          placeholder={`Which of ${validResults.map((r) => getFriendlySymbol(r.symbol, r.type, r.name)).join(", ")} offers better risk-adjusted returns?`}
                          disabled={lyraLoading}
                          className="w-full h-11 pl-4 pr-12 rounded-2xl border border-primary/30 bg-background/80 backdrop-blur-sm text-xs font-bold text-foreground placeholder:text-muted-foreground/50 placeholder:font-medium focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all shadow-inner disabled:opacity-50"
                        />
                        <button
                          onClick={askLyra}
                          disabled={!lyraQuery.trim() || lyraLoading}
                          className="absolute right-1.5 top-1.5 bottom-1.5 w-9 flex items-center justify-center rounded-xl bg-primary text-black hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:hover:bg-primary"
                        >
                          {lyraLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Which has better risk/reward?",
                        "Which is more regime-aligned?",
                        "Identify key vulnerabilities.",
                        "Compare momentum vs value factors.",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => { void streamLyra(q, validResults); }}
                          disabled={lyraLoading}
                          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/40 px-3 py-1.5 text-[10px] font-bold text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                        >
                          <Zap className="h-3 w-3 opacity-60" />
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && validResults.length === 0 && inputSymbols.length >= 2 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
              <GitCompare className="h-12 w-12 opacity-20" />
              <p className="text-sm font-bold">Click Compare to analyze your selected assets</p>
            </div>
          )}

          {inputSymbols.length < 2 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
              <GitCompare className="h-12 w-12 opacity-20" />
              <p className="text-sm font-bold">Add at least 2 symbols to compare</p>
              <p className="text-xs opacity-60">Try BTC-USD, ETH-USD, SOL-USD or BNB-USD, XRP-USD</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
