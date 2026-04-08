"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFriendlySymbol } from "@/lib/format-utils";

interface ChangedAsset {
  symbol: string;
  name: string;
  type: string;
  changeType: "score_inflection" | "regime_shift" | "price_move";
  description: string;
  magnitude: number;
}

const LAST_SEEN_KEY = "elite:last-seen";
const DISMISSED_KEY = "elite:whats-changed-dismissed";

function getInitialDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISSED_KEY) === new Date().toDateString();
  } catch {
    return false;
  }
}

function shouldFetch(): { fetch: boolean; since: string | null } {
  if (typeof window === "undefined") return { fetch: false, since: null };
  try {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    if (!lastSeen) return { fetch: false, since: null };
    const hoursSince = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 4) return { fetch: false, since: null };
    return { fetch: true, since: lastSeen };
  } catch {
    return { fetch: false, since: null };
  }
}

export function WhatsChangedCard() {
  const [changes, setChanges] = useState<ChangedAsset[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(getInitialDismissed);
  // Compute fetch params once on mount — avoids setState in effect
  const fetchParams = React.useMemo(() => {
    if (getInitialDismissed()) return null;
    return shouldFetch();
  }, []);
  const [loading, setLoading] = useState(() => !!(fetchParams?.fetch && fetchParams?.since));

  useEffect(() => {
    if (!fetchParams?.fetch || !fetchParams?.since) return;

    let cancelled = false;
    fetch(`/api/lyra/whats-changed?since=${encodeURIComponent(fetchParams.since)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.changes?.length > 0) {
          setChanges(data.changes);
          setSummary(data.summary);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchParams?.fetch, fetchParams?.since]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toDateString());
    } catch { /* ignore */ }
    setDismissed(true);
  };

  if (loading || dismissed || changes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-2xl bg-primary/15 border border-primary/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Since Your Last Visit</p>
            {summary && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-xl">{summary}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-2xl hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {changes.slice(0, 5).map((c) => (
          <Link
            key={c.symbol}
            href={`/dashboard/assets/${c.symbol}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border border-white/5 bg-card/60 hover:border-primary/30 hover:bg-primary/5 transition-all group"
          >
            <div className={cn(
              "w-4 h-4 rounded flex items-center justify-center shrink-0",
              c.changeType === "price_move" && c.description.startsWith("+") ? "bg-emerald-500/15" :
              c.changeType === "price_move" ? "bg-rose-500/15" : "bg-primary/10"
            )}>
              {c.changeType === "price_move" && c.description.startsWith("+") ? (
                <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
              ) : c.changeType === "price_move" ? (
                <TrendingDown className="h-2.5 w-2.5 text-rose-400" />
              ) : (
                <Activity className="h-2.5 w-2.5 text-primary" />
              )}
            </div>
            <span className="text-[10px] font-bold text-foreground group-hover:text-primary transition-colors">
              {getFriendlySymbol(c.symbol, c.type, c.name)}
            </span>
            <span className="text-[9px] text-muted-foreground/70">{c.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
