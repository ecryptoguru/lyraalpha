"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Cpu,
  ArrowRight,
  ArrowLeft,
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
import { motion } from "framer-motion";


// ─── US Demo Data ─────────────────────────────────────────────────────────────

const US_DEMO_HOLDINGS = [
  { symbol: "AAPL", name: "Apple Inc.", qty: 50, avgPrice: 155.0, price: 182.52, changePercent: 1.24, sector: "Technology", weight: 17.8 },
  { symbol: "MSFT", name: "Microsoft Corp.", qty: 30, avgPrice: 290.0, price: 378.85, changePercent: 0.87, sector: "Technology", weight: 22.2 },
  { symbol: "NVDA", name: "NVIDIA Corp.", qty: 20, avgPrice: 420.0, price: 875.40, changePercent: 2.31, sector: "Technology", weight: 34.1 },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", qty: 40, avgPrice: 440.0, price: 512.30, changePercent: 0.45, sector: "ETF", weight: 40.1 },
  { symbol: "GOOGL", name: "Alphabet Inc.", qty: 15, avgPrice: 130.0, price: 157.80, changePercent: -0.32, sector: "Technology", weight: 4.6 },
  { symbol: "JPM", name: "JPMorgan Chase", qty: 25, avgPrice: 175.0, price: 196.42, changePercent: 0.15, sector: "Financials", weight: 9.6 },
  { symbol: "JNJ", name: "Johnson & Johnson", qty: 20, avgPrice: 158.0, price: 152.30, changePercent: -0.44, sector: "Healthcare", weight: 5.9 },
  { symbol: "GLD", name: "SPDR Gold Shares", qty: 30, avgPrice: 185.0, price: 213.60, changePercent: 0.61, sector: "Commodity", weight: 12.5 },
  { symbol: "XOM", name: "Exxon Mobil", qty: 18, avgPrice: 108.0, price: 119.85, changePercent: -0.88, sector: "Energy", weight: 4.2 },
  { symbol: "BRK-B", name: "Berkshire Hathaway B", qty: 10, avgPrice: 330.0, price: 367.20, changePercent: 0.22, sector: "Financials", weight: 7.2 },
];

const US_DEMO_ALLOCATION = [
  { label: "Technology", percent: 46.4, color: "#3b82f6" },
  { label: "ETF", percent: 19.4, color: "#38bdf8" },
  { label: "Financials", percent: 10.3, color: "#22c55e" },
  { label: "Commodity", percent: 8.1, color: "#fbbf24" },
  { label: "Healthcare", percent: 7.9, color: "#a78bfa" },
  { label: "Energy", percent: 7.9, color: "#f97316" },
];

const US_DEMO_HEALTH_DIMENSIONS = [
  { label: "Diversification", score: 62, color: "#3b82f6", desc: "Moderate — 46% in single sector" },
  { label: "Concentration", score: 74, color: "#22c55e", desc: "Reasonable spread across 10 names" },
  { label: "Volatility Control", score: 71, color: "#fbbf24", desc: "Elevated — NVDA at 34% weight" },
  { label: "Correlation Risk", score: 58, color: "#f97316", desc: "High tech-sector correlation" },
  { label: "Quality & Trust", score: 81, color: "#22c55e", desc: "Strong fundamentals overall" },
  { label: "Fragility Score", score: 67, color: "#fbbf24", desc: "Moderate tail risk exposure" },
];

