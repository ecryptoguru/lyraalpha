export function DashboardHomeContentSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard content">
      <span className="sr-only">Loading market briefing, portfolio feeds, and intelligence insights…</span>

      {/* Brief skeleton */}
      <div className="relative z-10 animate-slide-up-fade animation-delay-100">
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-6 min-h-[280px] animate-pulse" />
        </div>
      </div>

      {/* Feed previews skeleton */}
      <div className="relative z-10 space-y-3 animate-slide-up-fade animation-delay-200">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Today&apos;s feeds</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 min-h-[120px] animate-pulse" />
          <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 min-h-[120px] animate-pulse" />
        </div>
      </div>

      {/* Insight feed skeleton */}
      <div className="relative z-10 space-y-3 animate-slide-up-fade animation-delay-200">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Insight feed</p>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Ranked by what to act on</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-4 min-h-[80px] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
