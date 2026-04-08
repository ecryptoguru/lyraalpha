"use client";

import { DiscoveryMarketPulse } from "@/components/dashboard/discovery-market-pulse";
import { DiscoverySectorGrid } from "@/components/dashboard/discovery-sector-grid";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { Globe } from "lucide-react";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { useRegion } from "@/lib/context/RegionContext";

export default function DiscoveryStocksPage() {
  const { region } = useRegion();

  return (
    <SectionErrorBoundary>
      <div className="relative flex flex-col gap-4 md:gap-8 p-3 sm:p-4 md:p-6 pb-6 min-w-0 overflow-x-hidden" suppressHydrationWarning>
        <div className="relative z-10 animate-slide-up-fade">
          <PageHeader
            icon={<Globe className="h-5 w-5" />}
            title="Sector Pulse"
            eyebrow="Where the groups are moving"
            chips={
              <>
                <StatChip value={region} label="Market" variant="muted" />
                <StatChip value="Current" label="Status" variant="green" />
              </>
            }
          />
        </div>

        <div className="animate-slide-up-fade animation-delay-200 space-y-6">
          <DiscoveryMarketPulse />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold tracking-tighter uppercase premium-gradient-text">
                Sector Themes
              </h2>
              <span className="text-[9px] font-bold text-muted-foreground/80 dark:text-muted-foreground uppercase tracking-widest opacity-90 dark:opacity-40">
                Regime-Scored
              </span>
            </div>
            <DiscoverySectorGrid />
          </div>
        </div>
      </div>
    </SectionErrorBoundary>
  );
}