const US_DEMO_MONTE_CARLO = {
  expectedReturn: 6.21, var95: -12.4, cvar95: -18.7, maxDrawdown: -23.1, sharpeRatio: 0.84, pathCount: 5000,
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
  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", title: "Concentration alert", body: "NVDA now represents 34% of portfolio weight. A 20% drawdown in this single position would reduce total portfolio value by ~6.8%." },
  { icon: GitBranch, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20", title: "Sector correlation risk", body: "AAPL, MSFT, NVDA, and GOOGL are in the same narrative cluster. A tech sector rotation could trigger correlated drawdowns across 46% of the portfolio." },
  { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", title: "Hedge quality is strong", body: "GLD and JNJ provide meaningful negative correlation during risk-off regimes. This reduces fragility by an estimated 8 points vs an all-equity portfolio." },
  { icon: Target, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", title: "Next action", body: "Consider trimming NVDA below 25% and rotating proceeds into Healthcare or Industrials to reduce sector correlation without sacrificing expected return." },
];

const US_DEMO_RISK_METRICS = [
  { label: "Beta (vs SPY)", value: "1.24", detail: "More volatile than market" },
  { label: "Sharpe Ratio", value: "0.84", detail: "Moderate risk-adjusted return" },
  { label: "Sortino Ratio", value: "1.12", detail: "Good downside protection" },
  { label: "Max Drawdown", value: "-23.1%", detail: "Stress-tested 1Y horizon" },
  { label: "VaR (95%)", value: "-12.4%", detail: "Monthly 5th percentile" },
  { label: "CVaR (95%)", value: "-18.7%", detail: "Expected tail loss" },
];

const US_DEMO_FRAGILITY = [
  { label: "Tech Sector Concentration", pct: 79, color: "#ef4444" },
  { label: "NVDA Single-Name Weight", pct: 64, color: "#f97316" },
  { label: "AI-Thematic Exposure", pct: 55, color: "#fbbf24" },
  { label: "Correlation Cluster Size", pct: 46, color: "#fbbf24" },
];

const US_DEMO_CORRELATIONS: [string, string, string][] = [
  ["AAPL", "MSFT", "0.87"], ["MSFT", "NVDA", "0.79"], ["AAPL", "NVDA", "0.74"], ["MSFT", "GOOGL", "0.82"],
];

const US_DEMO_RETURN_DIST = [
  { p: "P2.5", ret: -31.2 }, { p: "P5", ret: -22.4 }, { p: "P10", ret: -14.8 },
  { p: "P25", ret: -3.1 }, { p: "P50", ret: 6.2 }, { p: "P75", ret: 16.8 },
  { p: "P90", ret: 22.1 }, { p: "P95", ret: 26.8 }, { p: "P97.5", ret: 31.4 },
];

// ─── IN Demo Data ─────────────────────────────────────────────────────────────

const IN_DEMO_HOLDINGS = [
  { symbol: "RELIANCE", name: "Reliance Industries", qty: 50, avgPrice: 2480.0, price: 2892.50, changePercent: 1.12, sector: "Energy", weight: 22.1 },
  { symbol: "TCS", name: "Tata Consultancy Services", qty: 30, avgPrice: 3550.0, price: 4120.75, changePercent: 0.64, sector: "Technology", weight: 18.9 },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", qty: 60, avgPrice: 1580.0, price: 1748.30, changePercent: -0.28, sector: "Financials", weight: 16.0 },
  { symbol: "INFY", name: "Infosys Ltd.", qty: 80, avgPrice: 1420.0, price: 1685.90, changePercent: 0.91, sector: "Technology", weight: 20.6 },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", qty: 70, avgPrice: 980.0, price: 1142.60, changePercent: 0.43, sector: "Financials", weight: 12.2 },
  { symbol: "WIPRO", name: "Wipro Ltd.", qty: 120, avgPrice: 440.0, price: 512.35, changePercent: -0.55, sector: "Technology", weight: 9.4 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", qty: 25, avgPrice: 2540.0, price: 2318.80, changePercent: -0.71, sector: "Consumer", weight: 8.8 },
  { symbol: "SBIN", name: "State Bank of India", qty: 100, avgPrice: 620.0, price: 748.45, changePercent: 1.34, sector: "Financials", weight: 11.4 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.", qty: 80, avgPrice: 680.0, price: 924.10, changePercent: 2.18, sector: "Auto", weight: 11.3 },
  { symbol: "GOLDBEES", name: "Nippon India Gold BeES", qty: 200, avgPrice: 52.0, price: 62.40, changePercent: 0.48, sector: "Commodity", weight: 19.0 },
];

const IN_DEMO_ALLOCATION = [
  { label: "Technology", percent: 38.5, color: "#3b82f6" },
  { label: "Financials", percent: 28.2, color: "#22c55e" },
  { label: "Energy", percent: 14.8, color: "#f97316" },
  { label: "Commodity", percent: 8.4, color: "#fbbf24" },
  { label: "Consumer", percent: 5.9, color: "#a78bfa" },
  { label: "Auto", percent: 4.2, color: "#38bdf8" },
];

const IN_DEMO_HEALTH_DIMENSIONS = [
  { label: "Diversification", score: 68, color: "#22c55e", desc: "Good spread — 6 sectors represented" },
  { label: "Concentration", score: 61, color: "#fbbf24", desc: "IT cluster at 38% warrants watch" },
  { label: "Volatility Control", score: 74, color: "#22c55e", desc: "Gold hedge reduces drawdown risk" },
  { label: "Correlation Risk", score: 63, color: "#fbbf24", desc: "IT names (TCS, Infy, Wipro) correlated" },
  { label: "Quality & Trust", score: 84, color: "#22c55e", desc: "Blue-chip Nifty 50 core holdings" },
  { label: "Fragility Score", score: 71, color: "#22c55e", desc: "Low-moderate tail risk exposure" },
];

const IN_DEMO_MONTE_CARLO = {
  expectedReturn: 8.40, var95: -11.2, cvar95: -16.8, maxDrawdown: -19.4, sharpeRatio: 0.91, pathCount: 5000,
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
  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", title: "IT sector clustering", body: "TCS, Infosys, and Wipro represent 38.5% combined weight in the same sector. A global IT spending slowdown could compress all three simultaneously." },
  { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", title: "Gold hedge working well", body: "GOLDBEES provides meaningful negative correlation during INR depreciation and global risk-off events, reducing portfolio fragility by ~9 points." },
  { icon: GitBranch, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20", title: "Banking exposure is diversified", body: "HDFCBANK, ICICIBANK, and SBIN span private and public-sector banks, reducing single-bank failure risk while maintaining Nifty 50 core alignment." },
  { icon: Target, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", title: "Next action", body: "Consider adding a mid-cap or pharma position (e.g. SUNPHARMA or DRREDDY) to reduce IT concentration and improve sector diversity score above 75." },
];

const IN_DEMO_RISK_METRICS = [
  { label: "Beta (vs Nifty)", value: "1.08", detail: "Slightly more volatile than index" },
  { label: "Sharpe Ratio", value: "0.91", detail: "Good risk-adjusted return" },
  { label: "Sortino Ratio", value: "1.24", detail: "Strong downside protection" },
  { label: "Max Drawdown", value: "-19.4%", detail: "Stress-tested 1Y horizon" },
  { label: "VaR (95%)", value: "-11.2%", detail: "Monthly 5th percentile" },
  { label: "CVaR (95%)", value: "-16.8%", detail: "Expected tail loss" },
];

const IN_DEMO_FRAGILITY = [
  { label: "IT Sector Concentration", pct: 68, color: "#f97316" },
  { label: "TCS Single-Name Weight", pct: 52, color: "#fbbf24" },
  { label: "Global IT Demand Exposure", pct: 44, color: "#fbbf24" },
  { label: "Correlation Cluster Size", pct: 38, color: "#22c55e" },
];

const IN_DEMO_CORRELATIONS: [string, string, string][] = [
  ["TCS", "INFY", "0.84"], ["INFY", "WIPRO", "0.78"], ["TCS", "WIPRO", "0.72"], ["HDFCBANK", "ICICIBANK", "0.76"],
];

const IN_DEMO_RETURN_DIST = [
  { p: "P2.5", ret: -27.4 }, { p: "P5", ret: -19.8 }, { p: "P10", ret: -11.6 },
  { p: "P25", ret: -2.4 }, { p: "P50", ret: 8.4 }, { p: "P75", ret: 18.2 },
  { p: "P90", ret: 26.1 }, { p: "P95", ret: 31.4 }, { p: "P97.5", ret: 36.8 },
];

// ─── Config helper ────────────────────────────────────────────────────────────

function getDemoConfig(region: "US" | "IN") {
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
      benchmarkLabel: "Nifty 50",
      healthScore: 74,
      healthTone: "Balanced",
      healthDesc: "Strong blue-chip core with moderate IT concentration. Gold hedge improves risk-adjusted return.",
      portfolioLabel: "Sample IN portfolio · 10 holdings",
      fragilityScore: 71,
      fragilityDesc: "Low-moderate tail risk — IT cluster is the primary fragility driver.",
      fragilitySummary: [
        { label: "Sector Fragility", value: "Moderate", detail: "38% in IT cluster", color: "text-amber-400" },
        { label: "Narrative Exposure", value: "Moderate", detail: "Global IT demand at ~38% weight", color: "text-amber-400" },
        { label: "Tail Risk", value: "Low-Moderate", detail: "Max drawdown est. -19.4%", color: "text-emerald-400" },
      ],
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
    benchmarkLabel: "S&P 500",
    healthScore: 72,
    healthTone: "Balanced",
    healthDesc: "Solid fundamentals, elevated concentration in Technology sector warrants attention.",
    portfolioLabel: "Sample US portfolio · 10 holdings",
    fragilityScore: 67,
    fragilityDesc: "Moderate tail risk — tech sector concentration is the primary fragility driver.",
    fragilitySummary: [
      { label: "Sector Fragility", value: "High", detail: "46% in Technology cluster", color: "text-rose-400" },
      { label: "Narrative Exposure", value: "Moderate", detail: "AI narrative at ~55% weight", color: "text-amber-400" },
      { label: "Tail Risk", value: "Moderate", detail: "Max drawdown est. -23.1%", color: "text-amber-400" },
    ],
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = size * 0.37;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#fbbf24" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={size * 0.07} className="text-white/10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.07}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="transition-all duration-1000" />
    </svg>
  );
}

function DemoTag() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/8 text-[10px] font-bold uppercase tracking-widest text-amber-300">
      <Sparkles className="h-3 w-3" />
      Demo
    </span>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-1.5 rounded-lg bg-amber-400/8 border border-amber-400/20">
        <Icon className="h-3.5 w-3.5 text-amber-300" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white/90">{title}</h3>
        {sub && <p className="text-[10px] text-white/45">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DemoPortfolioPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "holdings" | "risk">("overview");
  const [region, setRegion] = useState<"US" | "IN">("US");

  const cfg = getDemoConfig(region);
  const totalValue = cfg.holdings.reduce((s, h) => s + h.qty * h.price, 0);
  const totalCost = cfg.holdings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
  const totalPnl = totalValue - totalCost;
  const pnlPct = (totalPnl / totalCost) * 100;
  const dayChange = cfg.holdings.reduce((s, h) => s + h.qty * h.price * (h.changePercent / 100), 0);

  const fmt = (v: number) => cfg.currencySymbol + v.toLocaleString(cfg.locale, { maximumFractionDigits: 0 });
  const fmtSmall = (v: number) => cfg.currencySymbol + v.toFixed(2);

  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-dvh bg-[#040816] font-sans text-white/90 selection:bg-amber-300/30 overflow-x-hidden" suppressHydrationWarning>
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,158,11,0.07),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(20,184,166,0.05),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[80px_80px]" />
      </div>

      <Navbar />

      {/* ── Sub-header ── */}
      <div className="fixed left-0 right-0 top-[76px] sm:top-[88px] z-40 border-b border-white/10 bg-[#040816] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/tools"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/45 transition-all duration-200 hover:border-white/20 hover:bg-white/8 hover:text-white/75"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Tools
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="p-1.5 rounded-lg border border-amber-400/20 bg-amber-400/8">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Portfolio Intelligence</span>
              <DemoTag />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Region toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-white/10 bg-white/5">
              {(["US", "IN"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={cn(
                    "px-3 py-1 font-mono text-[11px] font-bold rounded-md transition-all duration-200",
                    region === r ? "bg-amber-400 text-slate-950 shadow-sm" : "text-white/45 hover:text-white"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] text-white/40 hidden sm:block">{cfg.portfolioLabel}</span>
            <Link
              href="/dashboard/portfolio"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400 px-4 py-1.5 font-mono text-[11px] font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all duration-300 hover:bg-amber-300"
            >
              Build yours
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-[148px] sm:pt-[160px] pb-20 space-y-6">

        {/* ── Hero KPI Strip ── */}
        <motion.div
          key={region}
          variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { label: "Portfolio Value", value: fmt(totalValue), sub: `+${fmt(totalPnl)} unrealised`, icon: TrendingUp, color: "text-emerald-400", accent: "border-emerald-500/20 bg-emerald-500/5" },
            { label: "Total Return", value: `+${pnlPct.toFixed(1)}%`, sub: `${fmt(totalCost)} invested`, icon: ArrowUpRight, color: "text-emerald-400", accent: "border-emerald-500/20 bg-emerald-500/5" },
            { label: "Day Change", value: `+${fmt(dayChange)}`, sub: "+0.71% today", icon: Activity, color: "text-blue-400", accent: "border-blue-500/20 bg-blue-500/5" },
            { label: "Health Score", value: `${cfg.healthScore}/100`, sub: `${cfg.healthTone} · 6 dimensions`, icon: ShieldCheck, color: "text-amber-400", accent: "border-amber-500/20 bg-amber-500/5" },
          ].map(({ label, value, sub, icon: Icon, color, accent }) => (
            <div key={label} className={cn("rounded-2xl border p-4 backdrop-blur-xl", accent)}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</p>
                <Icon className={cn("h-3.5 w-3.5", color)} />
              </div>
              <p className={cn("text-xl font-bold tracking-tight", color)}>{value}</p>
              <p className="text-[10px] text-white/45 mt-0.5">{sub}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {(["overview", "holdings", "risk"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-all duration-200",
                activeTab === tab ? "bg-amber-400 text-slate-950 shadow-sm" : "text-white/45 hover:text-white/90 hover:bg-white/10"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <motion.div key={`overview-${region}`} variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }} className="space-y-4">

            {/* Row 1: Health + AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Portfolio Health */}
              <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
                <SectionHeader icon={ShieldCheck} title="Portfolio Health" sub="6-dimension AI analysis" />
                <div className="flex items-center gap-5 mb-5">
                  <div className="relative shrink-0">
                    <ScoreRing score={cfg.healthScore} size={92} />
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-bold leading-none">{cfg.healthScore}</span>
                      <span className="text-[9px] text-white/45 uppercase tracking-widest mt-0.5">score</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-400">{cfg.healthTone}</p>
                    <p className="text-[11px] text-white/45 mt-1 leading-relaxed">{cfg.healthDesc}</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {cfg.healthDimensions.map(({ label, score, color, desc }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-white/45">{label}</span>
                        <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
                      </div>
                      <p className="text-[9px] text-white/45/60 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div className="lg:col-span-2 rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
                <SectionHeader icon={Sparkles} title="AI Intelligence" sub="Portfolio-specific diagnostics" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cfg.aiInsights.map(({ icon: Icon, color, bg, title, body }) => (
                    <div key={title} className={cn("rounded-2xl border p-4 space-y-2", bg)}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4 shrink-0", color)} />
                        <p className="text-xs font-bold text-white/90">{title}</p>
                      </div>
                      <p className="text-[11px] text-white/45 leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Allocation + Equity Curve + Benchmark */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Sector Allocation */}
              <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
                <SectionHeader icon={PieIcon} title="Sector Allocation" />
                <div className="flex flex-col items-center gap-4">
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={cfg.allocation} dataKey="percent" nameKey="label"
                          cx="50%" cy="50%" innerRadius={42} outerRadius={68}
                          stroke="none" paddingAngle={3}>
                          {cfg.allocation.map(({ color }, i) => <Cell key={i} fill={color} />)}
                        </Pie>
                        <RechartsTooltip
                          formatter={(v) => [`${v ?? 0}%`]}
                          contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-1.5">
                    {cfg.allocation.map(({ label, percent, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                          <span className="text-[11px] text-white/45">{label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
                          </div>
                          <span className="text-[11px] font-bold text-white/90 w-8 text-right">{percent}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Equity Curve */}
              <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
                <SectionHeader icon={LineChart} title="Equity Curve" sub="6-month portfolio value" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cfg.equityCurve}>
                      <defs>
                        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                      <YAxis
                        tickFormatter={(v) => region === "IN" ? `₹${(v / 100000).toFixed(1)}L` : `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
                      />
                      <RechartsTooltip
                        formatter={(v) => [fmt(Number(v ?? 0))]}
                        contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#equityGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Benchmark Comparison */}
              <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
                <SectionHeader icon={BarChart3} title={`vs ${cfg.benchmarkLabel}`} sub="Monthly return comparison" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cfg.benchmark} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                      <RechartsTooltip
                        formatter={(v, name) => [`${v ?? 0}%`, name === "portfolio" ? "Portfolio" : cfg.benchmarkLabel]}
                        contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                      />
                      <Bar dataKey="portfolio" fill="#3b82f6" radius={[3, 3, 0, 0]} name="portfolio" />
                      <Bar dataKey="benchmark" fill="#94a3b8" radius={[3, 3, 0, 0]} name="benchmark" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-500" /><span className="text-[10px] text-white/45">Portfolio</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-400" /><span className="text-[10px] text-white/45">{cfg.benchmarkLabel}</span></div>
                </div>
              </div>
            </div>

            {/* Row 3: Monte Carlo full width */}
            <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
              <SectionHeader icon={Cpu} title="Monte Carlo Simulation" sub={`${cfg.monteCarlo.pathCount.toLocaleString()} paths · 1-year horizon`} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Expected Return", value: `+${cfg.monteCarlo.expectedReturn}%`, color: "text-emerald-400" },
                  { label: "VaR (95%)", value: `${cfg.monteCarlo.var95}%`, color: "text-amber-400" },
                  { label: "CVaR (95%)", value: `${cfg.monteCarlo.cvar95}%`, color: "text-rose-400" },
                  { label: "Sharpe Ratio", value: String(cfg.monteCarlo.sharpeRatio), color: "text-blue-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-2xl bg-white/5 border border-white/5 p-3">
                    <p className="text-[9px] text-white/45 uppercase tracking-widest font-bold mb-1">{label}</p>
                    <p className={cn("text-xl font-bold", color)}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/45 mb-3">Scenario Outcomes</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                  {cfg.monteCarlo.scenarios.map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-white/5 p-3 border border-white/5">
                      <p className="text-[9px] text-white/45 font-bold uppercase tracking-widest mb-1">{label}</p>
                      <p className="text-sm font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/45 mb-2">Regime Probability Forecast</p>
                <div className="space-y-2">
                  {cfg.regimeForecast.map(({ label, pct, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold w-20 shrink-0" style={{ color }}>{label}</span>
                      <div className="flex-1 h-2.5 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right text-white/90">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ── HOLDINGS TAB ── */}
        {activeTab === "holdings" && (
          <motion.div key={`holdings-${region}`} variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }} className="space-y-4">
            <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
              <SectionHeader icon={TrendingUp} title="Holdings" sub={`${cfg.holdings.length} positions · ${region} market`} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      {["Asset", "Shares", "Avg Cost", "Current", "Value", "P&L", "Day", "Weight"].map((h) => (
                        <th key={h} className={cn("py-2 font-bold uppercase tracking-widest text-[9px] text-white/45", h === "Asset" ? "text-left" : "text-right")}>{h}</th>
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
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-xl bg-amber-400/8 border border-amber-400/20 flex items-center justify-center text-[10px] font-bold text-amber-300 shrink-0">
                                {h.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-bold text-white/90">{h.symbol}</p>
                                <p className="text-[10px] text-white/45">{h.sector}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right text-white/45">{h.qty}</td>
                          <td className="py-3 text-right text-white/45">{fmtSmall(h.avgPrice)}</td>
                          <td className="py-3 text-right font-medium text-white/90">{fmtSmall(h.price)}</td>
                          <td className="py-3 text-right font-bold text-white/90">{fmt(val)}</td>
                          <td className="py-3 text-right">
                            <div className={cn("flex items-center justify-end gap-1 font-bold", isUp ? "text-emerald-400" : "text-rose-400")}>
                              {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {pnlPctH >= 0 ? "+" : ""}{pnlPctH.toFixed(1)}%
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <span className={cn("text-[10px] font-bold", dayUp ? "text-emerald-400" : "text-rose-400")}>
                              {dayUp ? "+" : ""}{h.changePercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="h-1.5 w-12 bg-white/8 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400/60 rounded-full" style={{ width: `${h.weight}%` }} />
                              </div>
                              <span className="text-white/45">{h.weight}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top gainers / losers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white/90">Top Gainers</h3>
                </div>
                <div className="space-y-2">
                  {[...cfg.holdings].sort((a, b) => {
                    const pa = ((a.price - a.avgPrice) / a.avgPrice) * 100;
                    const pb = ((b.price - b.avgPrice) / b.avgPrice) * 100;
                    return pb - pa;
                  }).slice(0, 4).map((h) => {
                    const p = ((h.price - h.avgPrice) / h.avgPrice) * 100;
                    return (
                      <div key={h.symbol} className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/90">{h.symbol}</span>
                        <span className="text-xs font-bold text-emerald-400">+{p.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white/90">Underperformers</h3>
                </div>
                <div className="space-y-2">
                  {[...cfg.holdings].sort((a, b) => {
                    const pa = ((a.price - a.avgPrice) / a.avgPrice) * 100;
                    const pb = ((b.price - b.avgPrice) / b.avgPrice) * 100;
                    return pa - pb;
                  }).slice(0, 4).map((h) => {
                    const p = ((h.price - h.avgPrice) / h.avgPrice) * 100;
                    return (
                      <div key={h.symbol} className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/90">{h.symbol}</span>
                        <span className={cn("text-xs font-bold", p >= 0 ? "text-emerald-400" : "text-rose-400")}>{p >= 0 ? "+" : ""}{p.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── RISK TAB ── */}
        {activeTab === "risk" && (
          <motion.div key={`risk-${region}`} variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }} className="space-y-4">

            {/* Risk Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cfg.riskMetrics.map(({ label, value, detail }) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/45 mb-1">{label}</p>
                  <p className="text-xl font-bold text-white/90">{value}</p>
                  <p className="text-[10px] text-white/45 mt-1">{detail}</p>
                </div>
              ))}
            </div>

            {/* Fragility Analysis */}
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white/90">Fragility Analysis</h3>
                <span className="ml-auto text-xs font-bold text-amber-400">Fragility: {cfg.fragilityScore} / 100</span>
              </div>
              <p className="text-[11px] text-white/45 mb-4">{cfg.fragilityDesc}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {cfg.fragilitySummary.map(({ label, value, detail, color }) => (
                  <div key={label} className="rounded-xl bg-amber-500/8 border border-amber-500/15 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/45 mb-1">{label}</p>
                    <p className={cn("text-sm font-bold", color)}>{value}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {cfg.fragility.map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/45 font-medium">{label}</span>
                      <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk distribution chart */}
            <div className="rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
              <SectionHeader icon={GitBranch} title="Return Distribution" sub="Monte Carlo 1Y percentile outcomes" />
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={cfg.returnDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="p" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                    <RechartsTooltip
                      formatter={(v) => [`${v ?? 0}%`, "Return"]}
                      contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                    />
                    <Line type="monotone" dataKey="ret" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Correlation warning */}
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white/90">Correlation Warning</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {cfg.correlations.map(([a, b, corr]) => (
                  <div key={`${a}-${b}`} className="rounded-xl bg-rose-500/8 border border-rose-500/15 p-3 text-center">
                    <p className="text-[9px] text-white/45 font-bold uppercase tracking-widest mb-1">{a} ↔ {b}</p>
                    <p className="text-sm font-bold text-rose-400">ρ = {corr}</p>
                    <p className="text-[9px] text-white/45 mt-0.5">High correlation</p>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* ── CTA ── */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-bold text-white/90">Build your real portfolio</p>
            </div>
            <p className="text-[11px] text-white/45 max-w-md">
              Connect your {region === "IN" ? "Indian" : ""} holdings, run portfolio health diagnostics, Monte Carlo simulations, and get AI-generated rebalance signals — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/tools/ai-portfolio-analyzer" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 font-mono text-xs font-bold text-white/60 transition-all duration-200 hover:border-white/25 hover:text-white/85">
              Learn more
            </Link>
            <Link href={`/dashboard/portfolio?market=${region}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400 px-5 py-2 font-mono text-xs font-bold text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.25)] transition-all duration-200 hover:bg-amber-300">
              Open Portfolio
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
