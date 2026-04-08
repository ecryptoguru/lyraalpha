"use client";

import { cn } from "@/lib/utils";
import {
  Target,
  UserCheck,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  DollarSign,
} from "lucide-react";

interface FinnhubIntelligenceProps {
  metadata: Record<string, unknown>;
  price?: number | null;
}

interface AnalystData {
  recommendations?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    consensus: string;
    period: string;
  };
  priceTarget?: {
    high: number;
    low: number;
    mean: number;
    median: number;
  };
  recentUpgrades?: {
    company: string;
    from: string;
    to: string;
    action: string;
    date: string;
  }[];
}

interface InsiderSentimentData {
  avgMSPR: number;
  totalShareChange6m: number;
  signal: string;
}

interface FinnhubSentimentData {
  companyNewsScore: number;
  bullishPercent: number;
  bearishPercent: number;
  buzz: number;
  articlesInLastWeek: number;
}

interface FinancialsData {
  roe?: number | null;
  roa?: number | null;
  grossMargin?: number | null;
  operatingMargin?: number | null;
  netMargin?: number | null;
  epsGrowth?: number | null;
  revenueGrowth?: number | null;
  beta?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  dividendYield?: number | null;
  payoutRatio?: number | null;
}

function MetricRow({ label, value, suffix = "", color }: { label: string; value: number | string | null | undefined; suffix?: string; color?: string }) {
  if (value == null) return null;
  const display = typeof value === "number" ? value.toFixed(2) : value;
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-bold", color)}>{display}{suffix}</span>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <h4 className="text-sm font-bold tracking-tight">{title}</h4>
    </div>
  );
}

