"use client";

import { cn } from "@/lib/utils";
import { SignalStrengthResult, SignalLabel } from "@/lib/engines/signal-strength";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  Bot,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SignalStrengthCardProps {
  signalStrength: SignalStrengthResult;
  symbol: string;
  assetName?: string;
  onAskLyra?: () => void;
  className?: string;
}

// ─── Signal Color Mapping ────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SignalLabel, {
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: typeof TrendingUp;
  gradientStop: string;
}> = {
  "Strong Bullish": {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    glowColor: "bg-emerald-500/5",
    icon: TrendingUp,
    gradientStop: "emerald",
  },
  "Bullish": {
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    glowColor: "bg-green-500/5",
    icon: TrendingUp,
    gradientStop: "green",
  },
  "Neutral": {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    glowColor: "bg-amber-500/5",
    icon: Minus,
    gradientStop: "amber",
  },
  "Bearish": {
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    glowColor: "bg-orange-500/5",
    icon: TrendingDown,
    gradientStop: "orange",
  },
  "Strong Bearish": {
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    glowColor: "bg-rose-500/5",
    icon: TrendingDown,
    gradientStop: "rose",
  },
};

// ─── Semicircle Gauge Component ──────────────────────────────────────────────

function SignalGauge({ score, label }: { score: number; label: SignalLabel }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const config = SIGNAL_CONFIG[label];
  const Icon = config.icon;

  // SVG semicircle gauge
  const radius = 80;
  const strokeWidth = 10;
  const cx = 100;
  const cy = 95;
  const circumference = Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  // Needle angle: 0 = left (180°), 100 = right (0°)
  const needleAngle = 180 - (animatedScore / 100) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLength = radius - 15;
  const needleX = cx + needleLength * Math.cos(needleRad);
  const needleY = cy - needleLength * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center relative">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="currentColor"
          strokeWidth="2"
          className="text-foreground transition-all duration-1000 ease-out"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="4" className="fill-foreground" />

        {/* Scale labels */}
        <text x="12" y={cy + 18} className="fill-muted-foreground text-[8px] font-bold" textAnchor="start">0</text>
        <text x="188" y={cy + 18} className="fill-muted-foreground text-[8px] font-bold" textAnchor="end">100</text>
      </svg>

      {/* Score display */}
      <div className="flex flex-col items-center -mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-4xl font-bold tracking-tighter", config.color)}>
            {animatedScore}
          </span>
          <span className="text-sm font-bold text-muted-foreground opacity-40">/100</span>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full border",
          config.bgColor,
          config.borderColor,
        )}>
          <Icon className={cn("h-3.5 w-3.5", config.color)} />
          <span className={cn("text-xs font-bold uppercase tracking-wider", config.color)}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Breakdown Bar ───────────────────────────────────────────────────────────

