import { DashboardMarketBriefCard } from "@/components/dashboard/dashboard-market-brief-card";
import { DashboardFeedPreviews } from "@/components/dashboard/dashboard-feed-previews";
import { DashboardInsightFeed } from "@/components/dashboard/dashboard-insight-feed";
import { PushNotificationToggle } from "@/components/dashboard/push-notification-toggle";
import { DashboardHomeService } from "@/lib/services/dashboard-home.service";
import type { Region } from "@/lib/context/RegionContext";
import type { PlanTier } from "@/lib/ai/config";

export async function DashboardHomeContent({
  userId,
  region,
  plan,
}: {
  userId: string | null;
  region: Region;
  plan: PlanTier;
}) {
  const home = userId ? await DashboardHomeService.getShell(userId, region, plan) : null;

  return (
    <>
      {/* Brief + Where to go next */}
      <div id="market-intelligence" className="relative z-10 animate-slide-up-fade animation-delay-100">
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
          <DashboardMarketBriefCard briefing={home?.dailyBriefing ?? null} narrativePreview={home?.narrativePreview ?? null} />
        </div>
      </div>

      {/* Feed previews */}
      <div className="relative z-10 space-y-3 animate-slide-up-fade animation-delay-200">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Today&apos;s feeds</p>
        <DashboardFeedPreviews
          portfolioPreview={home?.portfolioPreview ?? null}
          discoveryPreview={home?.discoveryPreview ?? []}
        />
      </div>

      {/* Insight feed */}
      <div className="relative z-10 space-y-3 animate-slide-up-fade animation-delay-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Insight feed</p>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Ranked by what to act on</h2>
          </div>
          <div className="shrink-0">
            <PushNotificationToggle />
          </div>
        </div>
        <DashboardInsightFeed items={home?.insightFeed ?? []} />
      </div>
    </>
  );
}
