"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, IndianRupee, Clock,
  ArrowUpDown, BarChart2, Scale, Coins, Zap, ShieldCheck,
} from "lucide-react";

interface MCXPriceCardProps {
  metadata: Record<string, unknown>;
  assetName?: string;
  /** COMEX/spot price in USD (analyticsComputed.price) */
  spotPriceUsd?: number;
  /** Symbol — used to determine lot size (GC=F vs SI=F) */
  symbol?: string;
  /** 52W high in USD from Yahoo Finance */
  fiftyTwoWeekHigh?: number | null;
  /** 52W low in USD from Yahoo Finance */
  fiftyTwoWeekLow?: number | null;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const OZ_TO_G = 31.1035;

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtInr(val: unknown, decimals = 0): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return "—";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtUsd(val: unknown, decimals = 2): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return "—";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtPct(val: unknown, showSign = true): string {
  const n = Number(val);
  if (val === undefined || val === null || isNaN(n)) return "—";
  return `${showSign && n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtGrams(g: number, decimals = 2): string {
  if (!g || isNaN(g)) return "—";
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g.toFixed(decimals)}g`;
}

function staleness(ts: unknown): string {
  if (!ts || typeof ts !== "string") return "";
  try {
    const diffH = Math.floor((Date.now() - new Date(ts).getTime()) / 3_600_000);
    if (diffH < 1) return "< 1h ago";
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  } catch { return ""; }
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface CellProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  color?: string;
}

function Cell({ label, value, sub, highlight, color }: CellProps) {
  return (
    <div className={cn(
      "flex flex-col gap-0.5 p-3 rounded-2xl border",
      highlight ? "bg-amber-500/8 border-amber-500/20" : "bg-background/40 border-border/30",
    )}>
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn("text-sm font-bold tracking-tight", color || "text-foreground")}>{value}</span>
      {sub && <span className="text-[9px] text-muted-foreground/55">{sub}</span>}
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
    </div>
  );
}

// ── Symbol sets ───────────────────────────────────────────────────────────────
const GOLD_SYMBOLS = ["GC=F", "GOLD-MCX"];
const SILVER_SYMBOLS = ["SI=F", "SILVER-MCX"];

