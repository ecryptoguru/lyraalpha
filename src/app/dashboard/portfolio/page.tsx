"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Plus,
  Briefcase,
  BriefcaseBusiness,
  RefreshCw,
  Trash2,
  BarChart3,
  Loader2,
  Sparkles,
  ArrowRight,
  FileText,
  Plug,
  FileUp,
  X,
  AlertTriangle,
  TrendingUp,
  Clock3,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { motion } from "framer-motion";
import * as Motion from "@/components/dashboard/motion-wrapper";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/metric-card";
import { useRegion } from "@/lib/context/RegionContext";
import { usePlan } from "@/hooks/use-plan";
import { usePortfolios, usePortfolio, usePortfolioMutations } from "@/hooks/use-portfolio";
import { usePortfolioHealth } from "@/hooks/use-portfolio-health";
import { PortfolioHealthMeter } from "@/components/portfolio/portfolio-health-meter";
import { PortfolioFragilityCard } from "@/components/portfolio/portfolio-fragility-card";
import { BenchmarkComparisonCard } from "@/components/portfolio/benchmark-comparison-card";
import { PortfolioMonteCarloCard } from "@/components/portfolio/portfolio-monte-carlo-card";
import { PortfolioDecisionMemoCard } from "@/components/portfolio/portfolio-decision-memo-card";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";
import { AddHoldingDialog } from "@/components/portfolio/add-holding-dialog";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";
import { CsvImportDialog } from "@/components/portfolio/csv-import-dialog";
import { PdfImportDialog } from "@/components/portfolio/pdf-import-dialog";
import { BrokerConnectDialog } from "@/components/portfolio/broker-connect-dialog";
import { DemoPortfolioOverlay } from "@/components/portfolio/demo-portfolio-panel";
import { toast } from "sonner";
import type { PortfolioSummary } from "@/hooks/use-portfolio";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { PageHeader, StatChip, PageTabBar } from "@/components/dashboard/page-header";
import { buildPortfolioAlertSummary } from "@/lib/portfolio-alerts";
import { buildPortfolioShareObject } from "@/lib/intelligence-share";
import { PortfolioIntelligenceHero } from "@/components/portfolio/portfolio-intelligence-hero";
import { buildPortfolioIntelligence } from "@/lib/engines/portfolio-intelligence";
import type { MCSimulationResult } from "@/lib/engines/portfolio-monte-carlo";
import { PortfolioRegimeAlignmentBar } from "@/components/portfolio/portfolio-regime-alignment-bar";
import { PortfolioDrawdownEstimate } from "@/components/portfolio/portfolio-drawdown-estimate";
import { BriefcaseBusiness as _BriefcaseBusiness, Shield as _Shield } from "lucide-react";

