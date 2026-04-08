import type { PlanTier } from "@/lib/ai/config";
import { DashboardPersonalSignalsCard } from "@/components/dashboard/dashboard-personal-signals-card";
import { PersonalBriefingService } from "@/lib/services/personal-briefing.service";
import type { Region } from "@/lib/context/RegionContext";

function isEliteDashboardPlan(plan: PlanTier) {
  return plan === "ELITE" || plan === "ENTERPRISE";
}

export async function DashboardPersonalSignalsSection({
  userId,
  plan,
  region,
}: {
  userId: string | null;
  plan: PlanTier;
  region: Region;
}) {
  const locked = !isEliteDashboardPlan(plan);
  const data = !locked && userId ? await PersonalBriefingService.getBriefing(userId) : null;

  return (
    <>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Personalized signals</p>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Signals filtered to your holdings</h2>
      </div>
      <DashboardPersonalSignalsCard
        data={data}
        region={region}
        expanded={false}
        locked={locked}
      />
    </>
  );
}

export function DashboardPersonalSignalsSectionSkeleton() {
  return (
    <>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Personalized signals</p>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Signals filtered to your holdings</h2>
      </div>
      <div className="rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur-xl shadow-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="h-6 w-64 rounded bg-white/10" />
          <div className="h-20 rounded-2xl bg-white/8" />
        </div>
      </div>
    </>
  );
}
