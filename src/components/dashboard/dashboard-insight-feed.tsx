import Link from "next/link";
import { ArrowRight, BellRing, BriefcaseBusiness, Radar, TrendingUp } from "lucide-react";
import type { DashboardInsightFeedItem } from "@/lib/services/dashboard-home.service";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";

function iconForType(type: DashboardInsightFeedItem["type"]) {
  switch (type) {
    case "portfolio":
      return BriefcaseBusiness;
    case "opportunity":
      return Radar;
    case "risk":
      return BellRing;
    default:
      return TrendingUp;
  }
}

function toneClasses(tone: DashboardInsightFeedItem["tone"]) {
  switch (tone) {
    case "positive":
      return {
        panel: "border-emerald-500/20 bg-emerald-500/5",
        badge: "text-emerald-400",
      };
    case "warning":
      return {
        panel: "border-amber-500/20 bg-amber-500/5",
        badge: "text-amber-400",
      };
    default:
      return {
        panel: "border-white/10 bg-background/60",
        badge: "text-primary",
      };
  }
}

export function DashboardInsightFeed({ items }: { items: DashboardInsightFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 text-sm text-muted-foreground">
        Fresh mixed insights will appear here once your daily brief, portfolio context and opportunity signals are available.
      </div>
    );
  }

  const featured = items[0] ?? null;
  const secondaryItems = items.slice(1);

  return (
    <div className="space-y-4 md:space-y-6">
      {featured ? (() => {
        const Icon = iconForType(featured.type);
        const tone = toneClasses(featured.tone);

        return (
          <div className={`rounded-3xl border shadow-xl p-6 md:p-7 backdrop-blur-xl ${tone.panel}`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div className="space-y-4 min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/85">
                    Top priority
                  </span>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${tone.badge}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>{featured.badge}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{featured.title}</h3>
                  <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">{featured.summary}</p>
                </div>
              </div>
              <ShareInsightButton share={featured.share} label="Share" className="shrink-0" />
            </div>

            <Link
              href={featured.href}
              className="mt-5 inline-flex min-h-[38px] items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary hover:text-primary/80 transition-colors"
            >
              Open top insight
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        );
      })() : null}

      {secondaryItems.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          {secondaryItems.map((item) => {
            const Icon = iconForType(item.type);
            const tone = toneClasses(item.tone);

            return (
              <div key={item.id} className={`rounded-2xl border shadow-xl p-5 backdrop-blur-xl ${tone.panel}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${tone.badge}`} />
                      <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>{item.badge}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.summary}</p>
                    </div>
                  </div>
                  <ShareInsightButton share={item.share} label="Share" className="shrink-0" />
                </div>

                <Link
                  href={item.href}
                  className="mt-4 inline-flex min-h-[38px] items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary hover:text-primary/80 transition-colors"
                >
                  Open insight
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
