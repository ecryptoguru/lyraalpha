"use client";

import { DiscoveryFeed } from "@/components/dashboard/discovery-feed";
import type { DiscoveryFeedResponse } from "@/lib/services/discovery-feed.service";

export function DiscoveryTabsClient({
  initialData,
  initialRegion,
}: {
  initialTab?: "radar" | "sectors";
  initialData?: DiscoveryFeedResponse;
  initialRegion?: "US" | "IN";
}) {
  return (
    <DiscoveryFeed
      initialData={initialData}
      initialRegion={initialRegion}
    />
  );
}
