"use client";

import { useState, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";

import { DiscoveryFeed } from "@/components/dashboard/discovery-feed";
import { DiscoveryMarketPulse } from "@/components/dashboard/discovery-market-pulse";
import { DiscoverySectorGrid } from "@/components/dashboard/discovery-sector-grid";
import { PageTabBar } from "@/components/dashboard/page-header";
import type { DiscoveryFeedResponse } from "@/lib/services/discovery-feed.service";
import { Radar, Globe } from "lucide-react";

const TABS = [
  { key: "radar",   label: "Multibagger Radar", icon: <Radar className="h-3.5 w-3.5" /> },
  { key: "sectors", label: "Sector Pulse",       icon: <Globe className="h-3.5 w-3.5" /> },
];

export function DiscoveryTabsClient({
  initialTab,
  initialData,
  initialRegion,
}: {
  initialTab: "radar" | "sectors";
  initialData?: DiscoveryFeedResponse;
  initialRegion?: "US" | "IN";
}) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const params = new URLSearchParams();
    if (key !== "radar") params.set("tab", key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <PageTabBar
        tabs={TABS}
        active={activeTab}
        onChange={handleTabChange}
      />

      {activeTab === "radar" && (
        <DiscoveryFeed
          initialData={initialData}
          initialRegion={initialRegion}
        />
      )}

      {activeTab === "sectors" && (
        <Suspense fallback={
          <div className="space-y-3">
            <div className="h-32 rounded-3xl border border-white/10 bg-card/60 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 rounded-3xl border border-white/10 bg-card/60 animate-pulse" />
              ))}
            </div>
          </div>
        }>
          <div className="space-y-6 animate-slide-up-fade">
            <DiscoveryMarketPulse />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold tracking-tighter uppercase premium-gradient-text">
                  Sector Themes
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-widest opacity-60">
                  Regime-Scored
                </span>
              </div>
              <DiscoverySectorGrid />
            </div>
          </div>
        </Suspense>
      )}
    </div>
  );
}
