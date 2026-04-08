"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Crown, TrendingUp, TrendingDown, Activity, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BriefingAsset {
  symbol: string;
  name: string;
  type: string;
  changePercent: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  compatibilityScore: number | null;
  compatibilityLabel: string | null;
  signalScore: number | null;
  signalLabel: string | null;
}

interface PersonalBriefing {
  date: string;
  watchlistCount: number;
  topAssets: BriefingAsset[];
  misaligned: string[];
  strongMomentum: string[];
  summary: string;
}

export function PersonalBriefingCard() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useSWR<{ briefing: PersonalBriefing | null; reason?: string }>(
    "/api/lyra/personal-briefing",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 900000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full bg-primary/30" />
          <div className="h-3 w-32 bg-muted/30 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-muted/20 rounded" />
          <div className="h-3 w-4/5 bg-muted/15 rounded" />
        </div>
      </div>
    );
  }

  if (!data?.briefing) {
    return (
      <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-2xl overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-2xl bg-primary/15 border border-primary/20">
              <Crown className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Personalized signals</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed max-w-lg">
                Add more portfolio or watchlist context to unlock a stronger personalized morning brief.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/dashboard/portfolio"
              className="rounded-2xl border border-white/10 bg-card/60 px-4 py-3 hover:border-primary/25 hover:bg-primary/5 transition-colors"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Portfolio context</p>
              <p className="mt-2 text-sm font-bold text-foreground">Review your portfolio</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Portfolio health, concentration and fragility signals will appear here once your context is available.
              </p>
            </Link>

            <Link
              href="/dashboard/watchlist"
              className="rounded-2xl border border-white/10 bg-card/60 px-4 py-3 hover:border-primary/25 hover:bg-primary/5 transition-colors"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Watchlist context</p>
              <p className="mt-2 text-sm font-bold text-foreground">Curate your watchlist</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Watchlist momentum and regime-misalignment alerts will show up here after you track a few assets.
              </p>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { briefing } = data;

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-2xl bg-primary/15 border border-primary/20">
            <Crown className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Elite Watchlist Brief</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed max-w-lg">{briefing.summary}</p>
          </div>
        </div>
        <div className="shrink-0 ml-3">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-primary/10">
          {/* Top assets */}
          {briefing.topAssets.length > 0 && (
            <div className="pt-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Top Signals in Your Watchlist</p>
              <div className="space-y-1.5">
                {briefing.topAssets.map((asset) => (
                  <Link
                    key={asset.symbol}
                    href={`/dashboard/assets/${asset.symbol}`}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-2xl shadow-xl hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-[7px] font-bold text-primary shrink-0">
                        {getFriendlySymbol(asset.symbol, asset.type, asset.name).slice(0, 2)}
                      </div>
                      <span className="text-[10px] font-bold truncate group-hover:text-primary transition-colors">
                        {getFriendlySymbol(asset.symbol, asset.type, asset.name)}
                      </span>
                      {asset.signalLabel && (
                        <span className="text-[8px] text-muted-foreground hidden sm:inline">{asset.signalLabel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {asset.signalScore != null && (
                        <span className={cn(
                          "text-[9px] font-bold",
                          asset.signalScore >= 70 ? "text-emerald-400" : asset.signalScore >= 50 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {Math.round(asset.signalScore)}
                        </span>
                      )}
                      {asset.changePercent != null && (
                        <span className={cn(
                          "text-[9px] font-bold flex items-center gap-0.5",
                          asset.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {asset.changePercent >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {asset.changePercent >= 0 ? "+" : ""}{asset.changePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Alerts row */}
          <div className="flex flex-wrap gap-2 pt-1">
            {briefing.strongMomentum.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/8">
                <Activity className="h-2.5 w-2.5 text-emerald-400" />
                <span className="text-[8px] font-bold text-emerald-400">
                  Strong momentum: {briefing.strongMomentum.slice(0, 3).map((symbol) => {
                    const asset = briefing.topAssets.find((item) => item.symbol === symbol);
                    return getFriendlySymbol(symbol, asset?.type, asset?.name);
                  }).join(", ")}
                </span>
              </div>
            )}
            {briefing.misaligned.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/8">
                <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                <span className="text-[8px] font-bold text-amber-400">
                  Regime-misaligned: {briefing.misaligned.slice(0, 3).map((symbol) => {
                    const asset = briefing.topAssets.find((item) => item.symbol === symbol);
                    return getFriendlySymbol(symbol, asset?.type, asset?.name);
                  }).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
