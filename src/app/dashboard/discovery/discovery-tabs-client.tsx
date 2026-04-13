"use client";

import { DiscoveryFeed } from "@/components/dashboard/discovery-feed";
import type { DiscoveryFeedResponse } from "@/lib/services/discovery-feed.service";

export function DiscoveryTabsClient({
  initialData,
  initialRegion,
}: {
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