const StressTestPage = dynamic(
  () => import("@/app/dashboard/stress-test/page"),
  { ssr: false, loading: () => <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-24 rounded-3xl bg-muted/20 animate-pulse" />)}</div> },
);

const PORTFOLIO_TABS = [
  { key: "portfolio",  label: "Portfolio",   icon: <_BriefcaseBusiness className="h-3.5 w-3.5" /> },
  { key: "shock-test", label: "Shock Test",  icon: <_Shield className="h-3.5 w-3.5" /> },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRegionConfig(region: "US" | "IN") {
  return region === "IN"
    ? { currency: "INR", currencySymbol: "₹", locale: "en-IN", benchmarkLabel: "Bitcoin (BTC-USD)" }
    : { currency: "USD", currencySymbol: "$", locale: "en-US", benchmarkLabel: "Bitcoin (BTC-USD)" };
}

function formatCurrency(value: number, symbol: string, locale: string): string {
  return symbol + new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────────────

function DeletePortfolioDialog({
  portfolioName,
  holdingCount,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  portfolioName: string;
  holdingCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/8 bg-card shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-danger" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Delete portfolio?</h2>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-bold text-foreground">&ldquo;{portfolioName}&rdquo;</span> and all{" "}
              {holdingCount > 0 ? (
                <span className="font-bold text-danger">{holdingCount} holding{holdingCount !== 1 ? "s" : ""}</span>
              ) : (
                "its holdings"
              )}{" "}
              will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1 text-sm h-9" disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 text-sm h-9 bg-danger hover:bg-danger text-danger-foreground border-0"
          >
            {isDeleting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Deleting…</>
            ) : (
              <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete</>  
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Portfolio Selector ──────────────────────────────────────────────────────

function PortfolioSelector({
  portfolios,
  selectedId,
  onSelect,
  onNew,
  onDelete,
  isLoading,
}: {
  portfolios: PortfolioSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (p: PortfolioSummary) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-10 w-36 rounded-2xl bg-muted/20 animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {portfolios.map((p) => (
        <div
          key={p.id}
          className={cn(
            "group relative flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-medium transition-all duration-200 shrink-0",
            selectedId === p.id
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-white/5 bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-2 min-w-0"
          >
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[100px]">{p.name}</span>
            <span className="text-[10px] opacity-60">{p._count.holdings}</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(p); }}
            className={cn(
              "h-4 w-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
              selectedId === p.id ? "text-primary/60 hover:text-danger" : "text-muted-foreground/60 hover:text-danger",
            )}
            title={`Delete ${p.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-2xl border border-dashed border-white/5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200 shrink-0"
      >
        <Plus className="h-3 w-3" />
        New
      </button>
    </div>
  );
}

// ─── Portfolio Summary Metrics ───────────────────────────────────────────────

function PortfolioMetrics({
  holdings,
  currencySymbol,
  locale,
}: {
  holdings: NonNullable<ReturnType<typeof usePortfolio>["portfolio"]>["holdings"];
  currencySymbol: string;
  locale: string;
}) {
  const metrics = useMemo(() => {
    if (holdings.length === 0) return null;

    let totalValue = 0;
    let totalCost = 0;
    let dayChangeValue = 0;

    for (const h of holdings) {
      const price = h.asset.price;
      const cost = h.quantity * h.avgPrice;
      totalCost += cost;
      if (price !== null) {
        const val = h.quantity * price;
        totalValue += val;
        if (h.asset.changePercent !== null) {
          dayChangeValue += val * (h.asset.changePercent / 100);
        }
      }
    }

    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const dayChangePct = totalValue > 0 ? (dayChangeValue / totalValue) * 100 : 0;

    return { totalValue, totalCost, totalPnl, totalPnlPct, dayChangeValue, dayChangePct };
  }, [holdings]);

  if (!metrics) return null;

  return (
    <Motion.Container className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Motion.Item>
        <MetricCard
          label="Total Value"
          value={formatCurrency(metrics.totalValue, currencySymbol, locale)}
          trend={metrics.totalPnlPct}
          trendLabel="total return"
          className="shadow-2xl shadow-primary/5"
        />
      </Motion.Item>
      <Motion.Item>
        <MetricCard
          label="Total P&L"
          value={formatCurrency(Math.abs(metrics.totalPnl), currencySymbol, locale)}
          trend={metrics.totalPnlPct}
          trendLabel="vs cost basis"
          className="shadow-2xl shadow-primary/5"
        />
      </Motion.Item>
      <Motion.Item>
        <MetricCard
          label="Day Change"
          value={formatCurrency(Math.abs(metrics.dayChangeValue), currencySymbol, locale)}
          trend={metrics.dayChangePct}
          trendLabel="today"
          className="shadow-2xl shadow-primary/5"
        />
      </Motion.Item>
      <Motion.Item>
        <MetricCard
          label="Holdings"
          value={String(holdings.length)}
          trend={0}
          trendLabel="assets tracked"
          className="shadow-2xl shadow-primary/5"
        />
      </Motion.Item>
    </Motion.Container>
  );
}

// ─── AI Insights & Allocation Donut ─────────────────────────────────────────

function AIInsightsContainer({
  holdings,
}: {
  holdings: NonNullable<ReturnType<typeof usePortfolio>["portfolio"]>["holdings"];
}) {
  const insights = useMemo(() => {
    if (holdings.length === 0) return [];
    
    const lines: Array<{ text: string, type: 'positive' | 'warning' | 'neutral' }> = [];
    
    let topPnl = -Infinity;
    let topAsset = null;
    let totalValue = 0;
    const categoryExposure: Record<string, number> = {};
    
    for (const h of holdings) {
      if (h.asset.price) {
        const val = h.quantity * h.asset.price;
        const cost = h.quantity * h.avgPrice;
        const pnl = cost > 0 ? ((val - cost) / cost) * 100 : 0;
        totalValue += val;
        
        if (pnl > topPnl && pnl > 5) {
          topPnl = pnl;
          topAsset = h.asset.symbol;
        }
        
        const cat = h.asset.sector ?? h.asset.type;
        categoryExposure[cat] = (categoryExposure[cat] ?? 0) + val;
      }
    }
    
    if (topAsset) {
      lines.push({ text: `🔥 ${topAsset} is your top performer, up ${topPnl.toFixed(1)}%`, type: 'positive' });
    }
    
    if (totalValue > 0) {
      const entries = Object.entries(categoryExposure).map(([k, v]) => ({ label: k, pct: (v / totalValue) * 100 }));
      const topCat = entries.sort((a,b) => b.pct - a.pct)[0];
      if (topCat && topCat.pct > 40) {
        lines.push({ text: `⚠️ High exposure (${topCat.pct.toFixed(0)}%) to ${topCat.label}`, type: 'warning' });
      } else {
        lines.push({ text: `🛡️ Well-diversified allocation across sectors`, type: 'positive' });
      }
    }
    
    const strongSignals = holdings.filter(h => (h.asset.avgTrendScore ?? 0) >= 70);
    const weakSignals = holdings.filter(h => (h.asset.avgTrendScore ?? 0) < 40);
    
    if (strongSignals.length > 0) {
      lines.push({ text: `📈 ${strongSignals.length} asset${strongSignals.length > 1 ? 's' : ''} showing strong bullish trends`, type: 'positive' });
    } else if (weakSignals.length > 0) {
      lines.push({ text: `📉 ${weakSignals.length} asset${weakSignals.length > 1 ? 's' : ''} experiencing downtrends`, type: 'warning' });
    }

    return lines.slice(0, 3);
  }, [holdings]);

  if (insights.length === 0) return null;

  const insightIcon = (type: string) => {
    if (type === 'positive') return <TrendingUp className="h-3.5 w-3.5 text-success shrink-0" />;
    if (type === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />;
    return <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  };

  const cleanText = (text: string) => text.replace(/^[\p{Emoji}\s]+/u, '').trim();

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/8 bg-card/50 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl hover:border-primary/20 transition-all duration-500">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-xl bg-accent-cta/10 border border-accent-cta/20 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-accent-cta" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Quick Insights</h3>
      </div>
      <div className="flex flex-col gap-2.5 flex-1 justify-center">
        {insights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.35 }}
            className={cn(
              "px-3.5 py-3 border rounded-2xl flex items-start gap-2.5",
              insight.type === 'positive'
                ? "border-success/20 bg-success/5 text-success"
                : insight.type === 'warning'
                ? "border-warning/20 bg-warning/5 text-warning"
                : "border-border/8 bg-card/40 text-muted-foreground"
            )}
          >
            {insightIcon(insight.type)}
            <p className="text-xs font-semibold leading-relaxed">{cleanText(insight.text)}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AllocationDonut({
  holdings,
}: {
  holdings: NonNullable<ReturnType<typeof usePortfolio>["portfolio"]>["holdings"];
}) {
  const allocation = useMemo(() => {
    const groups: Record<string, number> = {};
    let total = 0;
    for (const h of holdings) {
      if (h.asset.price === null) continue;
      const val = h.quantity * h.asset.price;
      const key = h.asset.sector ?? h.asset.type;
      groups[key] = (groups[key] ?? 0) + val;
      total += val;
    }
    return Object.entries(groups)
      .map(([label, value]) => ({ label, value, percent: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.percent - a.percent)
      .filter((a) => a.percent > 0)
      .slice(0, 6);
  }, [holdings]);

  const HEX_COLORS = ["#fbbf24", "#38bdf8", "#34d399", "#fb923c", "#f87171", "#facc15"];
  const TW_BG_COLORS = ["bg-accent-cta", "bg-info", "bg-success", "bg-warning", "bg-danger", "bg-warning"];

  if (allocation.length === 0) return null;

  return (
    <div className="flex h-full flex-col space-y-4 rounded-3xl border border-white/8 bg-card/50 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl hover:border-primary/20 transition-all duration-500">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Allocation</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center flex-1">
        <div className="h-48 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allocation}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                stroke="none"
                paddingAngle={4}
                animationDuration={1500}
                animationBegin={200}
              >
                {allocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={HEX_COLORS[index % HEX_COLORS.length]} style={{ filter: `drop-shadow(0 0 4px ${HEX_COLORS[index % HEX_COLORS.length]}60)` }} />
                ))}
              </Pie>
              <RechartsTooltip 
                formatter={(value: number | string | undefined, name: string | undefined, props: { payload?: { percent?: number } }) => [`${props.payload?.percent?.toFixed(1) ?? '0.0'}%`, name]}
                contentStyle={{ backgroundColor: 'rgb(24 24 27 / 0.9)', border: '1px solid rgb(255 255 255 / 0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Inner Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assets</span>
            <span className="text-2xl font-bold text-foreground">{holdings.length}</span>
          </div>
        </div>
        
        <div className="flex flex-col justify-center gap-3 pr-2">
          {allocation.map(({ label, percent }, i) => (
            <motion.div 
              key={label} 
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-center gap-2">
                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-sm", TW_BG_COLORS[i % TW_BG_COLORS.length])} style={{ boxShadow: `0 0 8px ${HEX_COLORS[i % HEX_COLORS.length]}80` }} />
                <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">{label}</span>
              </div>
              <span className="text-xs font-bold text-foreground">{percent.toFixed(1)}%</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyPortfolioState({ onNew, onDemo }: { onNew: () => void; onDemo: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-6 py-20 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="h-20 w-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary),0.12)]">
        <Briefcase className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Add your holdings</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
          Import or enter positions manually. Get a health score, risk breakdown, and Lyra analysis.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button onClick={onNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Create First Portfolio
        </Button>
        <Button
          variant="outline"
          onClick={onDemo}
          className="gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
        >
          <Sparkles className="h-4 w-4" />
          View Demo Portfolio
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground/60">Not sure what to expect? See a sample portfolio with full AI analysis first.</p>
    </motion.div>
  );
}

function formatHealthScore(score: number | null) {
  return score == null ? "—" : `${Math.round(score)}/100`;
}

function getPortfolioHealthTone(score: number | null) {
  if (score == null) return "Still building";
  if (score >= 75) return "Healthy";
  if (score >= 55) return "Balanced";
  if (score >= 40) return "Fragile";
  return "Under pressure";
}

function formatLastRefreshed(timestamp: number | null): string {
  if (!timestamp) return "Not refreshed yet";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Refreshed just now";
  if (diffMinutes < 60) return `Refreshed ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Refreshed ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Refreshed ${diffDays}d ago`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { region, mounted: regionMounted } = useRegion();
  const { plan } = usePlan();
  const regionConfig = getRegionConfig(region);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") === "shock-test" ? "shock-test" : "portfolio";

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "portfolio") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [showBrokerConnect, setShowBrokerConnect] = useState(false);
  const [isRefreshingPortfolio, setIsRefreshingPortfolio] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [simulationResult, setSimulationResult] = useState<MCSimulationResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const refreshInFlightRef = useRef(false);

  const { portfolios, isLoading: portfoliosLoading, mutate: mutatePortfolios } = usePortfolios(region);
  const activePortfolioId = selectedPortfolioId ?? portfolios[0]?.id ?? null;

  const { portfolio, isLoading: portfolioLoading, mutate: mutatePortfolio } = usePortfolio(activePortfolioId);
  const { snapshot, isLoading: healthLoading, mutate: mutateHealth } = usePortfolioHealth(activePortfolioId);

  const { createPortfolio, deletePortfolio, addHolding, removeHolding, updateHolding } = usePortfolioMutations();

  const handleRefreshPortfolio = useCallback(async () => {
    if (!activePortfolioId) return;
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setIsRefreshingPortfolio(true);
    try {
      const res = await fetch(`/api/portfolio/${activePortfolioId}/health?refresh=true`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
      }
      await Promise.all([
        mutatePortfolio(),
        mutateHealth(),
        mutatePortfolios(),
      ]);
      setRefreshSignal((value) => value + 1);
      setLastRefreshAt(Date.now());
      try {
        window.localStorage.setItem(`portfolio:auto-refresh:${activePortfolioId}`, String(Date.now()));
      } catch {
        // Ignore storage failures in privacy-restricted environments.
      }
      toast.success("Portfolio refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh portfolio");
    } finally {
      setIsRefreshingPortfolio(false);
      refreshInFlightRef.current = false;
    }
  }, [activePortfolioId, mutatePortfolio, mutateHealth, mutatePortfolios]);

  useEffect(() => {
    if (!activePortfolioId) return;

    const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000;
    const storageKey = `portfolio:auto-refresh:${activePortfolioId}`;

    try {
      const stored = Number(window.localStorage.getItem(storageKey) || 0);
      setLastRefreshAt(Number.isFinite(stored) && stored > 0 ? stored : null);
    } catch {
      setLastRefreshAt(null);
    }

    const runAutoRefresh = async () => {
      if (refreshInFlightRef.current) return;
      try {
        const last = Number(window.localStorage.getItem(storageKey) || 0);
        if (last > 0 && Date.now() - last < AUTO_REFRESH_MS) return;
      } catch {
        // Ignore storage failures and fall through to a single refresh attempt.
      }

      await handleRefreshPortfolio();
    };

    void runAutoRefresh();
    const timer = window.setInterval(() => {
      void runAutoRefresh();
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [activePortfolioId, handleRefreshPortfolio]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePortfolio(deleteTarget.id);
      if (selectedPortfolioId === deleteTarget.id) setSelectedPortfolioId(null);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  }

  const holdings = portfolio?.holdings ?? [];
  const hasPortfolios = portfolios.length > 0;
  const portfolioAlert = buildPortfolioAlertSummary(snapshot);
  const hasData = hasPortfolios && holdings.length > 0;
  const portfolioIntelligence = buildPortfolioIntelligence({
    healthScore: snapshot?.healthScore ?? null,
    diversificationScore: snapshot?.diversificationScore ?? null,
    concentrationScore: snapshot?.concentrationScore ?? null,
    volatilityScore: snapshot?.volatilityScore ?? null,
    correlationScore: snapshot?.correlationScore ?? null,
    qualityScore: snapshot?.qualityScore ?? null,
    fragilityScore: snapshot?.fragilityScore ?? null,
    riskMetrics: snapshot?.riskMetrics ?? null,
    holdings,
    simulation: simulationResult,
    currentMarketRegime: snapshot?.regime ?? null,
  });

  if (!regionMounted) return null;

  const summaryCards = [
    {
      label: "Portfolio score",
      value: hasData ? portfolioIntelligence.score.toFixed(1) : "—",
      detail: hasData ? portfolioIntelligence.band : "Add holdings to generate a score",
    },
    {
      label: "Health score",
      value: formatHealthScore(snapshot?.healthScore ?? null),
      detail: hasData ? `${getPortfolioHealthTone(snapshot?.healthScore ?? null)} · supporting signal` : "Computed after first holdings",
    },
    {
      label: "Monte Carlo",
      value: !hasData ? "—" : simulationResult ? `${simulationResult.expectedReturn >= 0 ? "+" : ""}${(simulationResult.expectedReturn * 100).toFixed(1)}%` : "Ready",
      detail: !hasData ? "Available once you have holdings" : simulationResult ? `${simulationResult.fragilityMean.toFixed(0)} fragility · ${simulationResult.pathCount.toLocaleString()} paths` : "Run to fold the simulation into the score",
    },
    {
      label: "Holdings",
      value: String(holdings.length),
      detail: holdings.length > 0 ? `${portfolio?.name ?? "Active portfolio"}` : "No holdings yet",
    },
  ];
  const portfolioShare = buildPortfolioShareObject({
    title: portfolioIntelligence.headline,
    takeaway: portfolioIntelligence.body,
    context: portfolioAlert?.missingInsight ?? portfolioIntelligence.nextAction,
    scoreValue: portfolioIntelligence.scoreValue,
    href: "/dashboard/portfolio",
  });
  void portfolioLoading;

  return (
    <SectionErrorBoundary>
      <div className="space-y-7 p-3 sm:p-4 md:p-6 pb-8 w-full min-w-0 overflow-x-hidden">
      <DemoPortfolioOverlay open={showDemo} onClose={() => setShowDemo(false)} region={region} />
      <PageHeader
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        title={activeTab === "shock-test" ? "Shock Simulator" : "Portfolio Intelligence"}
        eyebrow={activeTab === "shock-test" ? "Downside rehearsal" : "Risk, health, and decision support"}
        chips={
          activeTab === "portfolio" ? (
            <>
              {summaryCards?.slice(0, 2).map((c) => (
                <StatChip key={c.label} value={c.value} label={c.label} variant="gold" />
              ))}
              <StatChip value={region} label="Market" variant="muted" />
            </>
          ) : (
            <StatChip value={region} label="Market" variant="muted" />
          )
        }
        actions={
          activeTab === "portfolio" && portfolioShare
            ? <ShareInsightButton share={portfolioShare} label="Share" />
            : undefined
        }
      />
      <PageTabBar
        tabs={PORTFOLIO_TABS}
        active={activeTab}
        onChange={handleTabChange}
      />

      {activeTab === "shock-test" && (
        <Suspense fallback={
          <div className="rounded-3xl border border-white/10 bg-card/60 animate-pulse h-64 w-full" />
        }>
          <StressTestPage />
        </Suspense>
      )}

      {activeTab === "portfolio" && <div className="space-y-4 min-w-0">

      {/* Portfolio hero content */}
      <div className="space-y-4">
        {hasData ? (
          <PortfolioIntelligenceHero
            intelligence={portfolioIntelligence}
            supportNote={portfolioAlert?.missingInsight ?? portfolioAlert?.stressHeadline ?? null}
            marketLabel={`Crypto market · ${regionConfig.currencySymbol} ${regionConfig.currency}`}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
              {hasData && holdings.length > 0 && (
                <PortfolioDrawdownEstimate holdings={holdings} />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDemo(true)}
                className="text-xs h-8 gap-1.5 border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
              >
                <Sparkles className="h-3 w-3" />
                View Demo
              </Button>
              {hasPortfolios && activePortfolioId && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshPortfolio}
                    disabled={isRefreshingPortfolio || activePortfolioId == null}
                    className="text-xs h-8 gap-1.5"
                  >
                    {isRefreshingPortfolio ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Refresh Portfolio
                  </Button>
                  <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-card/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    <Clock3 className="h-3 w-3 text-muted-foreground/60" />
                    <span>{formatLastRefreshed(lastRefreshAt)}</span>
                  </div>
                </>
              )}
              <Button asChild size="sm" className="gap-2">
                <Link href="/dashboard/stress-test">
                  {portfolioAlert?.stressHeadline ?? "Open shock simulator"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/dashboard#market-intelligence">
                  Read market narratives
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <ShareInsightButton share={portfolioShare} label="Share report" />
        </div>
      </div>

      {hasPortfolios && activePortfolioId && (
        <div className="relative z-10 animate-slide-up-fade animation-delay-150">
          <PortfolioDecisionMemoCard
            portfolioId={activePortfolioId}
            portfolioName={portfolio?.name ?? "Portfolio"}
            portfolioScoreValue={portfolioIntelligence.scoreValue}
          />
        </div>
      )}

      <PortfolioSelector
        portfolios={portfolios}
        selectedId={activePortfolioId}
        onSelect={setSelectedPortfolioId}
        onNew={() => setShowCreateDialog(true)}
        onDelete={setDeleteTarget}
        isLoading={portfoliosLoading}
      />

      {/* Empty state */}
      {!portfoliosLoading && !hasPortfolios && (
        <EmptyPortfolioState onNew={() => setShowCreateDialog(true)} onDemo={() => setShowDemo(true)} />
      )}

      {/* Portfolio content */}
      {hasPortfolios && activePortfolioId && (
        <div className="space-y-4">
          {/* Empty holdings CTA */}
          {!portfolioLoading && holdings.length === 0 && (
            <motion.div
              className="rounded-3xl border border-dashed border-white/10 bg-card/30 p-10 flex flex-col items-center gap-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-16 w-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_24px_rgba(var(--primary),0.15)]">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">No holdings yet</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">Add a crypto asset to get a portfolio score, health diagnostics, and AI insights.</p>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2">
                <Button size="sm" onClick={() => setShowAddHolding(true)} className="gap-1.5 h-9">
                  <Plus className="h-3.5 w-3.5" />
                  Add Holding
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCsvImport(true)} className="gap-1.5 h-9">
                  <FileText className="h-3.5 w-3.5" />
                  Import CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPdfImport(true)} className="gap-1.5 h-9">
                  <FileUp className="h-3.5 w-3.5" />
                  Import PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowBrokerConnect(true)} className="gap-1.5 h-9">
                  <Plug className="h-3.5 w-3.5" />
                  Connect Broker
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50">CSV: symbol, quantity, avgPrice · PDF: exchange statements and wallet exports</p>
            </motion.div>
          )}

          {/* Metrics row */}
          {!portfolioLoading && holdings.length > 0 && (
            <PortfolioMetrics
              holdings={holdings}
              currencySymbol={regionConfig.currencySymbol}
              locale={regionConfig.locale}
            />
          )}

          {/* Benchmark comparison */}
          {!portfolioLoading && holdings.length > 0 && (
            <BenchmarkComparisonCard holdings={holdings} region={region} refreshSignal={refreshSignal} />
          )}

          {/* ── Analysis grid ─────────────────────────────────────────── */}
          {holdings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-2">Portfolio Analysis</span>
                <div className="h-px flex-1 bg-white/5" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddHolding(true)}
                  className="text-xs h-7 gap-1.5 shrink-0"
                >
                  <Plus className="h-3 w-3" />
                  Add Holding
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left column — health + fragility */}
                <div className="space-y-4">
                  <PortfolioHealthMeter
                    snapshot={snapshot}
                    isLoading={healthLoading}
                    plan={plan ?? "STARTER"}
                  />
                  <PortfolioFragilityCard
                    snapshot={snapshot}
                    isLoading={healthLoading}
                    plan={plan ?? "STARTER"}
                  />
                </div>

                {/* Right columns — allocation + insights + holdings */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AllocationDonut holdings={holdings} />
                    <AIInsightsContainer holdings={holdings} />
                  </div>
                  <PortfolioRegimeAlignmentBar holdings={holdings} />
                  <PortfolioHoldingsTable
                    holdings={holdings}
                    currencySymbol={regionConfig.currencySymbol}
                    locale={regionConfig.locale}
                    onRemove={async (hid) => {
                      await removeHolding(activePortfolioId, hid);
                      toast.success("Holding removed");
                    }}
                    onEdit={async (hid, body) => {
                      await updateHolding(activePortfolioId, hid, body);
                    }}
                    isLoading={portfolioLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Simulation ────────────────────────────────────────────── */}
          <div>
            {holdings.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-2">Risk Simulation</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            )}
            <PortfolioMonteCarloCard
              portfolioId={activePortfolioId}
              plan={plan ?? "STARTER"}
              onResult={setSimulationResult}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <p className="text-[10px] text-muted-foreground/50">
              {portfolio?.name} · {holdings.length} position{holdings.length !== 1 ? "s" : ""} · {region}
            </p>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {showCreateDialog && (
        <CreatePortfolioDialog
          region={region}
          onClose={() => setShowCreateDialog(false)}
          onCreate={async (body) => {
            const result = await createPortfolio(body);
            const newId = result?.data?.portfolio?.id ?? result?.portfolio?.id;
            if (newId) {
              // Seed the auto-refresh timestamp so the useEffect doesn't
              // immediately fire handleRefreshPortfolio() (which would show
              // a misleading "Portfolio refreshed" toast for a brand-new portfolio).
              try {
                window.localStorage.setItem(`portfolio:auto-refresh:${newId}`, String(Date.now()));
              } catch {
                // Ignore storage failures in privacy-restricted environments.
              }
              setSelectedPortfolioId(newId);
            }
          }}
        />
      )}

      {showAddHolding && activePortfolioId && portfolio && (
        <AddHoldingDialog
          portfolioId={activePortfolioId}
          region={portfolio.region}
          onAdd={addHolding}
          onClose={() => setShowAddHolding(false)}
        />
      )}

      {showCsvImport && activePortfolioId && portfolio && (
        <CsvImportDialog
          portfolioId={activePortfolioId}
          portfolioName={portfolio.name}
          region={portfolio.region}
          onAdd={addHolding}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {showPdfImport && activePortfolioId && portfolio && (
        <PdfImportDialog
          portfolioId={activePortfolioId}
          portfolioName={portfolio.name}
          region={portfolio.region}
          onClose={() => setShowPdfImport(false)}
          onSuccess={() => { void mutateHealth(); setShowPdfImport(false); }}
        />
      )}

      {showBrokerConnect && activePortfolioId && portfolio && (
        <BrokerConnectDialog
          portfolioId={activePortfolioId}
          portfolioName={portfolio.name}
          portfolioRegion={portfolio.region}
          onClose={() => setShowBrokerConnect(false)}
          onSuccess={() => { void mutateHealth(); setShowBrokerConnect(false); }}
        />
      )}

      {deleteTarget && (
        <DeletePortfolioDialog
          portfolioName={deleteTarget.name}
          holdingCount={deleteTarget._count.holdings}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      </div>}

      </div>
    </SectionErrorBoundary>
  );
}
