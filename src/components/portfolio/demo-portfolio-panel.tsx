"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Cpu,
  AlertTriangle,
  Zap,
  Target,
  PieChart as PieIcon,
  LineChart,
  GitBranch,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  X,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

// ─── US Demo Data ─────────────────────────────────────────────────────────────

const US_DEMO_HOLDINGS = [
  { symbol: "BTC-USD", name: "Bitcoin", qty: 0.5, avgPrice: 65000.0, price: 68000.0, changePercent: 2.5, sector: "Layer 1", weight: 34.1 },
  { symbol: "ETH-USD", name: "Ethereum", qty: 5.0, avgPrice: 3500.0, price: 3800.0, changePercent: 1.8, sector: "DeFi", weight: 22.2 },
  { symbol: "SOL-USD", name: "Solana", qty: 50, avgPrice: 150.0, price: 180.0, changePercent: 2.31, sector: "Layer 1", weight: 17.8 },
  { symbol: "BNB-USD", name: "BNB", qty: 10, avgPrice: 580.0, price: 620.0, changePercent: 0.45, sector: "Exchange", weight: 12.5 },
  { symbol: "XRP-USD", name: "XRP", qty: 2000, avgPrice: 2.10, price: 2.35, changePercent: 0.18, sector: "Payments", weight: 9.6 },
  { symbol: "ADA-USD", name: "Cardano", qty: 5000, avgPrice: 0.65, price: 0.72, changePercent: -0.32, sector: "Layer 1", weight: 4.6 },
  { symbol: "SOL", name: "Solana", qty: 50.0, avgPrice: 145.0, price: 165.0, changePercent: 3.2, sector: "Layer 1", weight: 12.5 },
  { symbol: "AVAX", name: "Avalanche", qty: 30.0, avgPrice: 38.0, price: 42.5, changePercent: -1.2, sector: "Layer 1", weight: 4.2 },
  { symbol: "UNI", name: "Uniswap", qty: 20.0, avgPrice: 8.5, price: 10.2, changePercent: 4.5, sector: "DeFi", weight: 7.2 },
];

const US_DEMO_ALLOCATION = [
  { label: "Layer 1", percent: 56.7, color: "#f7931a" },
  { label: "DeFi", percent: 22.2, color: "#3b82f6" },
  { label: "NFTs", percent: 10.3, color: "#a78bfa" },
  { label: "Layer 2", percent: 8.1, color: "#22c55e" },
  { label: "Stablecoins", percent: 2.7, color: "#f97316" },
];

const US_DEMO_HEALTH_DIMENSIONS = [
  { label: "Diversification", score: 62, color: "#3b82f6", desc: "Moderate — 57% in Layer 1" },
  { label: "Concentration", score: 74, color: "#22c55e", desc: "Reasonable spread across 10 names" },
  { label: "Volatility Control", score: 71, color: "#fbbf24", desc: "Elevated — BTC at 25% weight" },
  { label: "Correlation Risk", score: 58, color: "#f97316", desc: "High crypto-market correlation" },
  { label: "On-Chain Health", score: 81, color: "#22c55e", desc: "Strong network fundamentals" },
  { label: "Fragility Score", score: 67, color: "#fbbf24", desc: "Moderate tail risk exposure" },
];

const US_DEMO_MONTE_CARLO = {
  expectedReturn: 6.21, var95: -12.4, cvar95: -18.7, sharpeRatio: 0.84, pathCount: 5000,
  scenarios: [
    { label: "Bull Case (P90)", value: "+28.4%", color: "#22c55e" },
    { label: "Base Case (P50)", value: "+6.2%", color: "#3b82f6" },
    { label: "Bear Case (P10)", value: "-14.8%", color: "#f97316" },
    { label: "Extreme (P2.5)", value: "-31.2%", color: "#ef4444" },
  ],
};

