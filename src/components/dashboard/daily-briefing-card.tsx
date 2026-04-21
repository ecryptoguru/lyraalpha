"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Compass,
  Clock,
} from "lucide-react";
import type { DailyBriefing } from "@/lib/services/daily-briefing.service";
import { getFriendlySymbol } from "@/lib/format-utils";
import { formatRelativeTime } from "@/lib/format-relative-time";

interface DailyBriefingCardProps {
  region: string;
}

const briefingFetcher = async (url: string): Promise<DailyBriefing | null> => {
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? data.briefing : null;
};

function formatTimeAgo(isoString: string): string {
  return formatRelativeTime(isoString);
}

export function DailyBriefingCard({ region }: DailyBriefingCardProps) {
  const [expanded, setExpanded] = useState(true);

  const { data: briefing, isLoading } = useSWR<DailyBriefing | null>(
    `/api/lyra/briefing?region=${region}`,
    briefingFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min dedup
    },
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card/60 shadow-xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-2xl bg-muted/40" />
          <div className="h-4 w-48 bg-muted/40 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-muted/30 rounded" />
          <div className="h-3 w-3/4 bg-muted/30 rounded" />
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-card/40 to-card/30 backdrop-blur-xl overflow-hidden transition-all duration-500">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
                Lyra Daily Briefing
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                <Clock className="h-2.5 w-2.5" />
                Preparing today&apos;s market brief
              </p>
            </div>
          </div>

          <p className="text-sm text-foreground/75 leading-relaxed border-l-2 border-primary/20 pl-4">
            Today&apos;s cached market briefing is not available yet. You can still check fresh market signals now and return once the morning summary is ready.
          </p>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/discovery"
              className="inline-flex items-center rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary hover:bg-primary/15 transition-colors"
            >
              Open Signal Feed
            </Link>
            <Link
              href="/dashboard/lyra"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-card/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground hover:border-primary/20 transition-colors"
            >
              Ask Lyra Instead
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-card/40 to-card/30 backdrop-blur-xl overflow-hidden transition-all duration-500">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 pb-4 text-left hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Lyra Daily Briefing
            </h3>
            <p className="text-[9px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatTimeAgo(briefing.generatedAt)} · {briefing.regimeLabel}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
        )}
      </button>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">
            {briefing.marketOverview}
          </p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Market Overview */}
          <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/20 pl-4">
            {briefing.marketOverview}
          </p>

          {/* Regime sentence */}
          <div className="flex items-start gap-2 bg-muted/10 rounded-2xl p-3 border border-border/30">
            <Compass className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-foreground/70 leading-relaxed">
              {briefing.regimeSentence}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Key Insights */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 text-warning" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Key Insights
                </span>
              </div>
              <ul className="space-y-1.5">
                {briefing.keyInsights.map((insight, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-foreground/70 leading-relaxed pl-3 border-l border-warning/20"
                  >
                    {insight}
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks to Watch */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-danger" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  Risks to Watch
                </span>
              </div>
              <ul className="space-y-1.5">
                {briefing.risksToWatch.map((risk, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-foreground/70 leading-relaxed pl-3 border-l border-danger/20"
                  >
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Top Movers */}
          {(briefing.topMovers.gainers.length > 0 || briefing.topMovers.losers.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {briefing.topMovers.gainers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-success uppercase tracking-widest flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" /> Gainers
                  </span>
                  {briefing.topMovers.gainers.map((g) => (
                    <Link
                      key={g.symbol}
                      href={`/dashboard/assets/${g.symbol}`}
                      className="flex items-center justify-between py-2 px-2 rounded-2xl hover:bg-success/5 transition-colors group min-h-[38px]"
                    >
                      <span className="text-[10px] font-bold text-foreground/70 group-hover:text-success transition-colors truncate">
                        {getFriendlySymbol(g.symbol, undefined, g.name)}
                      </span>
                      <span className="text-[10px] font-bold text-success">
                        +{g.change.toFixed(1)}%
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {briefing.topMovers.losers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-danger uppercase tracking-widest flex items-center gap-1">
                    <TrendingDown className="h-2.5 w-2.5" /> Losers
                  </span>
                  {briefing.topMovers.losers.map((l) => (
                    <Link
                      key={l.symbol}
                      href={`/dashboard/assets/${l.symbol}`}
                      className="flex items-center justify-between py-2 px-2 rounded-2xl hover:bg-danger/5 transition-colors group min-h-[38px]"
                    >
                      <span className="text-[10px] font-bold text-foreground/70 group-hover:text-danger transition-colors truncate">
                        {getFriendlySymbol(l.symbol, undefined, l.name)}
                      </span>
                      <span className="text-[10px] font-bold text-danger">
                        {l.change.toFixed(1)}%
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Discovery Highlight */}
          {briefing.discoveryHighlight && (
            <div className="flex items-start gap-2 bg-primary/5 rounded-2xl p-3 border border-primary/10">
              <Compass className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="text-[8px] font-bold text-primary uppercase tracking-widest">
                  Discovery
                </span>
                <p className="text-[11px] text-foreground/70 leading-relaxed mt-0.5">
                  {briefing.discoveryHighlight}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
