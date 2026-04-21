import { DashboardMarketBriefCard } from "@/components/dashboard/dashboard-market-brief-card";
import { DashboardFeedPreviews } from "@/components/dashboard/dashboard-feed-previews";
import { DashboardInsightFeed } from "@/components/dashboard/dashboard-insight-feed";
import { PushNotificationToggle } from "@/components/dashboard/push-notification-toggle";
import { DashboardHomeAnimated } from "@/components/dashboard/dashboard-home-animated";
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
    <DashboardHomeAnimated
      briefCard={<DashboardMarketBriefCard briefing={home?.dailyBriefing ?? null} narrativePreview={home?.narrativePreview ?? null} />}
      feedPreviews={<DashboardFeedPreviews portfolioPreview={home?.portfolioPreview ?? null} discoveryPreview={home?.discoveryPreview ?? []} />}
      insightFeed={
        <>
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
        </>
      }
    />
  );
}
