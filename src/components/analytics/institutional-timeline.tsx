"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  BarChart3,
  Newspaper,
  ShieldAlert,
  Bot,
  ExternalLink,
} from "lucide-react";

interface InstitutionalEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  severity: string;
  date: string;
  metadata?: Record<string, unknown> | null;
}

interface InstitutionalTimelineProps {
  events: InstitutionalEvent[];
  className?: string;
}

export function InstitutionalTimeline({
  events,
  className,
}: InstitutionalTimelineProps) {
  const formatMetadataLabel = (value: string) => value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  const isRecent = (date: string) => {
    const eventDate = new Date(date);
    const now = new Date();
    return now.getTime() - eventDate.getTime() < 24 * 60 * 60 * 1000;
  };

  if (!events || events.length === 0) {
    return (
      <div
        className={cn(
          "backdrop-blur-2xl border border-dashed border-primary/20 bg-primary/5 shadow-xl p-6 rounded-3xl flex flex-col items-start gap-3",
          className,
        )}
      >
        <div className="p-2.5 rounded-2xl bg-primary/10">
          <Bot className="h-5 w-5 text-primary/50" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Recent market signals
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            There are no fresh market or news events to review yet. This section will populate when the system detects something worth scanning.
          </p>
        </div>
      </div>
    );
  }

  // AI Insights - Deterministic Summary

  const generateBluf = () => {
    const recentEvents = events.slice(0, 5);
    const hasBreakout = recentEvents.some((e) => e.title.includes("Breakout"));
    const newsSentiments = recentEvents
      .filter((e) => e.type === "NEWS")
      .map(
        (e) =>
          (e.metadata as Record<string, string | number | undefined>)
            ?.sentiment,
      );

    const positiveNews = newsSentiments.filter((s) => s === "POSITIVE").length;
    const negativeNews = newsSentiments.filter((s) => s === "NEGATIVE").length;

    if (hasBreakout && positiveNews > negativeNews)
      return "Breakout conditions are being reinforced by supportive news flow.";
    if (negativeNews > positiveNews)
      return "News flow has turned more cautious, so risk appetite may stay under pressure.";
    if (positiveNews > 0)
      return "News catalysts are offering a supportive backdrop for current price action.";
    if (hasBreakout)
      return "Price action is showing a constructive breakout pattern worth monitoring.";
    return "The setup is still waiting for a clearer catalyst from price action or the news flow.";
  };

  const bluf = generateBluf();
  const visibleEvents = events.slice(0, 4);

  return (
    <div
      className={cn(
        "backdrop-blur-2xl border border-primary/10 bg-muted/5 shadow-xl p-4 sm:p-6 rounded-3xl relative overflow-hidden",
        className,
      )}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -z-10" />

      <div className="flex flex-col gap-2 mb-5">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            Recent market signals
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {bluf}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/40 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {events.length} events in focus
          </span>
        </div>
      </div>

      <div className="space-y-5 relative before:absolute before:left-[14px] before:top-3 before:bottom-3 before:w-px before:bg-linear-to-b before:from-primary/30 before:via-border/20 before:to-transparent">
        {visibleEvents.map((event) => {
          const recent = isRecent(event.date);
          const metadata = event.metadata as Record<
            string,
            string | number | undefined
          >;

          return (
            <div key={event.id} className="relative pl-11 group">
              <div
                className={cn(
                  "absolute left-0 top-0 h-7 w-7 rounded-full border-4 border-background flex items-center justify-center z-10 transition-all duration-300 group-hover:scale-105",
                  event.severity === "HIGH"
                    ? "bg-danger text-danger-foreground shadow-danger/30"
                    : event.severity === "MEDIUM"
                      ? "bg-warning text-warning-foreground shadow-warning/30"
                      : "bg-primary text-primary-foreground shadow-primary/30",
                )}
              >
                {recent && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-inherit opacity-20" />
                )}
                {event.type === "TECHNICAL" ? (
                  <TrendingUp className="h-4 w-4" />
                ) : event.type === "FUNDAMENTAL" ? (
                  <BarChart3 className="h-4 w-4" />
                ) : event.type === "NEWS" ? (
                  <Newspaper className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {event.title}
                    </h4>

                    <span className="px-2 py-0.5 rounded-2xl bg-muted/60 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border border-white/5">
                      {event.type}
                    </span>

                    {event.type === "NEWS" && metadata?.sentiment && (
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded-2xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-1",
                          metadata.sentiment === "POSITIVE"
                            ? "bg-success/10 text-success border border-success/20"
                            : metadata.sentiment === "NEGATIVE"
                              ? "bg-danger/10 text-danger border border-danger/20"
                              : "bg-warning/10 text-warning border border-warning/20",
                        )}
                      >
                        {metadata.sentiment === "POSITIVE"
                          ? "Positive"
                          : metadata.sentiment === "NEGATIVE"
                            ? "Negative"
                            : "Neutral"}
                      </div>
                    )}
                  </div>
                  <span 
                    className="text-[10px] font-bold text-muted-foreground opacity-30 whitespace-nowrap uppercase tracking-widest bg-muted/30 px-2 py-1 rounded-xl"
                    suppressHydrationWarning
                  >
                    {new Date(event.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="relative">
                  <p className="text-xs leading-relaxed text-muted-foreground max-w-[640px] line-clamp-2">
                    {event.description || "The system flagged this item as worth monitoring, but there is not enough detail yet to add a fuller explanation."}
                  </p>

                  {event.type === "NEWS" && metadata?.link && (
                    <a
                      href={String(metadata.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest bg-primary/5 px-2.5 py-1 rounded-2xl border border-primary/10"
                    >
                      Analyze Source <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                {event.metadata && event.type !== "NEWS" && Object.keys(metadata || {}).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(metadata || {}).map(([k, v]) => (
                      <div
                        key={k}
                        className="px-2.5 py-1 rounded-2xl bg-background/50 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/30"
                      >
                        {formatMetadataLabel(k)}:{" "}
                        <span className="text-primary">
                          {typeof v === "number" ? v.toFixed(1) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {events.length > visibleEvents.length ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing the latest {visibleEvents.length} events. Open the market events view for the full history.
        </p>
      ) : null}
    </div>
  );
}
