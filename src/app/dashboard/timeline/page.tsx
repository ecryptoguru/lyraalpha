"use client";

import { useMemo, useState } from "react";
import { formatRelativeTime as fmtRelativeTime } from "@/lib/format-relative-time";
import useSWR from "swr";
import {
  TrendingUp,
  BarChart3,
  Newspaper,
  ShieldAlert,
  ExternalLink,
  Bot,
  Zap,
  ArrowRight,
  UserCheck,
  Calendar,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useRegion } from "@/lib/context/RegionContext";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { getFriendlySymbol } from "@/lib/format-utils";
import { fetcher } from "@/lib/swr-fetcher";

interface IntelligenceEvent {
  id: string;
  assetId: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  date: string;
  metadata: Record<string, unknown>;
  asset?: {
    symbol: string;
    name: string;
    type: string;
    region?: string | null;
  };
}

const EVENT_FILTERS = [
  { key: "ALL", label: "All", types: "" },
  { key: "NEWS", label: "News", types: "NEWS" },
  { key: "CORPORATE", label: "Corporate", types: "EARNINGS,ANALYST,INSIDER" },
  { key: "SIGNALS", label: "Signals", types: "TECHNICAL,FUNDAMENTAL,MARKET" },
] as const;

function getEventIcon(type: string) {
  switch (type) {
    case "TECHNICAL": return <TrendingUp className="h-4 w-4" />;
    case "FUNDAMENTAL": return <BarChart3 className="h-4 w-4" />;
    case "NEWS": return <Newspaper className="h-4 w-4" />;
    case "INSIDER": return <UserCheck className="h-4 w-4" />;
    case "EARNINGS": return <Calendar className="h-4 w-4" />;
    case "ANALYST": return <Target className="h-4 w-4" />;
    default: return <ShieldAlert className="h-4 w-4" />;
  }
}

function getEventColor(type: string, severity: string) {
  if (severity === "HIGH") return "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]";
  if (severity === "MEDIUM") return "bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]";

  switch (type) {
    case "INSIDER": return "bg-amber-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]";
    case "EARNINGS": return "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]";
    case "ANALYST": return "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]";
    default: return "bg-primary text-white shadow-[0_0_20px_rgba(var(--primary),0.3)]";
  }
}

