"use strict";

import { Newspaper, ShieldAlert, TrendingUp, ChevronRight, Activity } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getFriendlyAssetName } from "@/lib/format-utils";

interface NewsEvent {
  id: string;
  type: string;
  title: string;
  date: Date;
  asset?: {
    symbol: string;
  };
}

interface NewsFeedProps {
  events: NewsEvent[];
}

export function NewsFeed({ events }: NewsFeedProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-2xl shadow-xl relative overflow-hidden h-full flex flex-col">
       {/* Header */}
       <div className="p-4 border-b border-white/5 flex items-center justify-between bg-muted/20">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Intelligence Stream
          </h3>
          <Link
            href="/dashboard/timeline"
            className="group/link text-[9px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            View All <ChevronRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
          </Link>
       </div>

       {/* Feed Content */}
       <div className="flex-1 overflow-y-auto will-change-scroll overscroll-contain scroll-smooth scrollbar-hide p-2 space-y-2 relative">
           {/* Decorator Line */}
           <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/40 -z-10" />

          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 min-h-[200px]">
              <Activity className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground italic">
                 No active signals in current window.
              </p>
            </div>
          ) : (
            events.map((event) => (
              <Link
                key={event.id}
                href={`/dashboard/assets/${event.asset?.symbol}`}
                className="block group/item"
              >
                <div className="flex items-start gap-3 p-2 rounded-2xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/30">
                  <div
                    className={cn(
                      "mt-0.5 w-6 h-6 rounded-xl flex items-center justify-center shrink-0 border border-white/5 bg-card z-10",
                      event.type === "NEWS" ? "text-warning" : event.type === "RISK" ? "text-danger" : "text-success"
                    )}
                  >
                    {event.type === "NEWS" ? <Newspaper className="h-3 w-3" /> : event.type === "RISK" ? <ShieldAlert className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-bold text-foreground tracking-wider uppercase">
                        {event.asset?.symbol ? getFriendlyAssetName(event.asset.symbol) : "MARKET"}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
                        {new Date(event.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground group-hover/item:text-foreground transition-colors line-clamp-2 leading-relaxed">
                      {event.title}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
       </div>
       
       <div className="p-2 border-t border-white/5 bg-muted/10 text-center">
            <span className="text-[9px] text-muted-foreground/40 font-mono">DATA FEED // ENCRYPTED</span>
       </div>
    </div>
  );
}
