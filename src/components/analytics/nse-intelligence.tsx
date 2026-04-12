"use client";

import { cn, formatCompactNumber, formatPrice, type RegionFormat } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Building2,
  Gauge,
  LineChart,
  Package,
  Shield,
  TrendingUp,
} from "lucide-react";

interface NSEIntelligenceProps {
  metadata: Record<string, unknown>;
  currencySymbol?: string;
  region?: RegionFormat;
  className?: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "blue",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  color?: "blue" | "emerald" | "amber" | "red" | "cyan2" | "cyan";
}) {
  const colorMap = {
    blue: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    red: "bg-red-500/10 border-red-500/20 text-red-500",
    cyan2: "bg-cyan-500/10 border-cyan-500/20 text-cyan-500",
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-500",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl bg-card/60 backdrop-blur-2xl shadow-xl border border-white/5">
      <div className={cn("p-1.5 rounded-xl border", colorMap[color])}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        <span className="text-sm font-bold text-foreground truncate">{value}</span>
        {subValue && (
          <span className="text-[10px] text-muted-foreground">{subValue}</span>
        )}
      </div>
    </div>
  );
}

export function NSEIntelligence({
  metadata,
  currencySymbol = "₹",
  region = "IN",
  className,
}: NSEIntelligenceProps) {
  if (metadata?.dataSource !== "NSE_INDIA") return null;

  const deliveryPct = metadata.deliveryPercent as number;
  const annualVol = metadata.annualVolatility as number;
  const impactCost = metadata.impactCost as number;
  const symbolPe = metadata.symbolPe as number;
  const sectorPe = metadata.sectorPe as number;
  const totalTradedValueCr = metadata.totalTradedValueCr as number;
  const ffmcCr = metadata.ffmcCr as number;
  const isFnO = metadata.isFnO as boolean;
  const niftyIndicesRaw = metadata.niftyIndices;
  const niftyIndices = Array.isArray(niftyIndicesRaw)
    ? niftyIndicesRaw
    : typeof niftyIndicesRaw === 'string'
      ? (() => { try { const p = JSON.parse(niftyIndicesRaw || '[]'); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : [];
  const industryBasic = metadata.industryBasic as string;
  const industrySector = metadata.industrySector as string;
  const vwap = metadata.vwap as number;
  const securityVar = metadata.securityVar as number;
  const faceValue = metadata.faceValue as number;
  const issuedSize = metadata.issuedSize as number;

  // Delivery % classification
  const deliveryLabel =
    deliveryPct >= 60
      ? "Strong Institutional"
      : deliveryPct >= 40
        ? "Moderate"
        : deliveryPct > 0
          ? "Speculative"
          : "—";
  const deliveryColor =
    deliveryPct >= 60 ? "emerald" : deliveryPct >= 40 ? "amber" : "red";

  // P/E vs Sector P/E
  const peVsSector =
    symbolPe > 0 && sectorPe > 0
      ? symbolPe < sectorPe
        ? "Below sector"
        : symbolPe > sectorPe * 1.2
          ? "Premium to sector"
          : "In-line with sector"
      : "";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl",
        className,
      )}
    >
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          NSE Intelligence
        </h3>
        <div className="flex items-center gap-2">
          {isFnO && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
              F&O
            </span>
          )}
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            NSE India
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Row 1: Trade Quality */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {deliveryPct > 0 && (
            <MetricCard
              icon={Package}
              label="Delivery %"
              value={`${deliveryPct.toFixed(1)}%`}
              subValue={deliveryLabel}
              color={deliveryColor as "emerald" | "amber" | "red"}
            />
          )}
          {totalTradedValueCr > 0 && (
            <MetricCard
              icon={BarChart3}
              label="Traded Value"
              value={formatCompactNumber(totalTradedValueCr * 1e7, {
                symbol: currencySymbol,
                region,
              })}
              color="blue"
            />
          )}
          {vwap > 0 && (
            <MetricCard
              icon={TrendingUp}
              label="VWAP"
              value={formatPrice(vwap, {
                symbol: currencySymbol,
                region,
              })}
              color="cyan"
            />
          )}
        </div>

        {/* Row 2: Risk & Volatility */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {annualVol > 0 && (
            <MetricCard
              icon={Activity}
              label="Annual Volatility"
              value={`${annualVol.toFixed(1)}%`}
              subValue={
                annualVol < 20
                  ? "Low"
                  : annualVol < 35
                    ? "Moderate"
                    : "High"
              }
              color={annualVol < 20 ? "emerald" : annualVol < 35 ? "amber" : "red"}
            />
          )}
          {impactCost > 0 && (
            <MetricCard
              icon={Gauge}
              label="Impact Cost"
              value={`${impactCost.toFixed(2)}%`}
              subValue={
                impactCost <= 0.05
                  ? "Excellent liquidity"
                  : impactCost <= 0.1
                    ? "Good liquidity"
                    : "Moderate liquidity"
              }
              color={impactCost <= 0.05 ? "emerald" : impactCost <= 0.1 ? "blue" : "amber"}
            />
          )}
          {securityVar > 0 && (
            <MetricCard
              icon={Shield}
              label="VaR"
              value={`${securityVar.toFixed(1)}%`}
              subValue="Value at Risk"
              color="red"
            />
          )}
        </div>

        {/* Row 3: Valuation Context */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {symbolPe > 0 && (
            <MetricCard
              icon={LineChart}
              label="P/E"
              value={symbolPe.toFixed(1)}
              subValue={peVsSector}
              color="cyan2"
            />
          )}
          {sectorPe > 0 && (
            <MetricCard
              icon={LineChart}
              label="Sector P/E"
              value={sectorPe.toFixed(1)}
              color="blue"
            />
          )}
          {ffmcCr > 0 && (
            <MetricCard
              icon={Building2}
              label="Free-Float MCap"
              value={formatCompactNumber(ffmcCr * 1e7, {
                symbol: currencySymbol,
                region,
              })}
              color="emerald"
            />
          )}
        </div>

        {/* Row 4: Company Info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {industryBasic && (
            <MetricCard
              icon={Building2}
              label="Industry"
              value={industryBasic}
              subValue={industrySector || undefined}
              color="blue"
            />
          )}
          {faceValue > 0 && (
            <MetricCard
              icon={Package}
              label="Face Value"
              value={`₹${faceValue}`}
              color="cyan"
            />
          )}
          {issuedSize > 0 && (
            <MetricCard
              icon={BarChart3}
              label="Shares Outstanding"
              value={formatCompactNumber(issuedSize, {
                isCurrency: false,
                region,
              })}
              color="blue"
            />
          )}
        </div>

        {/* Index Membership */}
        {niftyIndices.length > 0 && (
          <div className="pt-2 border-t border-border/30">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">
Index Membership
            </span>
            <div className="flex flex-wrap gap-1.5">
              {niftyIndices.slice(0, 12).map((idx: string) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full bg-muted/50 border border-white/5 text-[9px] font-medium text-muted-foreground"
                >
                  {idx}
                </span>
              ))}
              {niftyIndices.length > 12 && (
                <span className="px-2 py-0.5 rounded-full bg-muted/50 border border-white/5 text-[9px] font-medium text-muted-foreground">
                  +{niftyIndices.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