const US_DEMO_REGIME_FORECAST = [
  { label: "NEUTRAL", pct: 42, color: "#94a3b8" },
  { label: "RISK ON", pct: 35, color: "#22c55e" },
  { label: "DEFENSIVE", pct: 23, color: "#f97316" },
];

const US_DEMO_BENCHMARK = [
  { month: "Jan", portfolio: 2.1, benchmark: 1.8 },
  { month: "Feb", portfolio: -1.4, benchmark: -1.2 },
  { month: "Mar", portfolio: 4.2, benchmark: 3.1 },
  { month: "Apr", portfolio: 1.8, benchmark: 2.4 },
  { month: "May", portfolio: 3.7, benchmark: 2.9 },
  { month: "Jun", portfolio: 5.1, benchmark: 3.8 },
];

const US_DEMO_EQUITY_CURVE = [
  { month: "Jan", value: 100000 },
  { month: "Feb", value: 98600 },
  { month: "Mar", value: 102780 },
  { month: "Apr", value: 104630 },
  { month: "May", value: 108500 },
  { month: "Jun", value: 114020 },
];

const US_DEMO_AI_INSIGHTS = [
  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", title: "Concentration alert", body: "BTC-USD now represents 34% of portfolio weight. A 20% drawdown in this single position would reduce total portfolio value by ~6.8%." },
  { icon: GitBranch, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20", title: "Sector correlation risk", body: "BTC-USD, ETH-USD, SOL-USD, and ADA-USD are in the same narrative cluster. A L1 sector rotation could trigger correlated drawdowns across 56% of the portfolio." },
  { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", title: "Hedge quality is strong", body: "BNB-USD and XRP-USD provide meaningful negative correlation during risk-off regimes. This reduces fragility by an estimated 8 points vs an all-L1 portfolio." },
  { icon: Target, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", title: "Next action", body: "Consider trimming BTC-USD below 25% and rotating proceeds into DeFi or Payments sectors to reduce sector correlation without sacrificing expected return." },
];

const US_DEMO_RISK_METRICS = [
  { label: "Beta (vs BTC-USD)", value: "1.24", detail: "More volatile than market" },
  { label: "Sharpe Ratio", value: "0.84", detail: "Moderate risk-adjusted return" },
  { label: "Sortino Ratio", value: "1.12", detail: "Good downside protection" },
  { label: "Max Drawdown", value: "-23.1%", detail: "Stress-tested 1Y horizon" },
  { label: "VaR (95%)", value: "-12.4%", detail: "Monthly 5th percentile" },
  { label: "CVaR (95%)", value: "-18.7%", detail: "Expected tail loss" },
];

const US_DEMO_FRAGILITY = [
  { label: "L1 Concentration", pct: 79, color: "#ef4444" },
  { label: "BTC Single-Name Weight", pct: 64, color: "#f97316" },
  { label: "Correlation Cluster Size", pct: 55, color: "#fbbf24" },
  { label: "Volatility Regime Mismatch", pct: 46, color: "#fbbf24" },
];

const US_DEMO_CORRELATIONS: [string, string, string][] = [
  ["BTC-USD", "ETH-USD", "0.87"], ["ETH-USD", "SOL-USD", "0.79"], ["BTC-USD", "SOL-USD", "0.74"], ["ETH-USD", "BNB-USD", "0.82"],
];

const US_DEMO_RETURN_DIST = [
  { p: "P2.5", ret: -31.2 }, { p: "P10", ret: -14.8 }, { p: "P25", ret: -3.1 },
  { p: "P50", ret: 6.2 }, { p: "P75", ret: 16.8 }, { p: "P90", ret: 22.1 }, { p: "P97.5", ret: 31.4 },
];

// ─── IN Demo Data ─────────────────────────────────────────────────────────────

const IN_DEMO_HOLDINGS = [
  { symbol: "BTC-USD", name: "Bitcoin", qty: 0.3, avgPrice: 95000, price: 104000, changePercent: 2.35, sector: "Layer 1", weight: 22.1 },
  { symbol: "ETH-USD", name: "Ethereum", qty: 3, avgPrice: 3100, price: 3400, changePercent: 1.12, sector: "DeFi", weight: 18.9 },
  { symbol: "SOL-USD", name: "Solana", qty: 40, avgPrice: 150, price: 180, changePercent: 3.41, sector: "Layer 1", weight: 20.6 },
  { symbol: "XRP-USD", name: "XRP", qty: 1500, avgPrice: 2.10, price: 2.35, changePercent: 0.18, sector: "Payments", weight: 16.0 },
  { symbol: "BNB-USD", name: "BNB", qty: 8, avgPrice: 580, price: 620, changePercent: 0.43, sector: "Exchange", weight: 12.2 },
  { symbol: "ADA-USD", name: "Cardano", qty: 4000, avgPrice: 0.65, price: 0.72, changePercent: 0.65, sector: "Layer 1", weight: 9.4 },
  { symbol: "DOT-USD", name: "Polkadot", qty: 200, avgPrice: 6.5, price: 7.2, changePercent: -0.55, sector: "Layer 0", weight: 8.8 },
  { symbol: "AVAX-USD", name: "Avalanche", qty: 80, avgPrice: 35, price: 42, changePercent: 1.34, sector: "Layer 1", weight: 11.4 },
];

const IN_DEMO_ALLOCATION = [
  { label: "Layer 1", percent: 51.5, color: "#3b82f6" },
  { label: "DeFi", percent: 18.9, color: "#22c55e" },
  { label: "Payments", percent: 16.0, color: "#f97316" },
  { label: "Exchange", percent: 12.2, color: "#fbbf24" },
  { label: "Layer 0", percent: 8.8, color: "#a78bfa" },
];

const IN_DEMO_HEALTH_DIMENSIONS = [
  { label: "Diversification", score: 68, color: "#22c55e", desc: "Good spread — 5 sectors represented" },
  { label: "Concentration", score: 61, color: "#fbbf24", desc: "L1 cluster at 51% warrants watch" },
  { label: "Volatility Control", score: 74, color: "#22c55e", desc: "Payments hedge reduces drawdown risk" },
  { label: "Correlation Risk", score: 63, color: "#fbbf24", desc: "L1 names (BTC, SOL, ADA) correlated" },
  { label: "Quality & Trust", score: 84, color: "#22c55e", desc: "Blue-chip crypto core holdings" },
  { label: "Fragility Score", score: 71, color: "#22c55e", desc: "Low-moderate tail risk exposure" },
];

const IN_DEMO_MONTE_CARLO = {
  expectedReturn: 8.40, var95: -11.2, cvar95: -16.8, sharpeRatio: 0.91, pathCount: 5000,
  scenarios: [
    { label: "Bull Case (P90)", value: "+32.1%", color: "#22c55e" },
    { label: "Base Case (P50)", value: "+8.4%", color: "#3b82f6" },
    { label: "Bear Case (P10)", value: "-11.6%", color: "#f97316" },
    { label: "Extreme (P2.5)", value: "-27.4%", color: "#ef4444" },
  ],
};

const IN_DEMO_REGIME_FORECAST = [
  { label: "NEUTRAL", pct: 38, color: "#94a3b8" },
  { label: "RISK ON", pct: 41, color: "#22c55e" },
  { label: "DEFENSIVE", pct: 21, color: "#f97316" },
];

const IN_DEMO_BENCHMARK = [
  { month: "Jan", portfolio: 3.2, benchmark: 2.4 },
  { month: "Feb", portfolio: -0.8, benchmark: -1.4 },
  { month: "Mar", portfolio: 5.1, benchmark: 3.8 },
  { month: "Apr", portfolio: 2.4, benchmark: 1.9 },
  { month: "May", portfolio: 4.8, benchmark: 3.6 },
  { month: "Jun", portfolio: 6.2, benchmark: 4.7 },
];

const IN_DEMO_EQUITY_CURVE = [
  { month: "Jan", value: 1000000 },
  { month: "Feb", value: 992000 },
  { month: "Mar", value: 1042720 },
  { month: "Apr", value: 1067682 },
  { month: "May", value: 1119064 },
  { month: "Jun", value: 1188427 },
];

const IN_DEMO_AI_INSIGHTS = [
  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", title: "L1 sector clustering", body: "BTC-USD, SOL-USD, and ADA-USD represent 51.5% combined weight in the same sector. A L1 rotation could compress all three simultaneously." },
  { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", title: "Payments hedge working well", body: "XRP-USD provides meaningful negative correlation during risk-off events, reducing portfolio fragility by ~9 points." },
  { icon: GitBranch, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20", title: "Exchange exposure is diversified", body: "BNB-USD spans exchange and DeFi narratives, reducing single-protocol failure risk while maintaining crypto core alignment." },
  { icon: Target, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", title: "Next action", body: "Consider adding a DeFi or Layer 2 position (e.g. UNI-USD or ARB-USD) to reduce L1 concentration and improve sector diversity score above 75." },
];

const IN_DEMO_RISK_METRICS = [
  { label: "Beta (vs BTC-USD)", value: "1.08", detail: "Slightly more volatile than market" },
  { label: "Sharpe Ratio", value: "0.91", detail: "Good risk-adjusted return" },
  { label: "Sortino Ratio", value: "1.24", detail: "Strong downside protection" },
  { label: "Max Drawdown", value: "-19.4%", detail: "Stress-tested 1Y horizon" },
  { label: "VaR (95%)", value: "-11.2%", detail: "Monthly 5th percentile" },
  { label: "CVaR (95%)", value: "-16.8%", detail: "Expected tail loss" },
];

const IN_DEMO_FRAGILITY = [
  { label: "L1 Concentration", pct: 68, color: "#f97316" },
  { label: "SOL-USD Single-Name Weight", pct: 52, color: "#fbbf24" },
  { label: "L1 Narrative Exposure", pct: 44, color: "#fbbf24" },
  { label: "Correlation Cluster Size", pct: 38, color: "#22c55e" },
];

const IN_DEMO_CORRELATIONS: [string, string, string][] = [
  ["BTC-USD", "SOL-USD", "0.84"], ["SOL-USD", "ADA-USD", "0.78"], ["BTC-USD", "ADA-USD", "0.72"], ["ETH-USD", "BNB-USD", "0.76"],
];

const IN_DEMO_RETURN_DIST = [
  { p: "P2.5", ret: -27.4 }, { p: "P10", ret: -11.6 }, { p: "P25", ret: -2.4 },
  { p: "P50", ret: 8.4 }, { p: "P75", ret: 18.2 }, { p: "P90", ret: 26.1 }, { p: "P97.5", ret: 36.8 },
];

// ─── Region config helpers ─────────────────────────────────────────────────────

interface DemoConfig {
  holdings: typeof US_DEMO_HOLDINGS;
  allocation: typeof US_DEMO_ALLOCATION;
  healthDimensions: typeof US_DEMO_HEALTH_DIMENSIONS;
  monteCarlo: typeof US_DEMO_MONTE_CARLO;
  regimeForecast: typeof US_DEMO_REGIME_FORECAST;
  benchmark: typeof US_DEMO_BENCHMARK;
  equityCurve: typeof US_DEMO_EQUITY_CURVE;
  aiInsights: typeof US_DEMO_AI_INSIGHTS;
  riskMetrics: typeof US_DEMO_RISK_METRICS;
  fragility: typeof US_DEMO_FRAGILITY;
  correlations: [string, string, string][];
  returnDist: typeof US_DEMO_RETURN_DIST;
  currencySymbol: string;
  locale: string;
  benchmarkLabel: string;
  healthScore: number;
  healthTone: string;
  healthDesc: string;
  portfolioLabel: string;
  fragilityScore: number;
  fragilityDesc: string;
}

function getDemoConfig(region: string): DemoConfig {
  if (region === "IN") {
    return {
      holdings: IN_DEMO_HOLDINGS,
      allocation: IN_DEMO_ALLOCATION,
      healthDimensions: IN_DEMO_HEALTH_DIMENSIONS,
      monteCarlo: IN_DEMO_MONTE_CARLO,
      regimeForecast: IN_DEMO_REGIME_FORECAST,
      benchmark: IN_DEMO_BENCHMARK,
      equityCurve: IN_DEMO_EQUITY_CURVE,
      aiInsights: IN_DEMO_AI_INSIGHTS,
      riskMetrics: IN_DEMO_RISK_METRICS,
      fragility: IN_DEMO_FRAGILITY,
      correlations: IN_DEMO_CORRELATIONS,
      returnDist: IN_DEMO_RETURN_DIST,
      currencySymbol: "₹",
      locale: "en-IN",
      benchmarkLabel: "Bitcoin (BTC-USD)",
      healthScore: 74,
      healthTone: "Balanced",
      healthDesc: "Strong blue-chip core with moderate L1 concentration. Payments hedge improves risk-adjusted return.",
      portfolioLabel: "Sample IN portfolio · 8 holdings",
      fragilityScore: 71,
      fragilityDesc: "Low-moderate tail risk — L1 cluster is the primary fragility driver.",
    };
  }
  return {
    holdings: US_DEMO_HOLDINGS,
    allocation: US_DEMO_ALLOCATION,
    healthDimensions: US_DEMO_HEALTH_DIMENSIONS,
    monteCarlo: US_DEMO_MONTE_CARLO,
    regimeForecast: US_DEMO_REGIME_FORECAST,
    benchmark: US_DEMO_BENCHMARK,
    equityCurve: US_DEMO_EQUITY_CURVE,
    aiInsights: US_DEMO_AI_INSIGHTS,
    riskMetrics: US_DEMO_RISK_METRICS,
    fragility: US_DEMO_FRAGILITY,
    correlations: US_DEMO_CORRELATIONS,
    returnDist: US_DEMO_RETURN_DIST,
    currencySymbol: "$",
    locale: "en-US",
    benchmarkLabel: "Bitcoin (BTC-USD)",
    healthScore: 72,
    healthTone: "Balanced",
    healthDesc: "Solid fundamentals, elevated concentration in Layer 1 sector warrants attention.",
    portfolioLabel: "Sample US portfolio · 8 holdings",
    fragilityScore: 67,
    fragilityDesc: "Moderate tail risk — L1 sector concentration is the primary fragility driver.",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = size * 0.37;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#fbbf24" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={size * 0.07} className="text-muted/20" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.07}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="transition-all duration-1000" />
    </svg>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Panel Content ─────────────────────────────────────────────────────────────

function DemoPanelContent({ onClose, region }: { onClose: () => void; region: string }) {
  const [activeTab, setActiveTab] = useState<"overview" | "holdings" | "risk">("overview");
  const cfg = getDemoConfig(region);

  const totalValue = cfg.holdings.reduce((s, h) => s + h.qty * h.price, 0);
  const totalCost = cfg.holdings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
  const totalPnl = totalValue - totalCost;
  const pnlPct = (totalPnl / totalCost) * 100;
  const dayChange = cfg.holdings.reduce((s, h) => s + h.qty * h.price * (h.changePercent / 100), 0);

  const fmt = (v: number) => cfg.currencySymbol + v.toLocaleString(cfg.locale, { maximumFractionDigits: 0 });
  const fmtSmall = (v: number) => cfg.currencySymbol + v.toFixed(2);

  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Portfolio Intelligence</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Demo
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:block">· {cfg.portfolioLabel}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl border border-white/10 bg-card/60 hover:bg-card/80 hover:border-primary/30 transition-all"
          aria-label="Close demo"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-5 py-5 space-y-5">

          {/* KPI Strip */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Portfolio Value", value: fmt(totalValue), sub: `+${fmt(totalPnl)} unrealised`, icon: TrendingUp, color: "text-emerald-400", accent: "border-emerald-500/20 bg-emerald-500/5" },
              { label: "Total Return", value: `+${pnlPct.toFixed(1)}%`, sub: `${fmt(totalCost)} invested`, icon: ArrowUpRight, color: "text-emerald-400", accent: "border-emerald-500/20 bg-emerald-500/5" },
              { label: "Day Change", value: `+${fmt(dayChange)}`, sub: "+0.71% today", icon: Activity, color: "text-blue-400", accent: "border-blue-500/20 bg-blue-500/5" },
              { label: "Health Score", value: `${cfg.healthScore}/100`, sub: `${cfg.healthTone} · 6 dimensions`, icon: ShieldCheck, color: "text-amber-400", accent: "border-amber-500/20 bg-amber-500/5" },
            ].map(({ label, value, sub, icon: Icon, color, accent }) => (
              <div key={label} className={cn("rounded-2xl border p-3.5 backdrop-blur-xl", accent)}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                </div>
                <p className={cn("text-lg font-bold tracking-tight", color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </motion.div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/20 border border-border/40 w-fit">
            {(["overview", "holdings", "risk"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn("px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-all duration-200",
                  activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/40")}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Health */}
                <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                  <SectionHeader icon={ShieldCheck} title="Portfolio Health" sub="6-dimension AI analysis" />
                  <div className="flex items-center gap-5 mb-5">
                    <div className="relative shrink-0">
                      <ScoreRing score={cfg.healthScore} size={88} />
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-2xl font-bold leading-none">{cfg.healthScore}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">score</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-400">{cfg.healthTone}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{cfg.healthDesc}</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {cfg.healthDimensions.map(({ label, score, color, desc }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
                          <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
                        </div>
                        <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                <div className="lg:col-span-2 rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                  <SectionHeader icon={Sparkles} title="AI Intelligence" sub="Portfolio-specific diagnostics" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cfg.aiInsights.map(({ icon: Icon, color, bg, title, body }) => (
                      <div key={title} className={cn("rounded-2xl border p-4 space-y-2", bg)}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4 shrink-0", color)} />
                          <p className="text-xs font-bold text-foreground">{title}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Allocation */}
                <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                  <SectionHeader icon={PieIcon} title="Sector Allocation" />
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={cfg.allocation} dataKey="percent" nameKey="label" cx="50%" cy="50%" innerRadius={38} outerRadius={60} stroke="none" paddingAngle={3}>
                          {cfg.allocation.map(({ color }, i) => <Cell key={i} fill={color} />)}
                        </Pie>
                        <RechartsTooltip formatter={(v) => [`${v ?? 0}%`]} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {cfg.allocation.map(({ label, percent, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} /><span className="text-[11px] text-muted-foreground">{label}</span></div>
                        <span className="text-[11px] font-bold text-foreground">{percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Equity Curve */}
                <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                  <SectionHeader icon={LineChart} title="Equity Curve" sub="6-month portfolio value" />
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cfg.equityCurve}>
                        <defs>
                          <linearGradient id="demoEquityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                        <YAxis tickFormatter={(v) => region === "IN" ? `₹${(v / 100000).toFixed(1)}L` : `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                        <RechartsTooltip formatter={(v) => [fmt(Number(v ?? 0))]} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#demoEquityGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Benchmark */}
                <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                  <SectionHeader icon={BarChart3} title={`vs ${cfg.benchmarkLabel}`} sub="Monthly return comparison" />
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cfg.benchmark} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                        <RechartsTooltip formatter={(v, name) => [`${v ?? 0}%`, name === "portfolio" ? "Portfolio" : cfg.benchmarkLabel]} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="portfolio" fill="#3b82f6" radius={[3, 3, 0, 0]} name="portfolio" />
                        <Bar dataKey="benchmark" fill="#94a3b8" radius={[3, 3, 0, 0]} name="benchmark" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-500" /><span className="text-[10px] text-muted-foreground">Portfolio</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-400" /><span className="text-[10px] text-muted-foreground">{cfg.benchmarkLabel}</span></div>
                  </div>
                </div>
              </div>

              {/* Monte Carlo */}
              <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                <SectionHeader icon={Cpu} title="Monte Carlo Simulation" sub={`${cfg.monteCarlo.pathCount.toLocaleString()} paths · 1-year horizon`} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Expected Return", value: `+${cfg.monteCarlo.expectedReturn}%`, color: "text-emerald-400" },
                    { label: "VaR (95%)", value: `${cfg.monteCarlo.var95}%`, color: "text-amber-400" },
                    { label: "CVaR (95%)", value: `${cfg.monteCarlo.cvar95}%`, color: "text-rose-400" },
                    { label: "Sharpe Ratio", value: String(cfg.monteCarlo.sharpeRatio), color: "text-blue-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl bg-muted/10 border border-white/5 p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1">{label}</p>
                      <p className={cn("text-xl font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {cfg.monteCarlo.scenarios.map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-muted/10 p-3 border border-white/5">
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1">{label}</p>
                      <p className="text-sm font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Regime Probability Forecast</p>
                <div className="space-y-2">
                  {cfg.regimeForecast.map(({ label, pct, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold w-20 shrink-0" style={{ color }}>{label}</span>
                      <div className="flex-1 h-2.5 bg-muted/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right text-foreground">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── HOLDINGS ── */}
          {activeTab === "holdings" && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                <SectionHeader icon={TrendingUp} title="Holdings" sub={`${cfg.holdings.length} positions · ${region} market`} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/8">
                        {["Asset", "Shares", "Avg Cost", "Current", "Value", "P&L", "Day", "Weight"].map((h) => (
                          <th key={h} className={cn("py-2 font-bold uppercase tracking-widest text-[9px] text-muted-foreground", h === "Asset" ? "text-left" : "text-right")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cfg.holdings.map((h) => {
                        const val = h.qty * h.price;
                        const pnl = val - h.qty * h.avgPrice;
                        const pnlPctH = (pnl / (h.qty * h.avgPrice)) * 100;
                        const isUp = pnl >= 0;
                        const dayUp = h.changePercent >= 0;
                        return (
                          <tr key={h.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{h.symbol.slice(0, 2)}</div>
                                <div><p className="font-bold text-foreground">{h.symbol}</p><p className="text-[10px] text-muted-foreground">{h.sector}</p></div>
                              </div>
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground">{h.qty}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{fmtSmall(h.avgPrice)}</td>
                            <td className="py-2.5 text-right font-medium text-foreground">{fmtSmall(h.price)}</td>
                            <td className="py-2.5 text-right font-bold text-foreground">{fmt(val)}</td>
                            <td className="py-2.5 text-right">
                              <span className={cn("flex items-center justify-end gap-0.5 font-bold", isUp ? "text-emerald-400" : "text-rose-400")}>
                                {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {pnlPctH >= 0 ? "+" : ""}{pnlPctH.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right"><span className={cn("text-[10px] font-bold", dayUp ? "text-emerald-400" : "text-rose-400")}>{dayUp ? "+" : ""}{h.changePercent.toFixed(2)}%</span></td>
                            <td className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="h-1.5 w-10 bg-muted/20 rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full" style={{ width: `${h.weight}%` }} /></div>
                                <span className="text-muted-foreground">{h.weight}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-emerald-400" /><h3 className="text-sm font-bold text-foreground">Top Gainers</h3></div>
                  <div className="space-y-2">
                    {[...cfg.holdings].sort((a, b) => ((b.price - b.avgPrice) / b.avgPrice) - ((a.price - a.avgPrice) / a.avgPrice)).slice(0, 4).map((h) => {
                      const p = ((h.price - h.avgPrice) / h.avgPrice) * 100;
                      return <div key={h.symbol} className="flex items-center justify-between"><span className="text-xs font-bold text-foreground">{h.symbol}</span><span className="text-xs font-bold text-emerald-400">+{p.toFixed(1)}%</span></div>;
                    })}
                  </div>
                </div>
                <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
                  <div className="flex items-center gap-2 mb-3"><TrendingDown className="h-4 w-4 text-rose-400" /><h3 className="text-sm font-bold text-foreground">Underperformers</h3></div>
                  <div className="space-y-2">
                    {[...cfg.holdings].sort((a, b) => ((a.price - a.avgPrice) / a.avgPrice) - ((b.price - b.avgPrice) / b.avgPrice)).slice(0, 4).map((h) => {
                      const p = ((h.price - h.avgPrice) / h.avgPrice) * 100;
                      return <div key={h.symbol} className="flex items-center justify-between"><span className="text-xs font-bold text-foreground">{h.symbol}</span><span className={cn("text-xs font-bold", p >= 0 ? "text-emerald-400" : "text-rose-400")}>{p >= 0 ? "+" : ""}{p.toFixed(1)}%</span></div>;
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── RISK ── */}
          {activeTab === "risk" && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cfg.riskMetrics.map(({ label, value, detail }) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-card/60 backdrop-blur-xl p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                    <p className="text-xl font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-amber-400" /><h3 className="text-sm font-bold text-foreground">Fragility Analysis</h3><span className="ml-auto text-xs font-bold text-amber-400">Score: {cfg.fragilityScore}/100</span></div>
                <p className="text-[11px] text-muted-foreground mb-3">{cfg.fragilityDesc}</p>
                <div className="space-y-2.5">
                  {cfg.fragility.map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-muted-foreground font-medium">{label}</span><span className="text-[10px] font-bold" style={{ color }}>{pct}%</span></div>
                      <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/8 bg-card/60 backdrop-blur-xl p-5">
                <SectionHeader icon={GitBranch} title="Return Distribution" sub="Monte Carlo 1Y percentile outcomes" />
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={cfg.returnDist}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="p" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                      <RechartsTooltip formatter={(v) => [`${v ?? 0}%`, "Return"]} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="ret" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
                <div className="flex items-center gap-2 mb-3"><Info className="h-4 w-4 text-rose-400" /><h3 className="text-sm font-bold text-foreground">Correlation Warning</h3></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {cfg.correlations.map(([a, b, corr]) => (
                    <div key={`${a}-${b}`} className="rounded-xl bg-rose-500/8 border border-rose-500/15 p-3 text-center">
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1">{a} ↔ {b}</p>
                      <p className="text-sm font-bold text-rose-400">ρ = {corr}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* CTA */}
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-bold text-foreground">Build your real portfolio</p></div>
              <p className="text-[11px] text-muted-foreground max-w-md">Connect your {region === "IN" ? "Indian" : ""} holdings, run portfolio health diagnostics, Monte Carlo simulations, and get AI-generated rebalance signals.</p>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={onClose}>
              Start building
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Exported Overlay ─────────────────────────────────────────────────────────

export function DemoPortfolioOverlay({ open, onClose, region = "US" }: { open: boolean; onClose: () => void; region?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="demo-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="absolute inset-y-0 right-0 w-full max-w-5xl bg-background border-l border-white/10 shadow-2xl flex flex-col"
          >
            <DemoPanelContent onClose={onClose} region={region} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
