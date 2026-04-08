"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Trash2, ChevronDown, ChevronUp, Pencil, Check, X as XIcon, LayoutList } from "lucide-react";
import { toast } from "sonner";
import type { PortfolioHolding } from "@/hooks/use-portfolio";

interface PortfolioHoldingsTableProps {
  holdings: PortfolioHolding[];
  currencySymbol: string;
  locale: string;
  onRemove: (holdingId: string) => Promise<void>;
  onEdit?: (holdingId: string, body: { quantity?: number; avgPrice?: number }) => Promise<void>;
  isLoading?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  STOCK:       "text-amber-400 bg-amber-400/10 border-amber-400/20",
  ETF:         "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  CRYPTO:      "text-sky-400 bg-sky-400/10 border-sky-400/20",
  COMMODITY:   "text-orange-400 bg-orange-400/10 border-orange-400/20",
  MUTUAL_FUND: "text-violet-400 bg-violet-400/10 border-violet-400/20",
};

const DSE_KEYS = ["avgTrendScore", "avgMomentumScore", "avgVolatilityScore", "avgLiquidityScore", "avgTrustScore", "avgSentimentScore"] as const;
const DSE_LABELS: Record<string, string> = {
  avgTrendScore:     "Trend",
  avgMomentumScore:  "Mom",
  avgVolatilityScore:"Vol",
  avgLiquidityScore: "Liq",
  avgTrustScore:     "Trust",
  avgSentimentScore: "Sent",
};

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function DseScorePip({ score, label }: { score: number | null; label: string }) {
  const { bg, text } =
    score === null           ? { bg: "bg-muted/20",          text: "text-muted-foreground/40" } :
    score >= 70              ? { bg: "bg-emerald-400/15",     text: "text-emerald-400" } :
    score >= 50              ? { bg: "bg-amber-400/15",       text: "text-amber-400" } :
    score >= 35              ? { bg: "bg-orange-400/15",      text: "text-orange-400" } :
                               { bg: "bg-red-400/15",         text: "text-red-400" };

  return (
    <div className={cn("flex flex-col items-center rounded-lg px-1.5 py-1 min-w-[34px]", bg)}>
      <span className={cn("text-[9px] font-bold uppercase tracking-wide", text)}>{label}</span>
      <span className={cn("text-[10px] font-bold tabular-nums leading-none", text)}>
        {score !== null ? score.toFixed(0) : "—"}
      </span>
    </div>
  );
}

function WeightBar({ weight, maxWeight }: { weight: number; maxWeight: number }) {
  const pct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
  const color =
    weight > 30 ? "bg-red-400" :
    weight > 20 ? "bg-orange-400" :
    weight > 10 ? "bg-amber-400" :
    "bg-emerald-400";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-8 text-right">
        {weight.toFixed(1)}%
      </span>
    </div>
  );
}

type SortKey = "symbol" | "value" | "pnl" | "weight";
type SortDir = "asc" | "desc";