function getProviderBadge(provider: string | undefined) {
  if (!provider) return null;
  const labels: Record<string, { label: string; color: string }> = {
    finnhub: { label: "Finnhub", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    finnhub_crypto: { label: "Finnhub", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    cryptopanic: { label: "CryptoPanic", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
    newsdata: { label: "NewsData.io", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    newsdata_crypto: { label: "NewsData.io", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
    india_rss: { label: "India RSS", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  };
  const info = labels[provider];
  if (!info) return null;
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border", info.color)}>
      {info.label}
    </span>
  );
}

function formatRelativeTime(dateStr: string): string {
  return fmtRelativeTime(dateStr);
}

function TimelineSkeleton() {
  return (
    <div className="relative space-y-6 sm:space-y-10 pb-6 p-3 sm:p-4 md:p-6 animate-pulse">
      <div className="px-4 space-y-4">
        <div className="h-12 w-64 bg-muted/30 rounded-2xl" />
        <div className="h-6 w-96 bg-muted/20 rounded-2xl" />
      </div>
      <div className="mx-4 p-8 rounded-[2.5rem] bg-muted/10 border border-border/20 h-32" />
      <div className="mx-4 space-y-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 pl-14">
            <div className="absolute left-4 h-9 w-9 rounded-full bg-muted/30" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-3 items-center">
                <div className="h-6 w-16 bg-muted/30 rounded-xl" />
                <div className="h-5 w-64 bg-muted/20 rounded-2xl" />
              </div>
              <div className="h-4 w-full max-w-[500px] bg-muted/15 rounded-2xl" />
              <div className="h-4 w-48 bg-muted/10 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GlobalTimelinePage() {
  return (
    <SectionErrorBoundary>
      <TimelineContent />
    </SectionErrorBoundary>
  );
}

function TimelineContent() {
  const { region } = useRegion();

  return <TimelineRegionContent key={region} region={region} />;
}

function TimelineRegionContent({ region }: { region: "US" | "IN" }) {
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filterConfig = useMemo(
    () => EVENT_FILTERS.find((f) => f.key === activeFilter) || EVENT_FILTERS[0],
    [activeFilter],
  );
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("region", region);
    params.set("limit", "60");
    if (filterConfig.types) params.set("type", filterConfig.types);
    return params.toString();
  }, [region, filterConfig.types]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ success: boolean; events: IntelligenceEvent[] }>(
    `/api/intelligence/feed?${queryString}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      keepPreviousData: true,
      revalidateIfStale: true,
    }
  );

  const events = useMemo(() => (data?.success ? data.events : []), [data]);
  const renderableEvents = useMemo(
    () =>
      events.filter(
        (event): event is IntelligenceEvent & { asset: NonNullable<IntelligenceEvent["asset"]> } =>
          Boolean(event.asset),
      ),
    [events],
  );

  const isRecent = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return now.getTime() - date.getTime() < 24 * 60 * 60 * 1000;
  };

  if (isLoading || (!data && isValidating)) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-4 mt-10 rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Feed unavailable</p>
        <p className="mt-3 text-sm text-muted-foreground">We could not load the intelligence stream for the selected filters.</p>
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-5 rounded-2xl border border-border/60 bg-card/60 px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground hover:border-primary/40"
        >
          Retry
        </button>
      </div>
    );
  }

  const highImpactCount = renderableEvents.filter((e) => e.severity === "HIGH").length;
  const newsCount = renderableEvents.filter((e) => e.type === "NEWS").length;
  const insiderCount = renderableEvents.filter((e) => e.type === "INSIDER").length;
  const earningsCount = renderableEvents.filter((e) => e.type === "EARNINGS").length;
  return (
    <div className="relative space-y-6 sm:space-y-10 pb-6 p-3 sm:p-4 md:p-6">
      <div className="relative z-10 animate-slide-up-fade">
        <PageHeader
          icon={<Zap className="h-5 w-5" />}
          title="Market Events"
          eyebrow="Earnings, news, insider moves, alerts"
          chips={
            <>
              {highImpactCount > 0 && (
                <StatChip value={highImpactCount} label="High" variant="red" />
              )}
              <StatChip value={renderableEvents.length} label="Events" variant="amber" />
              {newsCount > 0 && <StatChip value={newsCount} label="News" />}
              {insiderCount > 0 && <StatChip value={insiderCount} label="Insider" variant="blue" />}
              {earningsCount > 0 && <StatChip value={earningsCount} label="Earnings" variant="green" />}
              <StatChip value={region} label="Market" variant="muted" />
            </>
          }
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {EVENT_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => {
              if (activeFilter === filter.key) return;
              setActiveFilter(filter.key);
            }}
            className={cn(
              "px-3 sm:px-4 py-2 rounded-2xl sm:rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-300 border min-h-[38px]",
              activeFilter === filter.key
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-card/40 text-muted-foreground border-border/30 hover:border-primary/30 hover:text-foreground",
            )}
          >
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      {isValidating && (
        <div className="mx-4 -mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Refreshing feed...</p>
        </div>
      )}

      {/* BLUF Global Deck */}
      <div className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] bg-linear-to-br from-primary/10 via-background/40 to-transparent border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl -z-10" />
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <div className="p-5 rounded-3xl bg-primary/20 text-primary border border-primary/30">
            <Bot className="h-8 w-8" />
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-lg font-bold tracking-tight">
              {renderableEvents.length} events from {new Set(renderableEvents.map(e => {
                const p = (e.metadata?.provider as string) || "yahoo";
                return p;
              })).size} sources.
              {highImpactCount > 3 ? " Elevated alert activity detected." : " Market flow is stable."}
              {insiderCount > 0 ? ` ${insiderCount} insider transactions tracked.` : ""}
              {earningsCount > 0 ? ` ${earningsCount} earnings events in window.` : ""}
            </h3>
          </div>
        </div>
        <div className="absolute top-4 right-6 opacity-30 select-none">
          <Zap className="h-20 w-20 text-primary" />
        </div>
      </div>

      {/* Main Feed */}
      <div className="space-y-8 sm:space-y-12 relative before:absolute before:left-[17px] before:top-4 before:bottom-4 before:w-px before:bg-linear-to-b before:from-primary/40 before:via-border/20 before:to-transparent">
        {renderableEvents.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-4xl border border-dashed border-border">
            <Newspaper className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              No Events For {region} / {filterConfig.label}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/75">
              Try changing market or feed type filters.
            </p>
          </div>
        ) : (
          renderableEvents.map((event, index) => {
            const recent = isRecent(event.date);
            const showRecentPulse = recent && index < 3;
            const metadata = event.metadata || {};
            const assetInfo = event.asset;
            const provider = String(metadata.provider || "") || undefined;
            const sentiment = String(metadata.sentiment || "") || undefined;
            const link = String(metadata.link || "") || undefined;
            const action = String(metadata.action || "") || undefined;
            const surprise = metadata.surprise != null ? Number(metadata.surprise) : null;
            const isUpcoming = !!metadata.isUpcoming;
            const assetLabel = getFriendlySymbol(assetInfo.symbol, assetInfo.type, assetInfo.name);

            return (
              <div key={event.id} className="relative pl-12 sm:pl-14 group">
                {/* Timeline Marker */}
                <div
                  className={cn(
                    "absolute left-0 top-0 h-9 w-9 rounded-full border-4 border-background flex items-center justify-center z-10 transition-all duration-300 group-hover:scale-110",
                    getEventColor(event.type, event.severity),
                  )}
                >
                  {showRecentPulse && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-inherit opacity-20" />
                  )}
                  {getEventIcon(event.type)}
                </div>

                <div className="space-y-2.5">
                  {/* Badges row + timestamp */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5 sm:pb-0 flex-nowrap sm:flex-wrap">
                      {/* Asset Badge */}
                      <Link href={`/dashboard/assets/${assetInfo.symbol}`}>
                        <Badge className="bg-foreground text-background hover:bg-foreground/90 font-bold tracking-tighter cursor-pointer min-h-[38px] flex items-center px-3">
                          {assetLabel}
                        </Badge>
                      </Link>

                      {/* Type Badge */}
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-muted/50 text-muted-foreground border border-border/30">
                        {event.type}
                      </span>

                      {/* Sentiment Badge */}
                      {sentiment && (
                        <div
                          className={cn(
                            "px-2 py-0.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-1",
                            sentiment === "POSITIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : sentiment === "NEGATIVE"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          )}
                        >
                          {sentiment === "POSITIVE" ? "Bullish" : sentiment === "NEGATIVE" ? "Bearish" : "Neutral"}
                        </div>
                      )}

                      {/* Insider action badge */}
                      {event.type === "INSIDER" && action && (
                        <div className={cn(
                          "px-2 py-0.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest border",
                          action === "BUY"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20",
                        )}>
                          {action === "BUY" ? "Buy" : "Sell"}
                        </div>
                      )}

                      {/* Earnings surprise badge */}
                      {event.type === "EARNINGS" && surprise !== null && (
                        <div className={cn(
                          "px-2 py-0.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest border",
                          surprise > 0
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20",
                        )}>
                          {surprise > 0 ? "+" : ""}{surprise.toFixed(1)}% Surprise
                        </div>
                      )}

                      {/* Upcoming earnings badge */}
                      {event.type === "EARNINGS" && isUpcoming && (
                        <div className="px-2 py-0.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Upcoming
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      {getProviderBadge(provider)}
                      <span
                        title={new Date(event.date).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        className="text-[10px] font-bold text-muted-foreground/75 dark:text-muted-foreground opacity-90 dark:opacity-30 whitespace-nowrap uppercase tracking-widest bg-muted/30 px-2 py-1 rounded-xl"
                      >
                        {formatRelativeTime(event.date)}
                      </span>
                    </div>
                  </div>

                  {/* Title on its own line */}
                  <h4 className="text-base sm:text-[17px] font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {event.title}
                  </h4>

                  <div className="relative">
                    <p className="text-sm leading-relaxed text-muted-foreground font-medium max-w-[700px] italic">
                      {event.description}
                    </p>

                    <div className="flex gap-3 mt-3">
                      {link && (
                        <a
                          href={String(link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[38px] items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest bg-primary/5 px-2.5 py-1 rounded-2xl border border-primary/10"
                        >
                          Source <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      <Link
                        href={`/dashboard/assets/${assetInfo.symbol}`}
                        className="inline-flex min-h-[38px] items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest bg-muted/20 px-2.5 py-1 rounded-2xl border border-border"
                      >
                        Analyze {assetLabel}{" "}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Metadata Tags (for non-news events) */}
                  {event.type !== "NEWS" && metadata && (
                    <div className="flex flex-wrap gap-2 pt-1 opacity-60">
                      {Object.entries(metadata)
                        .filter(([k]) => !["link", "provider", "sentiment", "action", "isUpcoming", "surprise"].includes(k))
                        .slice(0, 6)
                        .map(([k, v]) => (
                          <div
                            key={k}
                            className="px-2 py-0.5 rounded-xl bg-muted text-[8px] font-bold uppercase tracking-widest text-muted-foreground"
                          >
                            {k}:{" "}
                            <span className="text-foreground">
                              {typeof v === "number" ? v.toFixed(2) : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