export function FinnhubIntelligenceCard({ metadata, price }: FinnhubIntelligenceProps) {
  const analyst = metadata.finnhubAnalyst as AnalystData | undefined;
  const insiderSentiment = metadata.insiderSentiment as InsiderSentimentData | undefined;
  const finnhubSentiment = metadata.finnhubSentiment as FinnhubSentimentData | undefined;
  const financials = metadata.finnhubFinancials as FinancialsData | undefined;
  const peers = metadata.finnhubPeers as string[] | undefined;

  const hasData = analyst || insiderSentiment || finnhubSentiment || financials;
  if (!hasData) return null;

  const recs = analyst?.recommendations;
  const pt = analyst?.priceTarget;
  const upgrades = analyst?.recentUpgrades;

  const upsidePercent = pt && price ? ((pt.mean - price) / price * 100) : null;

  return (
    <div className="space-y-6">
      {/* Analyst Consensus + Price Target */}
      {(recs || pt) && (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5">
          <SectionHeader icon={<Target className="h-4 w-4" />} title="Analyst Consensus" />

          {recs && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Consensus</span>
                <span className={cn(
                  "text-sm font-bold",
                  recs.consensus.includes("Buy") ? "text-emerald-400" :
                  recs.consensus.includes("Sell") ? "text-rose-400" : "text-amber-400"
                )}>
                  {recs.consensus}
                </span>
              </div>

              {/* Rating Bar */}
              <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
                {recs.strongBuy > 0 && <div className="bg-emerald-500" style={{ flex: recs.strongBuy }} />}
                {recs.buy > 0 && <div className="bg-emerald-400" style={{ flex: recs.buy }} />}
                {recs.hold > 0 && <div className="bg-amber-400" style={{ flex: recs.hold }} />}
                {recs.sell > 0 && <div className="bg-rose-400" style={{ flex: recs.sell }} />}
                {recs.strongSell > 0 && <div className="bg-rose-500" style={{ flex: recs.strongSell }} />}
              </div>
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Strong Buy: {recs.strongBuy}</span>
                <span>Buy: {recs.buy}</span>
                <span>Hold: {recs.hold}</span>
                <span>Sell: {recs.sell}</span>
              </div>
            </div>
          )}

          {pt && (
            <div className="mt-4 pt-4 border-t border-border/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Price Target (Mean)</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">${pt.mean.toFixed(2)}</span>
                  {upsidePercent !== null && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      upsidePercent > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {upsidePercent > 0 ? "+" : ""}{upsidePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Low: ${pt.low.toFixed(2)}</span>
                <span>Median: ${pt.median.toFixed(2)}</span>
                <span>High: ${pt.high.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Upgrades/Downgrades */}
      {upgrades && upgrades.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5">
          <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Recent Rating Changes" />
          <div className="space-y-2">
            {upgrades.slice(0, 4).map((u, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                <div className="flex items-center gap-2">
                  {u.action === "upgrade" ? (
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-rose-400" />
                  )}
                  <span className="text-xs font-medium">{u.company}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{u.from}</span>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <span className={cn(
                    "text-[10px] font-bold",
                    u.action === "upgrade" ? "text-emerald-400" : "text-rose-400"
                  )}>{u.to}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insider Sentiment */}
      {insiderSentiment && (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5">
          <SectionHeader icon={<UserCheck className="h-4 w-4" />} title="Insider Sentiment" />
          <div className="space-y-1">
            <MetricRow
              label="Signal"
              value={insiderSentiment.signal}
              color={insiderSentiment.signal === "BULLISH" ? "text-emerald-400" : insiderSentiment.signal === "BEARISH" ? "text-rose-400" : "text-amber-400"}
            />
            <MetricRow label="MSPR (6m avg)" value={insiderSentiment.avgMSPR} />
            <MetricRow
              label="Net Share Change (6m)"
              value={insiderSentiment.totalShareChange6m?.toLocaleString()}
              color={insiderSentiment.totalShareChange6m > 0 ? "text-emerald-400" : "text-rose-400"}
            />
          </div>
        </div>
      )}

      {/* News Sentiment (Finnhub) */}
      {finnhubSentiment && (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5">
          <SectionHeader icon={<DollarSign className="h-4 w-4" />} title="News Sentiment" />
          <div className="space-y-1">
            <MetricRow label="Company News Score" value={finnhubSentiment.companyNewsScore} />
            <MetricRow label="Bullish %" value={finnhubSentiment.bullishPercent} suffix="%" color="text-emerald-400" />
            <MetricRow label="Bearish %" value={finnhubSentiment.bearishPercent} suffix="%" color="text-rose-400" />
            <MetricRow label="Buzz Score" value={finnhubSentiment.buzz} />
            <MetricRow label="Articles (Last Week)" value={finnhubSentiment.articlesInLastWeek} />
          </div>
        </div>
      )}

      {/* Financials + Peers */}
      {(financials || (peers && peers.length > 0)) && (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5 space-y-5">
          {financials && (
            <div>
              <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Finnhub Financials" />
              <div className="grid grid-cols-2 gap-x-6">
                <div className="space-y-1">
                  <MetricRow label="ROE" value={financials.roe} suffix="%" />
                  <MetricRow label="ROA" value={financials.roa} suffix="%" />
                  <MetricRow label="Gross Margin" value={financials.grossMargin} suffix="%" />
                  <MetricRow label="Op. Margin" value={financials.operatingMargin} suffix="%" />
                  <MetricRow label="Net Margin" value={financials.netMargin} suffix="%" />
                  <MetricRow label="Beta" value={financials.beta} />
                </div>
                <div className="space-y-1">
                  <MetricRow label="EPS Growth" value={financials.epsGrowth} suffix="%" color={financials.epsGrowth && financials.epsGrowth > 0 ? "text-emerald-400" : "text-rose-400"} />
                  <MetricRow label="Rev Growth" value={financials.revenueGrowth} suffix="%" color={financials.revenueGrowth && financials.revenueGrowth > 0 ? "text-emerald-400" : "text-rose-400"} />
                  <MetricRow label="D/E Ratio" value={financials.debtToEquity} />
                  <MetricRow label="Current Ratio" value={financials.currentRatio} />
                  <MetricRow label="Div Yield" value={financials.dividendYield} suffix="%" />
                  <MetricRow label="Payout Ratio" value={financials.payoutRatio} suffix="%" />
                </div>
              </div>
            </div>
          )}

          {peers && peers.length > 0 && (
            <div className={cn(financials && "pt-4 border-t border-border/20")}>
              <SectionHeader icon={<Users className="h-4 w-4" />} title="Peer Companies" />
              <div className="flex flex-wrap gap-2">
                {[...new Set(peers)].map((peer, index) => (
                  <a
                    key={`${peer}-${index}`}
                    href={`/dashboard/assets/${peer}`}
                    className="px-2.5 py-1 rounded-2xl text-[10px] font-bold uppercase tracking-wider bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/20 transition-colors"
                  >
                    {peer}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
