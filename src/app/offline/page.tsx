"use client";

import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-8 text-center shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary">
            <WifiOff className="h-7 w-7" />
          </div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.28em] text-primary/70">Offline mode</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">You&apos;re offline right now.</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Your internet connection appears to be unavailable. Reconnect to continue using dashboard systems, market data, and account surfaces.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    </main>
  );
}
