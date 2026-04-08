"use client";

import { RefreshCw } from "lucide-react";

export function DiscoveryRefreshButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="inline-flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-background/60 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-all hover:border-primary/30 hover:text-primary"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Refresh feed
    </button>
  );
}
