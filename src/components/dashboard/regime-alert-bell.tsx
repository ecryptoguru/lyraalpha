"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, Crown, X, Activity, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFriendlyAssetName } from "@/lib/format-utils";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RegimeAlert {
  id: string;
  type: "regime_change" | "score_inflection" | "weekly_digest";
  title: string;
  body: string;
  symbol?: string;
  createdAt: string;
  read: boolean;
}

export function RegimeAlertBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);
  const { data, mutate } = useSWR<{ alerts: RegimeAlert[]; unreadCount: number }>(
    "/api/user/notifications",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const alerts = data?.alerts || [];
  const unreadCount = data?.unreadCount || 0;

  const markAllRead = async () => {
    mutate(
      (prev) => prev
        ? { ...prev, alerts: prev.alerts.map((a) => ({ ...a, read: true })), unreadCount: 0 }
        : prev,
      false,
    );
    fetch("/api/user/notifications", { method: "PATCH" }).catch((e) => console.warn("Failed to mark notification read:", e));
  };

  const getIcon = (type: RegimeAlert["type"]) => {
    switch (type) {
      case "regime_change": return <Shield className="h-3.5 w-3.5 text-primary" />;
      case "score_inflection": return <Activity className="h-3.5 w-3.5 text-amber-400" />;
      case "weekly_digest": return <Crown className="h-3.5 w-3.5 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => { setOpen((v) => !v); if (unreadCount > 0) markAllRead(); }}
        className={cn(
          "relative p-2 rounded-2xl border transition-all",
          open
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-white/5 bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-primary",
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-black text-[8px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/5 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Elite Alerts</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-2xl hover:bg-muted/30 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-bold">No alerts yet</p>
                <p className="text-[9px] text-muted-foreground/30 mt-1">Regime changes and score inflections will appear here</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "px-4 py-3 border-b border-border/20 last:border-0",
                    !alert.read && "bg-primary/3",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-2xl bg-muted/20 border border-border/30 shrink-0 mt-0.5">
                      {getIcon(alert.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-bold truncate">{alert.title}</p>
                        {!alert.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground/70 mt-0.5 leading-relaxed">{alert.body}</p>
                      {alert.symbol && (
                        <Link
                          href={`/dashboard/assets/${alert.symbol}`}
                          onClick={() => setOpen(false)}
                          className="text-[8px] font-bold text-primary/70 hover:text-primary mt-1 inline-block"
                        >
                          View {getFriendlyAssetName(alert.symbol)} →
                        </Link>
                      )}
                      <p className="text-[8px] text-muted-foreground/30 mt-1">
                        {new Date(alert.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
