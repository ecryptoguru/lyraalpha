"use client";

import useSWR from "swr";
import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AnalogSearchResult, HistoricalAnalogResult } from "@/lib/engines/historical-analog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const REGIME_COLOR: Record<string, string> = {
  RISK_ON: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  RISK_OFF: "text-red-500 bg-red-500/10 border-red-500/20",
  DEFENSIVE: "text-amber-500 bg-amber-500/10 border-amber-500/20",
};

const REGIME_TOOLTIP: Record<string, string> = {
  RISK_ON: "Market participants are broadly accepting risk. Equities, high-yield and growth assets typically outperform.",
  STRONG_RISK_ON: "Peak risk appetite. Broad participation across equities, commodities and high-beta assets.",
  RISK_OFF: "Risk aversion is dominant. Capital flows toward defensives, bonds and cash equivalents.",
  DEFENSIVE: "Cautious positioning. Mixed signals — some risk reduction but not full flight to safety.",
  NEUTRAL: "No dominant regime signal. Markets are in a transitional or indecisive state.",
};

function regimeColor(state: string) {
  for (const key of Object.keys(REGIME_COLOR)) {
    if (state.includes(key)) return REGIME_COLOR[key];
  }
  return "text-muted-foreground bg-muted/20 border-border";
}

function regimeTooltip(state: string) {
  for (const key of Object.keys(REGIME_TOOLTIP)) {
    if (state.includes(key)) return REGIME_TOOLTIP[key];
  }
  return "Market regime classification based on breadth, volatility and cross-asset signals.";
}