function getLotValue(symbol: string | undefined, meta: Record<string, unknown>): { label: string; value: string } | null {
  if (!symbol) return null;
  if (GOLD_SYMBOLS.includes(symbol)) {
    const per10g = Number(meta.mcxPricePer10g);
    if (!per10g) return null;
    return { label: "1 Lot (100g)", value: fmtInr(per10g * 10) };
  }
  if (SILVER_SYMBOLS.includes(symbol)) {
    const perKg = Number(meta.mcxPricePerKg);
    if (!perKg) return null;
    return { label: "1 Lot (30kg)", value: fmtInr(perKg * 30) };
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function MCXPriceCard({
  metadata: m,
  assetName,
  spotPriceUsd,
  symbol,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  className,
}: MCXPriceCardProps) {
  const hasMCX = !!(m.mcxPricePerOz || m.mcxPricePer10g || m.mcxPricePerKg);
  if (!hasMCX) return null;

  const isNativeInr = symbol === "GOLD-MCX" || symbol === "SILVER-MCX";
  const isGold = GOLD_SYMBOLS.includes(symbol ?? "");
  const isSilver = SILVER_SYMBOLS.includes(symbol ?? "");

  // ── Derived: implied USD/INR rate ─────────────────────────────────────────
  const mcxOz = Number(m.mcxPricePerOz);
  const ask = Number(m.spotAsk);
  const bid = Number(m.spotBid);
  const spotMid = !isNativeInr && spotPriceUsd
    ? spotPriceUsd
    : (ask + bid) / 2 || 0;
  const impliedRate = !isNativeInr && mcxOz > 0 && spotMid > 0 ? mcxOz / spotMid : 0;

  // ── Derived: MCX vs COMEX premium ────────────────────────────────────────
  const comexInInr = spotMid > 0 && impliedRate > 0 ? spotMid * impliedRate : 0;
  const mcxPremiumPct = comexInInr > 0 && mcxOz > 0
    ? ((mcxOz - comexInInr) / comexInInr) * 100 : null;

  // ── Derived: INR day range (from USD spot × implied rate) ─────────────────
  const dayHighInr = Number(m.dayHigh) > 0 && impliedRate > 0 ? Number(m.dayHigh) * impliedRate : 0;
  const dayLowInr  = Number(m.dayLow)  > 0 && impliedRate > 0 ? Number(m.dayLow)  * impliedRate : 0;

  // ── Derived: INR 52W range ────────────────────────────────────────────────
  const high52wInr = fiftyTwoWeekHigh && impliedRate > 0 ? fiftyTwoWeekHigh * impliedRate : 0;
  const low52wInr  = fiftyTwoWeekLow  && impliedRate > 0 ? fiftyTwoWeekLow  * impliedRate : 0;
  const dist52wHighPct = high52wInr > 0 && mcxOz > 0
    ? ((mcxOz - high52wInr) / high52wInr) * 100 : null;

  // ── Derived: AM vs PM fix divergence ─────────────────────────────────────
  const amFix = Number(m.mcxGoldAm || m.mcxSilverAm);
  const pmFix = Number(m.mcxGoldPm || m.mcxSilverPm);
  const fixDivergencePct = amFix > 0 && pmFix > 0
    ? ((pmFix - amFix) / amFix) * 100 : null;

  // ── Derived: bid/ask spread ───────────────────────────────────────────────
  const spreadPct = ask > 0 && bid > 0 ? ((ask - bid) / bid) * 100 : null;

  // ── Derived: MCX lot value ────────────────────────────────────────────────
  const lotValue = getLotValue(symbol, m);

  // ── Derived: Purchasing Power (India-exclusive) ───────────────────────────
  // How much metal can various INR amounts buy?
  const per10g = Number(m.mcxPricePer10g);
  const perKg  = Number(m.mcxPricePerKg);

  const gramsFor = (inr: number): number => {
    if (isGold && per10g > 0)   return (inr / per10g) * 10;
    if (isSilver && perKg > 0)  return (inr / perKg) * 1000;
    return 0;
  };

  const oneLakhGrams = gramsFor(100_000);
  const tenKGrams    = gramsFor(10_000);
  const sipGrams     = gramsFor(5_000);

  // ── Derived: Prior settlement in INR ─────────────────────────────────────
  const changePercent = Number(m.dayChangePercent);
  const priceNow = isGold ? per10g : perKg;
  const priorSettlementInr = priceNow > 0 && changePercent !== 0
    ? priceNow / (1 + changePercent / 100) : 0;

  // ── Derived: INR day range for native assets (from USD spot × implied MCX rate) ──
  // For GOLD-MCX/SILVER-MCX: derive day range in native unit from USD intraday + MCX rate
  const mcxRateForRange = mcxOz > 0 && ask > 0 ? mcxOz / ask : 0;
  const nativeDayHighInr = isNativeInr && Number(m.dayHigh) > 0 && mcxRateForRange > 0
    ? isGold
      ? (Number(m.dayHigh) * mcxRateForRange / OZ_TO_G) * 10   // per 10g
      : (Number(m.dayHigh) * mcxRateForRange / OZ_TO_G) * 1000 // per kg
    : 0;
  const nativeDayLowInr = isNativeInr && Number(m.dayLow) > 0 && mcxRateForRange > 0
    ? isGold
      ? (Number(m.dayLow) * mcxRateForRange / OZ_TO_G) * 10
      : (Number(m.dayLow) * mcxRateForRange / OZ_TO_G) * 1000
    : 0;

  // ── Change direction ──────────────────────────────────────────────────────
  const isUp = changePercent > 0;
  const isDown = changePercent < 0;
  const ChangeIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const changeColor = isUp ? "text-emerald-500" : isDown ? "text-red-500" : "text-muted-foreground";

  const updatedAgo = staleness(m.lastMetalUpdate);

  // MCX contract static data
  const contractData = isGold
    ? { lotSize: "100g", mini: "10g", quotation: "₹/10g", margin: "~4–5%", delivery: "995 purity", settlement: "Compulsory delivery", hours: "9:00 AM – 11:30 PM IST" }
    : { lotSize: "30 kg", mini: "5 kg", quotation: "₹/kg", margin: "~5–6%", delivery: "999 purity", settlement: "Compulsory delivery", hours: "9:00 AM – 11:30 PM IST" };

  return (
    <div className={cn(
      "rounded-2xl border border-amber-500/20 bg-linear-to-br from-amber-500/5 via-yellow-500/3 to-transparent overflow-hidden",
      className,
    )}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <IndianRupee className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              MCX India Intelligence
            </h3>
            {assetName && (
              <p className="text-[9px] text-muted-foreground">{assetName} · Metals.Dev</p>
            )}
          </div>
        </div>
        {changePercent !== 0 && (
          <div className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold",
            isUp ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                 : "bg-red-500/10 border-red-500/20 text-red-500",
          )}>
            <ChangeIcon className="w-3 h-3" />
            {fmtPct(changePercent)}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-4">

        {/* ── Section 1: INR Spot Prices ─────────────────────────────────── */}
        <div className="space-y-2">
          <SectionLabel icon={IndianRupee} label="MCX Spot Prices (INR)" />
          <div className="grid grid-cols-3 gap-2">
            <Cell label="Per 10g" value={fmtInr(m.mcxPricePer10g)} sub="MCX spot" highlight color="text-amber-500" />
            <Cell label="Per kg"  value={fmtInr(m.mcxPricePerKg)}  sub="MCX spot" highlight color="text-amber-500" />
            <Cell label="Per oz"  value={fmtInr(m.mcxPricePerOz)}  sub="MCX spot" highlight color="text-amber-500" />
          </div>
        </div>

        {/* ── Section 2: INR Data Matrix (mirrors US Commodity Data Matrix) ── */}
        <div className="space-y-2">
          <SectionLabel icon={BarChart2} label="INR Data Matrix" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Day Range — native INR for GOLD-MCX/SILVER-MCX, derived for GC=F/SI=F */}
            {isNativeInr ? (
              nativeDayHighInr > 0 && nativeDayLowInr > 0 && (
                <Cell
                  label="Day Range"
                  value={`${fmtInr(nativeDayLowInr)} – ${fmtInr(nativeDayHighInr)}`}
                  sub={isGold ? "INR/10g" : "INR/kg"}
                />
              )
            ) : (
              dayHighInr > 0 && dayLowInr > 0 && (
                <Cell
                  label="Day Range (INR)"
                  value={`${fmtInr(dayLowInr)} – ${fmtInr(dayHighInr)}`}
                  sub="derived from USD"
                />
              )
            )}
            {/* Prior Settlement in INR */}
            {priorSettlementInr > 0 && (
              <Cell
                label="Prior Settlement"
                value={fmtInr(priorSettlementInr)}
                sub={isGold ? "INR/10g" : "INR/kg"}
              />
            )}
            {/* 52W INR range */}
            {high52wInr > 0 && low52wInr > 0 && (
              <Cell
                label="52W Range (INR)"
                value={`${fmtInr(low52wInr)} – ${fmtInr(high52wInr)}`}
                sub="derived from USD 52W"
              />
            )}
            {/* Distance from 52W high */}
            {dist52wHighPct !== null && (
              <Cell
                label="From 52W High"
                value={fmtPct(dist52wHighPct)}
                sub="INR basis"
                color={dist52wHighPct < 0 ? "text-red-400" : "text-emerald-400"}
              />
            )}
            {/* Lot value */}
            {lotValue && (
              <Cell label={lotValue.label} value={lotValue.value} sub="MCX contract value" color="text-amber-400" />
            )}
            {/* Implied USD/INR */}
            {impliedRate > 0 && (
              <Cell label="Implied USD/INR" value={impliedRate.toFixed(2)} sub="MCX implied rate" color="text-sky-400" />
            )}
            {/* MCX vs COMEX premium */}
            {mcxPremiumPct !== null && (
              <Cell
                label="MCX Premium"
                value={fmtPct(mcxPremiumPct)}
                sub="vs COMEX"
                color={mcxPremiumPct > 0 ? "text-amber-400" : "text-muted-foreground"}
              />
            )}
          </div>
        </div>

        {/* ── Section 3: Purchasing Power (India-exclusive) ───────────────── */}
        {oneLakhGrams > 0 && (
          <div className="space-y-2">
            <SectionLabel icon={Coins} label="Purchasing Power (INR)" />
            <div className="grid grid-cols-3 gap-2">
              <Cell
                label="₹1L buys"
                value={fmtGrams(oneLakhGrams, isGold ? 2 : 1)}
                sub={isGold ? "gold" : "silver"}
                highlight
                color="text-amber-400"
              />
              <Cell
                label="₹10K buys"
                value={fmtGrams(tenKGrams, isGold ? 3 : 2)}
                sub={isGold ? "gold" : "silver"}
                color="text-amber-400/80"
              />
              <Cell
                label="₹5K SIP/mo"
                value={fmtGrams(sipGrams, isGold ? 3 : 2)}
                sub="monthly accumulation"
                color="text-sky-400"
              />
            </div>
            {/* Contextual bar: cost per gram */}
            <div className="p-2.5 rounded-2xl bg-background/30 border border-border/30 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {isGold ? "Cost per gram" : "Cost per 100g"}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {isGold
                    ? fmtInr(per10g / 10, 0)
                    : fmtInr(perKg / 10, 0)
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Mini lot value</p>
                <p className="text-sm font-bold text-amber-400">
                  {isGold
                    ? fmtInr(per10g)       // mini lot = 10g
                    : fmtInr(perKg * 5)    // mini lot = 5kg
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 4: MCX Session Fixes ───────────────────────────────── */}
        {(amFix > 0 || pmFix > 0) && (
          <div className="space-y-2">
            <SectionLabel icon={Zap} label="Session Fixes" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {amFix > 0 && <Cell label="AM Fix" value={fmtInr(amFix)} sub="per oz" />}
              {pmFix > 0 && <Cell label="PM Fix" value={fmtInr(pmFix)} sub="per oz" />}
              {fixDivergencePct !== null && (
                <Cell
                  label="AM→PM Drift"
                  value={fmtPct(fixDivergencePct)}
                  sub="session divergence"
                  color={fixDivergencePct > 0 ? "text-emerald-400" : "text-red-400"}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Section 5: Market Intelligence (Derived) ───────────────────── */}
        <div className="space-y-2">
          <SectionLabel icon={Scale} label="Market Intelligence (Derived)" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* USD Intraday */}
            {Number(m.dayHigh) > 0 && (
              <Cell label="Day High (USD)" value={fmtUsd(m.dayHigh)} color="text-emerald-500" />
            )}
            {Number(m.dayLow) > 0 && (
              <Cell label="Day Low (USD)" value={fmtUsd(m.dayLow)} color="text-red-500" />
            )}
            {Number(m.dayChange) !== 0 && (
              <Cell
                label="Change (USD)"
                value={`${Number(m.dayChange) > 0 ? "+" : ""}${fmtUsd(m.dayChange)}`}
                color={changeColor}
              />
            )}
            {changePercent !== 0 && (
              <Cell label="Change %" value={fmtPct(changePercent)} color={changeColor} />
            )}
          </div>
        </div>

        {/* ── Section 6: Bid / Ask (USD) ──────────────────────────────────── */}
        {ask > 0 && bid > 0 && (
          <div className="space-y-2">
            <SectionLabel icon={ArrowUpDown} label="Bid / Ask (USD Spot)" />
            <div className="flex items-stretch gap-2">
              <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-background/40 border border-border/30">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Bid</p>
                <p className="text-sm font-bold text-red-400">{fmtUsd(bid)}</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-background/40 border border-border/30">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Ask</p>
                <p className="text-sm font-bold text-emerald-400">{fmtUsd(ask)}</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-background/40 border border-border/30">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Spread</p>
                <p className="text-sm font-bold text-muted-foreground">{fmtUsd(ask - bid, 3)}</p>
              </div>
              {spreadPct !== null && (
                <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-background/40 border border-border/30">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Spread %</p>
                  <p className="text-sm font-bold text-muted-foreground">{fmtPct(spreadPct, false)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Section 7: MCX Contract Details (India-exclusive) ───────────── */}
        <div className="space-y-2">
          <SectionLabel icon={ShieldCheck} label="MCX Contract Details" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Cell label="Exchange"      value="MCX India"              sub="Multi Commodity Exchange" />
            <Cell label="Lot Size"      value={contractData.lotSize}   sub={isGold ? "Gold futures" : "Silver futures"} />
            <Cell label="Mini Lot"      value={contractData.mini}      sub="smaller contract" />
            <Cell label="Quotation"     value={contractData.quotation} sub="MCX standard" />
            <Cell label="SEBI Margin"   value={contractData.margin}    sub="approx. initial margin" color="text-amber-400" />
            <Cell label="Delivery"      value={contractData.delivery}  sub="fineness standard" />
            <Cell label="Settlement"    value={contractData.settlement} sub="physical delivery" />
            <Cell label="Trading Hours" value={contractData.hours}     sub="IST (Mon–Fri)" />
            <Cell label="Linked COMEX"  value={isGold ? "GC=F" : "SI=F"} sub="USD reference contract" color="text-sky-400" />
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {updatedAgo && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
            <Clock className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[8px] text-muted-foreground/40">
              Updated {updatedAgo} · Source: Metals.Dev · Derived metrics calculated client-side
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
