import { cookies } from "next/headers";
import { Radar } from "lucide-react";

import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { getDashboardViewer } from "@/lib/server/dashboard-viewer";
import { getDiscoveryFeedData } from "@/lib/services/discovery-feed.service";
import { DiscoveryTabsClient } from "./discovery-tabs-client";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const cookieStore = await cookies();
  const initialRegion = cookieStore.get("user_region_preference")?.value === "IN" ? "IN" : "US";
  const viewer = await getDashboardViewer();
  const resolvedParams = await searchParams;
  const initialTab = resolvedParams?.tab === "sectors" ? "sectors" : "radar";

  const initialData = await getDiscoveryFeedData({
    typeFilter: "CRYPTO",
    region: initialRegion,
    requestedLimit: 20,
    offset: 0,
    plan: viewer.plan,
  });

  return (
    <SectionErrorBoundary>
      <div
        className="relative flex flex-col gap-4 md:gap-8 p-3 sm:p-4 md:p-6 pb-6 min-w-0 overflow-x-hidden"
        suppressHydrationWarning
      >
        <div className="relative z-10 animate-slide-up-fade">
          <PageHeader
            icon={<Radar className="h-5 w-5" />}
            title={initialTab === "sectors" ? "Sector Pulse" : "Crypto Discovery"}
            eyebrow={initialTab === "sectors" ? "Where the groups are moving" : "On-chain signals surfaced today"}
            chips={
              <>
                {initialTab === "radar" && (
                  <StatChip
                    value={initialData.total ?? initialData.items?.length ?? 0}
                    label="Signals"
                    variant="amber"
                  />
                )}
                <StatChip value={initialRegion} label="Market" variant="muted" />
              </>
            }
          />
        </div>

        <div className="animate-slide-up-fade animation-delay-200">
          <DiscoveryTabsClient
            initialTab={initialTab}
            initialData={initialData}
            initialRegion={initialRegion}
          />
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