function HoldingRow({
  holding,
  index,
  currencySymbol,
  locale,
  weight,
  maxWeight,
  onRemove,
  onEdit,
}: {
  holding: PortfolioHolding;
  index: number;
  currencySymbol: string;
  locale: string;
  weight: number;
  maxWeight: number;
  onRemove: (id: string) => Promise<void>;
  onEdit?: (id: string, body: { quantity?: number; avgPrice?: number }) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const currentPrice = holding.asset.price;
  const currentValue = currentPrice !== null ? holding.quantity * currentPrice : null;
  const costBasis = holding.quantity * holding.avgPrice;
  const pnl = currentValue !== null ? currentValue - costBasis : null;
  const pnlPct = pnl !== null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
  const changePercent = holding.asset.changePercent;

  async function handleRemove() {
    setRemoving(true);
    try { await onRemove(holding.id); } finally { setRemoving(false); }
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditQty(String(holding.quantity));
    setEditPrice(String(holding.avgPrice));
    setEditing(true);
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(false);
  }

  async function saveEdit(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onEdit) return;
    const qty = parseFloat(editQty);
    const price = parseFloat(editPrice);
    if (isNaN(qty) || qty <= 0) { toast.error("Invalid quantity"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Invalid price"); return; }
    setSaving(true);
    try {
      await onEdit(holding.id, { quantity: qty, avgPrice: price });
      setEditing(false);
      toast.success(`${holding.asset.symbol} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const pnlIsPositive = (pnl ?? 0) > 0;
  const pnlIsNegative = (pnl ?? 0) < 0;

  return (
    <>
      <motion.tr
        className={cn(
          "border-b border-white/5 transition-colors group",
          editing ? "bg-primary/5" : "cursor-pointer",
          !editing && pnlPct !== null && pnlPct >= 10  ? "bg-emerald-500/6 hover:bg-emerald-500/10" :
          !editing && pnlPct !== null && pnlPct >= 2   ? "bg-emerald-500/3 hover:bg-emerald-500/6" :
          !editing && pnlPct !== null && pnlPct <= -10 ? "bg-red-500/7 hover:bg-red-500/11" :
          !editing && pnlPct !== null && pnlPct <= -2  ? "bg-red-500/3 hover:bg-red-500/7" :
          !editing ? "hover:bg-white/2" : "",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        onClick={() => !editing && setExpanded(!expanded)}
      >
        {/* Symbol + Name */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-muted/20 border border-white/5 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-muted-foreground">
                {holding.asset.symbol.slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">{holding.asset.symbol}</p>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0", TYPE_COLORS[holding.asset.type] ?? "text-muted-foreground bg-muted/10 border-muted/20")}>
                  {holding.asset.type}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">{holding.asset.name}</p>
            </div>
          </div>
        </td>

        {/* Qty + Avg */}
        <td className="px-4 py-3.5 text-right">
          {editing ? (
            <div className="flex flex-col gap-1.5 items-end">
              <input
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Qty"
                className="w-24 text-right text-xs font-medium bg-background border border-white/15 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
              />
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Avg price"
                className="w-24 text-right text-xs font-medium bg-background border border-white/15 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {holding.quantity.toLocaleString(locale, { maximumFractionDigits: 4 })}
              </p>
              <p className="text-[10px] text-muted-foreground">@ {currencySymbol}{formatCurrency(holding.avgPrice, locale)}</p>
            </>
          )}
        </td>

        {/* Price + Day % */}
        <td className="px-4 py-3.5 text-right">
          {currentPrice !== null ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {currencySymbol}{formatCurrency(currentPrice, locale)}
              </p>
              {changePercent !== null && (
                <p className={cn(
                  "text-[10px] font-bold tabular-nums flex items-center justify-end gap-0.5",
                  changePercent > 0 ? "text-emerald-400" : changePercent < 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {changePercent > 0 ? <TrendingUp className="h-2.5 w-2.5" /> :
                   changePercent < 0 ? <TrendingDown className="h-2.5 w-2.5" /> :
                   <Minus className="h-2.5 w-2.5" />}
                  {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground/40">—</p>
          )}
        </td>

        {/* Value + P&L */}
        <td className="px-4 py-3.5 text-right">
          {currentValue !== null ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {currencySymbol}{formatCurrency(currentValue, locale)}
              </p>
              {pnl !== null && pnlPct !== null && (
                <p className={cn(
                  "text-[10px] font-bold tabular-nums",
                  pnlIsPositive ? "text-emerald-400" : pnlIsNegative ? "text-red-400" : "text-muted-foreground"
                )}>
                  {pnlIsPositive ? "+" : ""}{currencySymbol}{formatCurrency(Math.abs(pnl), locale)}
                  {" "}({pnlIsPositive ? "+" : ""}{pnlPct.toFixed(1)}%)
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground/40">—</p>
          )}
        </td>

        {/* Weight bar */}
        <td className="px-4 py-3.5">
          <WeightBar weight={weight} maxWeight={maxWeight} />
        </td>

        {/* Actions */}
        <td className="px-4 py-3.5">
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <button
                  type="button" onClick={saveEdit} disabled={saving}
                  className="h-7 w-7 rounded-xl flex items-center justify-center text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
                >
                  {saving ? <span className="h-3 w-3 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button" onClick={cancelEdit}
                  className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                {onEdit && (
                  <button
                    type="button" onClick={startEdit}
                    className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                  disabled={removing}
                  className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                >
                  {removing
                    ? <span className="h-3 w-3 border-2 border-muted/40 border-t-red-400 rounded-full animate-spin" />
                    : <Trash2 className="h-3 w-3" />
                  }
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/10 transition-colors"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </>
            )}
          </div>
        </td>
      </motion.tr>

      {/* Expanded DSE row */}
      {expanded && !editing && (
        <motion.tr
          className="border-b border-white/5 bg-muted/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {DSE_KEYS.map((k) => (
                <DseScorePip
                  key={k}
                  score={holding.asset[k] ?? null}
                  label={DSE_LABELS[k]}
                />
              ))}
              {holding.asset.compatibilityLabel && (
                <div className="flex flex-col items-center rounded-lg px-2 py-1 bg-primary/10 border border-primary/20 min-w-[50px]">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-primary">Compat</span>
                  <span className="text-[10px] font-bold text-primary leading-none">{holding.asset.compatibilityLabel}</span>
                </div>
              )}
              {holding.asset.sector && (
                <div className="flex flex-col items-center rounded-lg px-2 py-1 bg-muted/20 border border-white/5 min-w-[50px]">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Sector</span>
                  <span className="text-[10px] font-bold text-foreground leading-none truncate max-w-[80px]">{holding.asset.sector}</span>
                </div>
              )}
            </div>
          </td>
        </motion.tr>
      )}
    </>
  );
}

export function PortfolioHoldingsTable({
  holdings,
  currencySymbol,
  locale,
  onRemove,
  onEdit,
  isLoading,
}: PortfolioHoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const totalValue = useMemo(() => {
    return holdings.reduce((acc, h) => {
      if (h.asset.price !== null) return acc + h.quantity * h.asset.price;
      return acc;
    }, 0);
  }, [holdings]);

  const enriched = useMemo(() => {
    return holdings.map((h) => {
      const val = h.asset.price !== null ? h.quantity * h.asset.price : null;
      const cost = h.quantity * h.avgPrice;
      const pnl = val !== null ? val - cost : null;
      const weight = totalValue > 0 && val !== null ? (val / totalValue) * 100 : 0;
      return { ...h, val, cost, pnl, weight };
    });
  }, [holdings, totalValue]);

  const maxWeight = useMemo(() => Math.max(...enriched.map((h) => h.weight), 1), [enriched]);

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      let va = 0, vb = 0;
      if (sortKey === "symbol") return sortDir === "asc"
        ? a.asset.symbol.localeCompare(b.asset.symbol)
        : b.asset.symbol.localeCompare(a.asset.symbol);
      if (sortKey === "value") { va = a.val ?? -Infinity; vb = b.val ?? -Infinity; }
      if (sortKey === "pnl")   { va = a.pnl ?? -Infinity; vb = b.pnl ?? -Infinity; }
      if (sortKey === "weight"){ va = a.weight; vb = b.weight; }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [enriched, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
        <div className="p-4 border-b border-white/5">
          <div className="h-4 w-32 bg-muted/30 rounded-full animate-pulse" />
        </div>
        <div className="divide-y divide-white/5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
              <div className="h-8 w-8 rounded-xl bg-muted/20" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-16 bg-muted/30 rounded-full" />
                <div className="h-2.5 w-24 bg-muted/20 rounded-full" />
              </div>
              <div className="h-3 w-12 bg-muted/20 rounded-full" />
              <div className="h-3 w-16 bg-muted/20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (holdings.length === 0) return null;

  return (
    <div className="rounded-3xl border border-white/8 bg-card/50 backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.24)] hover:border-primary/20 transition-all duration-500">
      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Holdings</h3>
          <span className="text-[10px] font-bold text-muted-foreground bg-muted/20 border border-white/5 px-2 py-0.5 rounded-full">
            {holdings.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Total {currencySymbol}{formatCurrency(totalValue, locale)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-white/5">
              {[
                { label: "Asset",   key: "symbol" as SortKey, align: "left" },
                { label: "Qty / Avg",key: null,              align: "right" },
                { label: "Price",   key: null,               align: "right" },
                { label: "Value",   key: "value" as SortKey, align: "right" },
                { label: "Weight",  key: "weight" as SortKey,align: "left" },
                { label: "",        key: null,               align: "right" },
              ].map(({ label, key, align }) => (
                <th
                  key={label || "actions"}
                  className={cn(
                    "px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70",
                    align === "right" ? "text-right" : "text-left",
                    key && "cursor-pointer hover:text-foreground transition-colors select-none",
                  )}
                  onClick={() => key && toggleSort(key)}
                >
                  <span className="flex items-center gap-1" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
                    {label}
                    {key && <SortIcon k={key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => (
              <HoldingRow
                key={h.id}
                holding={h}
                index={i}
                currencySymbol={currencySymbol}
                locale={locale}
                weight={h.weight}
                maxWeight={maxWeight}
                onRemove={onRemove}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground/50">Click a row to expand DSE signal scores</p>
        <p className="text-[10px] text-muted-foreground/50">{holdings.length} position{holdings.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}
