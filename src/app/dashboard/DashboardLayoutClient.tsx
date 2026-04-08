"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { CreditDisplay } from "@/components/dashboard/credit-display";
import { NavbarSearch } from "@/components/dashboard/navbar-search";
import { RegionToggle } from "@/components/dashboard/RegionToggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { useSessionTracking } from "@/hooks/use-session-tracking";
import type { PlanTier } from "@/lib/ai/config";
import { getDashboardBreadcrumbSegments } from "@/lib/dashboard-routes";
import { PlanProvider, usePlanContext } from "@/lib/context/plan-context";
import { RegionProvider, Region } from "@/lib/context/RegionContext";

const LiveChatBubble = dynamic(
  () => import("@/components/dashboard/live-chat-bubble").then((mod) => mod.LiveChatBubble),
  { ssr: false },
);

const EliteCommandPalette = dynamic(
  () => import("@/components/dashboard/elite-command-palette").then((mod) => mod.EliteCommandPalette),
  { ssr: false },
);

const WhatsChangedCard = dynamic(
  () => import("@/components/dashboard/whats-changed-card").then((mod) => mod.WhatsChangedCard),
  { ssr: false },
);

// ─── Inner layout — reads LIVE plan from PlanProvider context ────────────────
// Must be a child of PlanProvider so usePlanContext() reflects real-time plan.

function useDeferredFeature(delay: number) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled || typeof window === "undefined") return;

    const enable = () => setEnabled(true);
    const onFirstInteraction = () => enable();

    window.addEventListener("pointerdown", onFirstInteraction, { once: true, passive: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(enable, { timeout: delay });
      return () => {
        window.removeEventListener("pointerdown", onFirstInteraction);
        window.removeEventListener("keydown", onFirstInteraction);
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = setTimeout(enable, delay);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      clearTimeout(timeoutId);
    };
  }, [delay, enabled]);

  return enabled;
}

function DashboardLayoutInner({
  children,
  initialOnboardingCompleted,
  userId,
}: {
  children: React.ReactNode;
  initialOnboardingCompleted: boolean;
  userId?: string | null;
}) {
  const pathname = usePathname();
  const ctx = usePlanContext();
  const plan = ctx?.plan ?? "STARTER";
  const isElite = plan === "ELITE" || plan === "ENTERPRISE";
  const showDeferredSurface = useDeferredFeature(900);
  const showOverlayHelpers = useDeferredFeature(1500);

  useSessionTracking({ userId });

  const breadcrumbSegments = useMemo(() => getDashboardBreadcrumbSegments(pathname), [pathname]);

  return (
    <>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "18rem",
            "--sidebar-width-mobile": "20rem",
          } as CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset
          className="bg-background flex flex-col h-dvh md:h-svh overflow-x-clip overflow-y-auto scroll-smooth will-change-scroll overscroll-contain transition-colors duration-300 min-w-0 w-full max-w-full"
          style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}
        >
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-border/30 bg-background/80 backdrop-blur-xl sticky top-0 z-50 pr-4 w-full max-w-full">
            <div className="flex items-center gap-2 px-4" suppressHydrationWarning>
              <SidebarTrigger className="-ml-1 inline-flex text-muted-foreground hover:text-foreground" />
              <Separator orientation="vertical" className="mr-2 h-4 bg-border hidden sm:block" />
              <Breadcrumb className="hidden md:flex">
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="/dashboard"
                      className="text-muted-foreground hover:text-primary transition-colors py-2 px-1 min-h-[38px] flex items-center"
                    >
                      Dashboard
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {breadcrumbSegments.map((segment, index) => {
                    const isLast = index === breadcrumbSegments.length - 1;
                    return (
                      <div key={segment.href} className="flex items-center" suppressHydrationWarning>
                        <BreadcrumbSeparator className="hidden md:block text-muted-foreground/50" />
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage className="text-foreground font-medium">
                              {segment.label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink
                              href={segment.href}
                              className="text-muted-foreground hover:text-primary transition-colors py-2 px-1 min-h-[38px] flex items-center"
                            >
                              {segment.label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </div>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              {/* Mobile Page Title */}
              <div className="md:hidden flex items-center ml-2">
                <span className="font-bold text-sm tracking-tight text-foreground/90">
                  {breadcrumbSegments.length > 0
                    ? breadcrumbSegments[breadcrumbSegments.length - 1].label
                    : pathname === "/dashboard"
                      ? "Dashboard"
                      : "LyraAlpha AI"}
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center justify-end gap-2 sm:gap-3 shrink min-w-0 overflow-hidden" suppressHydrationWarning>
              <div className="inline-flex md:hidden">
                {userId ? <CreditDisplay userId={userId} /> : null}
              </div>
              <div className="hidden md:flex items-center min-w-[320px] lg:min-w-[380px] xl:min-w-[440px]">
                <NavbarSearch desktopExpanded />
              </div>
              <div className="flex items-center md:hidden">
                <NavbarSearch />
              </div>
              <RegionToggle />
            </div>
          </header>
          {isElite && showDeferredSurface ? <WhatsChangedCard /> : null}
          <div
            className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out min-w-0 w-full max-w-full"
            suppressHydrationWarning
          >
            {children}
          </div>
        </SidebarInset>
        {pathname === "/dashboard/lyra" ? null : <LiveChatBubble />}
        {isElite && showOverlayHelpers ? <EliteCommandPalette /> : null}
        <OnboardingGate initialCompleted={initialOnboardingCompleted} />
      </SidebarProvider>
    </>
  );
}

// ─── Outer shell — sets up providers ─────────────────────────────────────────

export function DashboardLayoutClient({
  children,
  initialRegion,
  initialPlan,
  initialOnboardingCompleted,
  userId,
}: {
  children: React.ReactNode;
  initialRegion?: Region;
  initialPlan: PlanTier;
  initialOnboardingCompleted: boolean;
  userId?: string | null;
}) {
  return (
    <PlanProvider plan={initialPlan}>
      <RegionProvider initialRegion={initialRegion}>
        <DashboardLayoutInner initialOnboardingCompleted={initialOnboardingCompleted} userId={userId}>
          {children}
        </DashboardLayoutInner>
      </RegionProvider>
    </PlanProvider>
  );
}
