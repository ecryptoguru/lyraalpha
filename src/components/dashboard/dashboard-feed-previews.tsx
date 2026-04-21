import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Radar } from "lucide-react";
import type {
  DashboardDiscoveryPreviewItem,
  DashboardPortfolioPreview,
} from "@/lib/services/dashboard-home.service";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";

function healthToneClass(healthBand: DashboardPortfolioPreview["healthBand"]): string {
  switch (healthBand) {
    case "Strong":
      return "text-success";
    case "Balanced":
      return "text-cyan-400";
    case "Fragile":
      return "text-[#FFD700]";
    case "High Risk":
      return "text-danger";
    default:
      return "text-muted-foreground";
  }
}

export function DashboardFeedPreviews({
  portfolioPreview,
  discoveryPreview,
}: {
  portfolioPreview: DashboardPortfolioPreview | null;
  discoveryPreview: DashboardDiscoveryPreviewItem[];
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
      <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Portfolio checkup</p>
            <h3 className="mt-2 text-lg font-bold tracking-tight text-foreground">See if your money needs attention</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Start with the portfolio because risk usually deserves attention before opportunity does.</p>
          </div>
          <BriefcaseBusiness className="h-4 w-4 text-primary" />
        </div>

        {portfolioPreview ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
              <p className="text-sm font-bold text-foreground">{portfolioPreview.name}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{portfolioPreview.holdingCount} holdings</span>
                <span className={healthToneClass(portfolioPreview.healthBand)}>
                  {portfolioPreview.healthBand ?? "Awaiting score"}
                </span>
              </div>
              <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Portfolio score</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="text-2xl font-bold tracking-tight text-foreground">
                    {portfolioPreview.portfolioScore != null ? portfolioPreview.portfolioScore.toFixed(1) : "--"}
                    <span className="text-sm font-semibold text-muted-foreground"> / 10</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {portfolioPreview.portfolioScoreBand ?? "Awaiting read"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {portfolioPreview.healthScore != null ? `Health score ${Math.round(portfolioPreview.healthScore)} supports the read.` : "Add holdings to unlock the score."}
                </p>
              </div>
              {portfolioPreview.alertHeadline ? (
                <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Portfolio alert</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{portfolioPreview.alertHeadline}</p>
                  {portfolioPreview.alertBody ? (
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{portfolioPreview.alertBody}</p>
                  ) : null}
                </div>
              ) : null}
              {portfolioPreview.guidanceTitle && portfolioPreview.guidanceBody ? (
                <div className="mt-3 rounded-2xl border border-warning/20 bg-warning/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-warning">{portfolioPreview.guidanceTitle}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{portfolioPreview.guidanceBody}</p>
                </div>
              ) : null}
              {portfolioPreview.missingInsight ? (
                <p className="mt-3 text-[11px] text-warning leading-relaxed">{portfolioPreview.missingInsight}</p>
              ) : null}
              {portfolioPreview.stressHeadline ? (
                <div className="mt-3 rounded-2xl border border-danger/20 bg-danger/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-danger">Stress test trigger</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{portfolioPreview.stressHeadline}</p>
                  {portfolioPreview.stressBody ? (
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{portfolioPreview.stressBody}</p>
                  ) : null}
                  <Link
                    href="/dashboard/stress-test"
                    className="mt-3 inline-flex min-h-[38px] items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-danger hover:text-danger/50 transition-colors"
                  >
                    Run stress test
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/portfolio"
                className="inline-flex min-h-[38px] items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary hover:text-primary/80 transition-colors"
              >
                {portfolioPreview.emptyReason === "no_portfolio" ? "Create portfolio" : portfolioPreview.emptyReason === "no_health_snapshot" ? "Refresh portfolio read" : "Open portfolio"}
                <ArrowRight className="h-3 w-3" />
              </Link>
              {portfolioPreview.share ? (
                <ShareInsightButton share={portfolioPreview.share} label="Share" className="text-[11px]" />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Multibagger radar</p>
            <h3 className="mt-1 text-sm font-bold tracking-tight text-foreground">Top signals today</h3>
          </div>
          <Radar className="h-4 w-4 text-primary" />
        </div>

        <div className="space-y-2">
          {discoveryPreview.length > 0 ? discoveryPreview.map((item) => (
            <Link
              key={item.id}
              href="/dashboard/discovery"
              className="block rounded-2xl border border-white/10 bg-background/60 p-4 hover:border-primary/25 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.newToday ? "new today" : item.archetype.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{item.name}</p>
                </div>
                <div className="text-right">
                  <span className="block text-[11px] font-bold text-primary">{item.radarScore != null ? `${Math.round(item.radarScore)}/100` : item.changePercent != null ? `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(1)}%` : "Locked"}</span>
                  <span className="block text-[9px] text-muted-foreground">Radar score</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.headline}</p>
              <p className="mt-2 text-[11px] text-foreground/75 leading-relaxed line-clamp-2">{item.whySurfaced}</p>
              <p className="mt-2 text-[10px] font-semibold text-primary">{item.driversLabel}</p>
            </Link>
          )) : (
            <div className="rounded-2xl border border-white/10 bg-background/60 p-4 text-xs text-muted-foreground">
              Fresh opportunities will appear here once new ranked signals are available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
