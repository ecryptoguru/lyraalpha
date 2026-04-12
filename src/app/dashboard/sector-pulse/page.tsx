import { Globe } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { DiscoveryMarketPulse } from "@/components/dashboard/discovery-market-pulse";
import { DiscoverySectorGrid } from "@/components/dashboard/discovery-sector-grid";
import { SectionErrorBoundary } from "@/components/error-boundary";

export default function SectorPulsePage() {
  return (
    <SectionErrorBoundary>
      <div className="relative flex flex-col gap-6 p-3 sm:p-4 md:p-6 pb-8 min-w-0 overflow-x-hidden">

        <div className="animate-slide-up-fade">
          <PageHeader
            icon={<Globe className="h-5 w-5" />}
            title="Sector Pulse"
            eyebrow="Where the groups are moving"
          />
        </div>

        <Suspense
          fallback={
            <div className="space-y-3">
              <div className="h-32 rounded-3xl border border-white/10 bg-card/60 animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-3xl border border-white/10 bg-card/60 animate-pulse" />
                ))}
              </div>
            </div>
          }
        >
          <div className="space-y-6 animate-slide-up-fade animation-delay-100">
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

      </div>
    </SectionErrorBoundary>
  );
}