function fmtReturn(v: number | null) {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function returnColor(v: number | null) {
  if (v === null || Math.abs(v) < 0.5) return "text-muted-foreground";
  return v > 0 ? "text-emerald-500" : "text-red-500";
}

const TOOLTIP_CLS = "p-3 max-w-[220px] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl";

function AnalogRow({ analog }: { analog: HistoricalAnalogResult }) {
  const { fwd5d, fwd20d, fwd60d } = analog.forwardReturns;
  const pct = Math.round(analog.similarity * 100);

  const RETURN_TOOLTIPS: [string, number | null, string][] = [
    ["5d", fwd5d, "Median market return 5 trading days after this regime pattern was observed."],
    ["20d", fwd20d, "Median market return 20 trading days (≈1 month) after this pattern."],
    ["60d", fwd60d, "Median market return 60 trading days (≈3 months) after this pattern."],
  ];

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      {/* Left: label + regime */}
      <div className="flex-1 min-w-0 space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs font-bold text-foreground truncate cursor-help">{analog.label}</p>
          </TooltipTrigger>
          <TooltipContent side="top" className={TOOLTIP_CLS}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> Period
            </p>
            <p className="text-xs text-foreground leading-relaxed">{analog.label}</p>
            {analog.maxDrawdown20d !== null && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Max drawdown (20d): <span className={analog.maxDrawdown20d < -5 ? "text-red-400 font-bold" : "text-foreground font-bold"}>{analog.maxDrawdown20d.toFixed(1)}%</span>
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border cursor-help", regimeColor(analog.regimeState))}>
                {analog.regimeState.replace(/_/g, " ")}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={TOOLTIP_CLS}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Regime</p>
              <p className="text-xs text-foreground leading-relaxed">{regimeTooltip(analog.regimeState)}</p>
            </TooltipContent>
          </Tooltip>

          {analog.maxDrawdown20d !== null && analog.maxDrawdown20d < -5 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-400 cursor-help">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {analog.maxDrawdown20d.toFixed(1)}%
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                <p className="text-xs text-foreground leading-relaxed">
                  Peak drawdown of <span className="font-bold text-red-400">{analog.maxDrawdown20d.toFixed(1)}%</span> was recorded within 20 days of this pattern. Elevated short-term risk.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Middle: similarity bar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-16 shrink-0 space-y-0.5 cursor-help">
            <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
              <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[9px] font-bold text-primary text-right tabular-nums">{pct}%</p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className={TOOLTIP_CLS}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Pattern Match</p>
          <p className="text-xs text-foreground leading-relaxed">
            <span className="font-bold text-primary">{pct}%</span> similarity to the current market fingerprint, scored across regime state, breadth, volatility and cross-sector correlation.
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Right: forward returns */}
      <div className="flex items-center gap-3 shrink-0 text-right">
        {RETURN_TOOLTIPS.map(([label, val, tip]) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <div className="space-y-0.5 cursor-help">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className={cn("text-xs font-bold tabular-nums", returnColor(val))}>{fmtReturn(val)}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className={TOOLTIP_CLS}>
              <p className="text-xs text-foreground leading-relaxed">{tip}</p>
              {val !== null && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Observed: <span className={cn("font-bold", returnColor(val))}>{fmtReturn(val)}</span>
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function HistoricalAnalogCard({ region = "US" }: { region?: string }) {
  const { data, isLoading } = useSWR<AnalogSearchResult>(
    `/api/intelligence/analogs?region=${region}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5 space-y-3">
        <div className="h-4 w-36 rounded bg-muted/20 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-2xl bg-muted/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.analogs?.length) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl p-5 flex items-center gap-3 text-muted-foreground">
        <Clock className="h-5 w-5 shrink-0 opacity-30" />
        <div>
          <p className="text-xs font-bold">No historical analogs yet</p>
          <p className="text-[10px] opacity-80">Populate via the seed script to enable this feature.</p>
        </div>
      </div>
    );
  }

  const { analogs, medianFwd5d, medianFwd20d, medianFwd60d, currentFingerprint } = data;

  const overallTrend =
    medianFwd20d === null ? null :
    medianFwd20d > 2 ? "bullish" :
    medianFwd20d < -2 ? "bearish" : "neutral";

  const TrendIcon = overallTrend === "bullish" ? TrendingUp : overallTrend === "bearish" ? TrendingDown : Minus;
  const trendColor =
    overallTrend === "bullish" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
    overallTrend === "bearish" ? "text-red-500 bg-red-500/10 border-red-500/20" :
    "text-muted-foreground bg-muted/20 border-border";

  const MEDIAN_ROWS: [string, number | null, string][] = [
    ["Median 5d", medianFwd5d, "Median forward return across all matched periods, 5 trading days out."],
    ["Median 20d", medianFwd20d, "Median forward return across all matched periods, 20 trading days (≈1 month) out."],
    ["Median 60d", medianFwd60d, "Median forward return across all matched periods, 60 trading days (≈3 months) out."],
  ];

  return (
    <TooltipProvider>
      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Historical Analogs</span>
            </div>
            <p className="text-sm font-bold text-foreground">
              {analogs.length} similar period{analogs.length !== 1 ? "s" : ""} found
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[10px] text-muted-foreground cursor-help w-fit">
                  Now: <span className="font-bold text-foreground">{currentFingerprint.regimeState.replace(/_/g, " ")}</span>
                  {" · "}Breadth {currentFingerprint.breadthScore.toFixed(0)}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={TOOLTIP_CLS}>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Current Fingerprint
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  {regimeTooltip(currentFingerprint.regimeState)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Breadth score: <span className="font-bold text-foreground">{currentFingerprint.breadthScore.toFixed(0)}</span> — measures how broadly market participation is distributed.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {overallTrend && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("flex items-center gap-1 px-2 py-1 rounded-2xl border text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-help", trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  {overallTrend}
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className={TOOLTIP_CLS}>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Aggregate Signal</p>
                <p className="text-xs text-foreground leading-relaxed">
                  Based on the median 20-day forward return across all matched periods
                  {medianFwd20d !== null && <> (<span className={cn("font-bold", returnColor(medianFwd20d))}>{fmtReturn(medianFwd20d)}</span>)</>}.
                  {" "}{overallTrend === "bullish" ? "Markets historically recovered or advanced from this pattern." : overallTrend === "bearish" ? "Markets historically declined from this pattern." : "No strong directional bias historically."}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Median summary bar */}
        {(medianFwd5d !== null || medianFwd20d !== null || medianFwd60d !== null) && (
          <div className="grid grid-cols-3 divide-x divide-border/30 rounded-2xl bg-muted/10 border border-border/30 overflow-hidden">
            {MEDIAN_ROWS.map(([label, val, tip]) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <div className="py-2.5 text-center space-y-0.5 cursor-help">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className={cn("text-sm font-bold tabular-nums", returnColor(val))}>{fmtReturn(val)}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className={TOOLTIP_CLS}>
                  <p className="text-xs text-foreground leading-relaxed">{tip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Analog rows */}
        <div>
          {analogs.map((analog) => (
            <AnalogRow key={analog.id} analog={analog} />
          ))}
        </div>

        <p className="text-[9px] text-muted-foreground/40 text-center">
          Matched on regime · breadth · volatility · cross-sector correlation
        </p>
      </div>
    </TooltipProvider>
  );
}
