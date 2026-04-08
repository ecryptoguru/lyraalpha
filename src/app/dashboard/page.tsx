import { Suspense } from "react";
import { Home, ShieldAlert, Newspaper, Radar } from "lucide-react";
import Link from "next/link";
import { DashboardMarketBriefCard } from "@/components/dashboard/dashboard-market-brief-card";
import { DashboardFeedPreviews } from "@/components/dashboard/dashboard-feed-previews";
import { DashboardInsightFeed } from "@/components/dashboard/dashboard-insight-feed";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";
import { PushNotificationToggle } from "@/components/dashboard/push-notification-toggle";
import { DashboardHomeService } from "@/lib/services/dashboard-home.service";
import type { Region } from "@/lib/context/RegionContext";
import { getDashboardViewer } from "@/lib/server/dashboard-viewer";
import {
  DashboardPersonalSignalsSection,
  DashboardPersonalSignalsSectionSkeleton,
} from "./dashboard-personal-signals-section";


export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ market?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const marketParam = Array.isArray(resolvedSearchParams?.market)
    ? resolvedSearchParams?.market[0]
    : resolvedSearchParams?.market;
  const region: Region = marketParam === "IN" ? "IN" : "US";
  const viewer = await getDashboardViewer();
  const plan = viewer.plan;
  const home = viewer.userId ? await DashboardHomeService.getShell(viewer.userId, region, plan) : null;
  const nowIST = new Date(+new Date() + 5.5 * 60 * 60 * 1000);
  const hour = nowIST.getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const NEXT_STEPS = [
    {
      icon: <ShieldAlert className="h-5 w-5 text-rose-400" />,
      bg: "bg-rose-500/8 border-rose-500/20",
      label: "Portfolio stress",
      action: "Shock Simulator",
      href: "/dashboard/portfolio",
    },
    {
      icon: <Newspaper className="h-5 w-5 text-amber-400" />,
      bg: "bg-amber-500/8 border-amber-500/20",
      label: "Market rotation",
      action: "Market pulse",
      href: "/dashboard#market-intelligence",
    },
    {
      icon: <Radar className="h-5 w-5 text-primary" />,
      bg: "bg-primary/8 border-primary/20",
      label: "Fresh setup",
      action: "Multibagger Radar",
      href: "/dashboard/discovery",
    },
  ];

  return (
    <div className="relative flex flex-col gap-4 md:gap-6 p-3 sm:p-4 md:p-6 pb-6 min-w-0 overflow-x-hidden">
      <div className="relative z-10 animate-slide-up-fade">
        <PageHeader
          icon={<Home className="h-5 w-5" />}
          title={greeting}
          eyebrow="Your market snapshot"
          chips={
            <>
              <StatChip value={region} label="Market" variant="muted" />
              <StatChip value="Current" label="Status" variant="green" />
            </>
          }
        />
      </div>

      {/* Brief + Where to go next */}
      <div id="market-intelligence" className="relative z-10 animate-slide-up-fade animation-delay-100">
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
          <DashboardMarketBriefCard briefing={home?.dailyBriefing ?? null} narrativePreview={home?.narrativePreview ?? null} />

          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-5 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Where to go next</p>
            {NEXT_STEPS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`flex items-center gap-4 rounded-2xl border p-4 hover:brightness-110 transition-[filter,border-color,background-color] duration-200 ${s.bg}`}
              >
                <div className="shrink-0 p-2.5 rounded-2xl bg-background/40">
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{s.action}</p>
                </div>
                <svg className="h-4 w-4 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Feed previews — label only, no description */}
      <div className="relative z-10 space-y-3 animate-slide-up-fade animation-delay-200">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Today&apos;s feeds</p>
        <DashboardFeedPreviews
          portfolioPreview={home?.portfolioPreview ?? null}
          discoveryPreview={home?.discoveryPreview ?? []}
        />
      </div>

      {/* Insight feed — no description, notifications toggle inline */}
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

      <div className="relative z-10 space-y-3 animate-slide-up-fade animation-delay-200">
        <Suspense fallback={<DashboardPersonalSignalsSectionSkeleton />}>
          <DashboardPersonalSignalsSection userId={viewer.userId} plan={plan} region={region} />
        </Suspense>
      </div>
    </div>
  );
}
