"use client";

import { cn, formatCompactNumber, type RegionFormat } from "@/lib/utils";
import { BarChart3, TrendingUp, Scale, Banknote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FinancialStatement {
  incomeStatement?: {
    period?: string | null;
    totalRevenue?: number | null;
    grossProfit?: number | null;
    operatingIncome?: number | null;
    netIncome?: number | null;
    ebitda?: number | null;
    operatingExpense?: number | null;
    researchAndDevelopment?: number | null;
    basicEPS?: number | null;
    dilutedEPS?: number | null;
  };
  balanceSheet?: {
    period?: string | null;
    totalAssets?: number | null;
    totalLiabilities?: number | null;
    totalEquity?: number | null;
    cash?: number | null;
    currentAssets?: number | null;
    currentLiabilities?: number | null;
    longTermDebt?: number | null;
    totalDebt?: number | null;
    workingCapital?: number | null;
    retainedEarnings?: number | null;
  };
  cashflow?: {
    period?: string | null;
    operatingCashflow?: number | null;
    capitalExpenditures?: number | null;
    freeCashFlow?: number | null;
    financingCashFlow?: number | null;
    investingCashFlow?: number | null;
    dividendsPaid?: number | null;
    repurchaseOfCapitalStock?: number | null;
  };
  debtToEquity?: number | null;
  currentRatio?: number | null;
}

interface FinancialHighlightsProps {
  financials: FinancialStatement | null;
  currencySymbol?: string;
  region?: RegionFormat;
  className?: string;
}

function FinMetric({
  label,
  value,
  tooltip,
  isPositive,
}: {
  label: string;
  value: string;
  tooltip?: string;
  isPositive?: boolean | null;
}) {
  const content = (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        "text-xs font-semibold",
        isPositive === true && "text-emerald-500",
        isPositive === false && "text-red-500",
        isPositive === null && "text-foreground",
      )}>
        {value}
      </span>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

export function FinancialHighlights({
  financials,
  currencySymbol = "$",
  region = "US",
  className,
}: FinancialHighlightsProps) {
  if (!financials) return null;

  const { incomeStatement, balanceSheet, cashflow } = financials;
  const hasIncome = incomeStatement && (incomeStatement.totalRevenue != null || incomeStatement.netIncome != null);
  const hasBalance = balanceSheet && (balanceSheet.totalAssets != null || balanceSheet.totalEquity != null);
  const hasCashflow = cashflow && (cashflow.operatingCashflow != null || cashflow.freeCashFlow != null);

  if (!hasIncome && !hasBalance && !hasCashflow) return null;

  const fmt = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "—";
    return formatCompactNumber(val, { symbol: currencySymbol, region });
  };

  const grossMargin = incomeStatement?.totalRevenue && incomeStatement?.grossProfit
    ? ((incomeStatement.grossProfit / incomeStatement.totalRevenue) * 100).toFixed(1) + "%"
    : null;

  const netMargin = incomeStatement?.totalRevenue && incomeStatement?.netIncome
    ? ((incomeStatement.netIncome / incomeStatement.totalRevenue) * 100).toFixed(1) + "%"
    : null;

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl backdrop-blur-xl", className)}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          Financial Highlights
        </h3>
        {incomeStatement?.period && (
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider opacity-80">
            FY {incomeStatement.period}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* Income Statement */}
        {hasIncome && (
          <div className="p-3 space-y-0.5">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Income
              </span>
            </div>
            <FinMetric label="Revenue" value={fmt(incomeStatement!.totalRevenue)} tooltip="Total revenue for the fiscal year" />
            <FinMetric label="Gross Profit" value={fmt(incomeStatement!.grossProfit)} tooltip="Revenue minus cost of goods sold" />
            {grossMargin && <FinMetric label="Gross Margin" value={grossMargin} isPositive={parseFloat(grossMargin) > 40} tooltip="Gross profit as % of revenue. >40% is strong." />}
            <FinMetric label="Operating Income" value={fmt(incomeStatement!.operatingIncome)} isPositive={incomeStatement!.operatingIncome != null ? incomeStatement!.operatingIncome > 0 : null} tooltip="Profit from core operations" />
            <FinMetric label="Net Income" value={fmt(incomeStatement!.netIncome)} isPositive={incomeStatement!.netIncome != null ? incomeStatement!.netIncome > 0 : null} tooltip="Bottom-line profit after all expenses and taxes" />
            {netMargin && <FinMetric label="Net Margin" value={netMargin} isPositive={parseFloat(netMargin) > 10} tooltip="Net income as % of revenue. >10% is solid." />}
            {incomeStatement!.ebitda != null && (
              <FinMetric label="EBITDA" value={fmt(incomeStatement!.ebitda)} isPositive={incomeStatement!.ebitda > 0} tooltip="Earnings before interest, taxes, depreciation & amortization" />
            )}
            {incomeStatement!.researchAndDevelopment != null && (
              <FinMetric label="R&D Spend" value={fmt(incomeStatement!.researchAndDevelopment)} tooltip="Research & development investment" />
            )}
          </div>
        )}

        {/* Balance Sheet */}
        {hasBalance && (
          <div className="p-3 space-y-0.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Scale className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Balance Sheet
              </span>
            </div>
            <FinMetric label="Total Assets" value={fmt(balanceSheet!.totalAssets)} tooltip="Total value of everything the company owns" />
            <FinMetric label="Total Liabilities" value={fmt(balanceSheet!.totalLiabilities)} tooltip="Total obligations and debts owed" />
            <FinMetric label="Shareholders' Equity" value={fmt(balanceSheet!.totalEquity)} isPositive={balanceSheet!.totalEquity != null ? balanceSheet!.totalEquity > 0 : null} tooltip="Assets minus liabilities — book value" />
            <FinMetric label="Cash & Equivalents" value={fmt(balanceSheet!.cash)} tooltip="Liquid cash on hand" />
            <FinMetric label="Long-Term Debt" value={fmt(balanceSheet!.longTermDebt)} tooltip="Debt maturing beyond 1 year" />
            {financials.debtToEquity != null && (
              <FinMetric
                label="Debt/Equity"
                value={`${(financials.debtToEquity / 100).toFixed(2)}x`}
                isPositive={financials.debtToEquity < 100}
                tooltip="Total debt divided by equity. <1x is conservative."
              />
            )}
            {financials.currentRatio != null && (
              <FinMetric
                label="Current Ratio"
                value={`${financials.currentRatio.toFixed(2)}x`}
                isPositive={financials.currentRatio > 1}
                tooltip="Current assets / current liabilities. >1 means can cover short-term obligations."
              />
            )}
          </div>
        )}

        {/* Cashflow */}
        {hasCashflow && (
          <div className="p-3 space-y-0.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Banknote className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Cash Flow
              </span>
            </div>
            <FinMetric label="Operating CF" value={fmt(cashflow!.operatingCashflow)} isPositive={cashflow!.operatingCashflow != null ? cashflow!.operatingCashflow > 0 : null} tooltip="Cash generated from core business operations" />
            <FinMetric label="CapEx" value={fmt(cashflow!.capitalExpenditures)} tooltip="Capital expenditures — investment in assets" />
            <FinMetric label="Free Cash Flow" value={fmt(cashflow!.freeCashFlow)} isPositive={cashflow!.freeCashFlow != null ? cashflow!.freeCashFlow > 0 : null} tooltip="Operating CF minus CapEx. The cash available to shareholders." />
            {cashflow!.dividendsPaid != null && (
              <FinMetric label="Dividends Paid" value={fmt(cashflow!.dividendsPaid)} tooltip="Total dividends distributed to shareholders" />
            )}
            {cashflow!.repurchaseOfCapitalStock != null && cashflow!.repurchaseOfCapitalStock !== 0 && (
              <FinMetric label="Share Buybacks" value={fmt(cashflow!.repurchaseOfCapitalStock)} tooltip="Stock repurchased — reduces share count, boosting EPS" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