function BreakdownBar({
  label,
  score,
  weight,
  tooltip,
}: {
  label: string;
  score: number;
  weight: number;
  tooltip: string;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const getBarColor = (s: number) => {
    if (s >= 70) return "bg-emerald-500";
    if (s >= 55) return "bg-green-500";
    if (s >= 45) return "bg-amber-500";
    if (s >= 30) return "bg-orange-500";
    return "bg-rose-500";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-1 cursor-help group/bar">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-80 group-hover/bar:opacity-100 transition-opacity">
              {label}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-medium text-muted-foreground opacity-40">
                {Math.round(weight * 100)}%
              </span>
              <span className="text-xs font-bold text-foreground">
                {Math.round(animated)}
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                getBarColor(animated),
              )}
              style={{ width: `${animated}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="p-3 max-w-[220px] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        <p className="text-xs leading-relaxed text-muted-foreground">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Confidence Badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: "low" | "medium" | "high" }) {
  const config = {
    high: { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "High Confidence" },
    medium: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Medium Confidence" },
    low: { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", label: "Low Confidence" },
  };

  const c = config[confidence];
  const Icon = c.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border cursor-help",
          c.bg, c.border,
        )}>
          <Icon className={cn("h-3 w-3", c.color)} />
          <span className={cn("text-[9px] font-bold uppercase tracking-widest", c.color)}>
            {c.label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="p-3 max-w-[240px] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {confidence === "high" && "Strong data coverage across multiple engines with high regime confidence and engine agreement."}
          {confidence === "medium" && "Moderate data coverage. Some engines may have limited data or conflicting signals."}
          {confidence === "low" && "Limited data available. Signal should be interpreted with caution — insufficient history or conflicting indicators."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SignalStrengthCard({
  signalStrength,
  symbol,
  onAskLyra,
  className,
}: SignalStrengthCardProps) {
  const config = SIGNAL_CONFIG[signalStrength.label];

  return (
    <div className={cn(
      "relative rounded-3xl border bg-card/60 backdrop-blur-2xl overflow-hidden",
      config.borderColor,
      className,
    )}>
      {/* Background glow */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-full opacity-30 blur-3xl -z-10",
        config.glowColor,
      )} />

      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-4 pb-3 flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-2xl border", config.bgColor, config.borderColor)}>
            <config.icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Signal Strength
            </h3>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/5 bg-background/50 text-xs font-bold text-muted-foreground/80 cursor-help" title="Based on data completeness, engine agreement and regime stability">
              <ShieldCheck className={cn("h-3.5 w-3.5", config.color)} />
              <span className={config.color}>{signalStrength.confidence}</span>
              <span>Confidence</span>
              <Link href="/dashboard/learning/reading-confidence-levels" className="ml-1 text-[10px] text-primary hover:underline flex items-center">Learn<ArrowRight className="h-2.5 w-2.5 ml-0.5" /></Link>
            </div>
          </div>
        </div>
        <ConfidenceBadge confidence={signalStrength.confidence} />
      </div>

      {/* Main content grid */}
      <div className="px-4 sm:px-6 md:px-8 pb-5 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Left: Gauge + Breakdown */}
        <div className="flex flex-col gap-5">
          <SignalGauge score={signalStrength.score} label={signalStrength.label} />

          {/* Layer Breakdown */}
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-40">
                Layer Breakdown
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground opacity-20 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="p-3 max-w-[240px] bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The signal is composed of 4 layers, each weighted by asset type for maximum accuracy.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <BreakdownBar
              label="DSE Engines"
              score={signalStrength.breakdown.dse}
              weight={signalStrength.weights.dse}
              tooltip="Composite of 6 deterministic score engines: Trend, Momentum, Volatility (inverted), Sentiment, Liquidity and Trust."
            />
            <BreakdownBar
              label="Regime Alignment"
              score={signalStrength.breakdown.regime}
              weight={signalStrength.weights.regime}
              tooltip="How well the asset's characteristics align with the current market regime (ARCS compatibility + factor alignment + regime momentum)."
            />
            <BreakdownBar
              label="Fundamentals"
              score={signalStrength.breakdown.fundamental}
              weight={signalStrength.weights.fundamental}
              tooltip="Valuation quality (P/E, PEG, P/B), profitability (ROE, margins), analyst consensus targets and institutional ownership signals."
            />
            <BreakdownBar
              label="Score Dynamics"
              score={signalStrength.breakdown.dynamics}
              weight={signalStrength.weights.dynamics}
              tooltip="Temporal momentum of engine scores — are they improving, stable or deteriorating? Includes acceleration and percentile ranking."
            />
          </div>
        </div>

        {/* Right: Drivers + Risks + Thesis */}
        <div className="flex flex-col gap-4">
          {/* Key Drivers */}
          {signalStrength.keyDrivers.length > 0 && (
            <div className="space-y-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-40">
                Key Drivers
              </span>
              <div className="space-y-1.5">
                {signalStrength.keyDrivers.map((driver, i) => (
                  <div key={i} className="flex items-start gap-2 group/driver">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0 opacity-70 group-hover/driver:opacity-100 transition-opacity" />
                    <span className="text-xs text-muted-foreground leading-relaxed group-hover/driver:text-foreground transition-colors">
                      {driver}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {signalStrength.riskFactors.length > 0 && (
            <div className="space-y-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-40">
                Risk Factors
              </span>
              <div className="space-y-1.5">
                {signalStrength.riskFactors.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 group/risk">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0 opacity-70 group-hover/risk:opacity-100 transition-opacity" />
                    <span className="text-xs text-muted-foreground leading-relaxed group-hover/risk:text-foreground transition-colors">
                      {risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Engine Direction Strip */}
      <div className="px-4 sm:px-6 md:px-8 py-2 border-t border-border/30 bg-background/20">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-30">
            Engine Signals
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          <div className="flex flex-wrap gap-2 sm:flex-1">
            {Object.entries(signalStrength.engineDirections).map(([engine, direction]) => (
              <EngineDirectionChip key={engine} engine={engine} direction={direction} />
            ))}
          </div>
          {onAskLyra && (
            <button
              type="button"
              onClick={() => onAskLyra()}
              className="group/cta w-full md:w-1/2 flex items-center justify-between gap-3 px-4 py-3 mt-3 sm:mt-0 rounded-2xl bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/40 hover:from-primary/15 transition-all duration-300 cursor-pointer text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-2xl bg-primary/15 border border-primary/25 shrink-0 group-hover/cta:scale-105 transition-transform">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-foreground/90 group-hover/cta:text-foreground transition-colors truncate">
                    Ask Lyra for Analysis
                  </p>
                  <p className="text-[9px] font-medium text-muted-foreground group-hover/cta:text-muted-foreground/80 transition-colors truncate">
                    Get institutional thesis on {symbol}
                  </p>
                </div>
              </div>
              <div className="shrink-0 p-2 rounded-2xl bg-primary/20 border border-primary/30 group-hover/cta:bg-primary/30 transition-colors">
                <ArrowRight className="h-4 w-4 text-primary group-hover/cta:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 sm:px-6 md:px-8 py-2.5 border-t border-border/20 bg-background/10">
        <p className="text-[9px] text-muted-foreground opacity-30 leading-relaxed">
          Signal strength is algorithmic analysis based on quantitative indicators, not investment advice. 
          Past performance does not guarantee future results. Always conduct your own research.
        </p>
      </div>
    </div>
  );
}

// ─── Engine Direction Chip ───────────────────────────────────────────────────

function EngineDirectionChip({ engine, direction }: { engine: string; direction: string }) {
  const dirConfig: Record<string, { color: string; bg: string; border: string }> = {
    STRONG_BULLISH: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    BULLISH: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
    NEUTRAL: { color: "text-muted-foreground", bg: "bg-muted/20", border: "border-white/5" },
    BEARISH: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    STRONG_BEARISH: { color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  };

  const c = dirConfig[direction] || dirConfig.NEUTRAL;
  const displayDirection = direction.replace(/_/g, " ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-xl border cursor-help",
          c.bg, c.border,
        )}>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider opacity-80">
            {engine}
          </span>
          <div className={cn("h-1.5 w-1.5 rounded-full", c.color.replace("text-", "bg-"))} />
        </div>
      </TooltipTrigger>
      <TooltipContent className="p-2 bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        <p className="text-[10px] font-bold">
          <span className="text-muted-foreground">{engine}:</span>{" "}
          <span className={c.color}>{displayDirection}</span>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
