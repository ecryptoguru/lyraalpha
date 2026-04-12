"use client";

import { cn, formatCompactNumber, formatPrice, type RegionFormat } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Info } from "lucide-react";

interface ValuationMetric {
  label: string;
  value: string | number | null;
  format?: "percentage" | "ratio" | "currency" | "number";
  tooltip?: string;
  benchmark?: {
    value: number;
    label: string;
  };
}

interface ValuationMatrixProps {
  peRatio?: number | null;
  pegRatio?: number | null;
  priceToBook?: number | null;
  eps?: number | null;
  roe?: number | null;
  profitMargins?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  revenueGrowth?: number | null;
  freeCashflow?: number | null;
  dividendYield?: number | null;
  assetType?: string;
  industryPe?: number | null;
  currencySymbol?: string;
  region?: RegionFormat;
  className?: string;
}

const createFormatValue = (currencySymbol: string = "$", region: RegionFormat = "US") => (
  value: number | string | null | undefined,
  format: ValuationMetric["format"] = "number"
): string => {
  if (value === null || value === undefined) return "—";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  switch (format) {
    case "percentage":
      return `${(num * 100).toFixed(2)}%`;
    case "ratio":
      return `${num.toFixed(2)}x`;
    case "currency":
      if (Math.abs(num) >= 1e6) return formatCompactNumber(num, { symbol: currencySymbol, region });
      return formatPrice(num, { symbol: currencySymbol, region });
    default:
      return num.toFixed(2);
  }
};

const hasVisibleValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "—") return false;
  const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(numeric)) return numeric !== 0;
  return true;
};

const MetricRow = ({ 
  label, 
  value, 
  tooltip,
  isPositive,
}: { 
  label: string; 
  value: string; 
  tooltip?: string;
  isPositive?: boolean | null;
}) => {
  if (!hasVisibleValue(value)) return null;

  return (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group/row hover:bg-white/5 transition-colors px-2 -mx-2 rounded-lg">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-70 group-hover/row:opacity-100 transition-opacity truncate">{label}</span>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3.5 h-3.5 text-muted-foreground opacity-30 hover:opacity-100 cursor-help shrink-0 transition-opacity" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[min(280px,calc(100vw-2rem))] text-xs p-3 bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <span className={cn(
        "text-sm font-bold tracking-tight text-foreground",
        isPositive === true && "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]",
        isPositive === false && "text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]",
      )}>
        {value}
      </span>
      {isPositive === true && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
      {isPositive === false && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
    </div>
  </div>
  );
};

export function ValuationMatrix({
  peRatio,
  pegRatio,
  priceToBook,
  eps,
  roe,
  profitMargins,
  debtToEquity,
  currentRatio,
  revenueGrowth,
  freeCashflow,
  dividendYield,
  industryPe,
  currencySymbol = "$",
  region = "US",
  className,
}: ValuationMatrixProps) {
  const isStock = false; // Platform is crypto-only
  const formatValue = createFormatValue(currencySymbol, region);

  const hasAnyVisibleMetrics = [
    peRatio,
    isStock ? pegRatio : null,
    priceToBook,
    isStock ? eps : null,
    isStock ? roe : null,
    isStock ? profitMargins : null,
    isStock ? revenueGrowth : null,
    isStock ? debtToEquity : null,
    isStock ? currentRatio : null,
    isStock ? freeCashflow : null,
    dividendYield,
  ].some((v) => hasVisibleValue(v));

  if (!hasAnyVisibleMetrics) return null;

  return (
    <TooltipProvider>
      <div className={cn("rounded-3xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl overflow-hidden relative group/matrix transition-all duration-500 hover:bg-card/80 hover:border-primary/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]", className)}>
        {/* Subtle hover glow */}
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover/matrix:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        <div className="px-5 py-4 border-b border-light/5 flex items-center justify-between relative z-10 bg-black/10">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Valuation & Profitability
          </h3>
        </div>
        
        <div className="px-5 py-2 relative z-10">
        {/* Valuation Metrics */}
        <MetricRow 
          label="P/E (TTM)" 
          value={formatValue(peRatio, "ratio")}
          tooltip={industryPe ? `Industry P/E: ${industryPe.toFixed(2)}x` : "Price-to-Earnings ratio. Lower may indicate undervaluation."}
          isPositive={peRatio != null && industryPe != null ? peRatio < (industryPe * 0.9) : null}
        />
        
        {isStock && (
          <MetricRow 
            label="PEG Ratio" 
            value={formatValue(pegRatio, "ratio")}
            tooltip="P/E divided by growth rate. <1 may indicate undervaluation."
            isPositive={pegRatio != null ? pegRatio < 1 : null}
          />
        )}
        
        <MetricRow 
          label="P/B Ratio" 
          value={formatValue(priceToBook, "ratio")}
          tooltip="Price-to-Book. <1 may indicate undervaluation."
        />
        
        {isStock && (
          <MetricRow 
            label="EPS (TTM)" 
            value={formatValue(eps, "currency")}
            tooltip="Earnings Per Share (trailing twelve months)"
            isPositive={eps != null ? eps > 0 : null}
          />
        )}

        {/* Profitability Metrics */}
        {isStock && (
          <>
            <MetricRow 
              label="ROE (TTM)" 
              value={formatValue(roe, "percentage")}
              tooltip="Return on Equity. Higher indicates better capital efficiency."
              isPositive={roe != null ? roe > 0.15 : null}
            />
            
            <MetricRow 
              label="Profit Margin" 
              value={formatValue(profitMargins, "percentage")}
              tooltip="Net profit as % of revenue"
              isPositive={profitMargins != null ? profitMargins > 0.10 : null}
            />
            
            <MetricRow 
              label="Revenue Growth" 
              value={formatValue(revenueGrowth, "percentage")}
              tooltip="Year-over-year revenue growth"
              isPositive={revenueGrowth != null ? revenueGrowth > 0 : null}
            />
          </>
        )}

        {/* Financial Health */}
        {isStock && (
          <>
            <MetricRow 
              label="Debt/Equity" 
              value={formatValue(debtToEquity != null ? debtToEquity / 100 : null, "ratio")}
              tooltip="Total debt divided by equity. Lower is generally better."
              isPositive={debtToEquity != null ? debtToEquity < 100 : null}
            />
            
            <MetricRow 
              label="Current Ratio" 
              value={formatValue(currentRatio, "ratio")}
              tooltip="Current assets / current liabilities. >1 indicates good liquidity."
              isPositive={currentRatio != null ? currentRatio > 1 : null}
            />
          </>
        )}

        {/* Free Cash Flow */}
        {isStock && freeCashflow != null && (
          <MetricRow 
            label="Free Cash Flow" 
            value={formatValue(freeCashflow, "currency")}
            tooltip="Cash generated after capital expenditures"
            isPositive={freeCashflow > 0}
          />
        )}

        {/* Dividend */}
        {dividendYield != null && dividendYield > 0 && (
          <MetricRow 
            label="Dividend Yield" 
            value={formatValue(dividendYield, "percentage")}
            tooltip="Annual dividend as % of price"
          />
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
