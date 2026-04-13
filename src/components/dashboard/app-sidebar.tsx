"use client";
import React, { useEffect, useState } from "react";

import {
  Bot,
  ChartLine,
  FlaskConical,
  Gift,
  GitCompare,
  Globe,
  GraduationCap,
  Newspaper,
  PieChart,
  Radar,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useUser } from "@/lib/clerk-shim";
import { usePathname } from "next/navigation";
import { usePlan } from "@/hooks/use-plan";
import Link from "next/link";
import Image from "next/image";
import { getSidebarSections, type DashboardRouteKey } from "@/lib/dashboard-routes";
import { useWatchlistDrift } from "@/hooks/use-watchlist-drift";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const navIcons: Record<DashboardRouteKey, React.ComponentType<{ className?: string }>> = {
  dashboard:          Sparkles,
  macro:              FlaskConical,
  lyra:               Bot,
  portfolio:          PieChart,
  assets:             ChartLine,
  discovery:          Radar,
  "sector-pulse":     Globe,
  narratives:         Newspaper,
  learning:           GraduationCap,
  timeline:           Zap,
  watchlist:          Star,
  compare:            GitCompare,
  "stress-test":      Shield,
  rewards:            Gift,
  settings:           Settings2,
  admin:              Shield,
  upgrade:            Sparkles,
};

const navSections = getSidebarSections();

const SidebarDeferredExtras = dynamic(
  () => import("@/components/dashboard/sidebar-deferred-extras").then((mod) => mod.SidebarDeferredExtras),
  { ssr: false },
);

function useOptionalUser() {
  try {
    return useUser();
  } catch {
    return {
      user: {
        firstName: "Test",
        fullName: "Test User",
        imageUrl: "",
        publicMetadata: { role: "admin" },
      },
      isLoaded: false,
      isSignedIn: true,
    };
  }
}

function useDeferredSidebarExtras() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled || typeof window === "undefined") return;

    const enable = () => setEnabled(true);
    const onFirstInteraction = () => enable();

    window.addEventListener("pointerdown", onFirstInteraction, { once: true, passive: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(enable, { timeout: 1400 });
      return () => {
        window.removeEventListener("pointerdown", onFirstInteraction);
        window.removeEventListener("keydown", onFirstInteraction);
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = setTimeout(enable, 1200);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      clearTimeout(timeoutId);
    };
  }, [enabled]);

  return enabled;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user, isLoaded } = useOptionalUser();
  const { plan } = usePlan();
  const { isMobile, setOpenMobile } = useSidebar();
  const showDeferredExtras = useDeferredSidebarExtras();
  const { driftCount } = useWatchlistDrift();

  const isEliteEquivalent = plan === "ELITE" || plan === "ENTERPRISE";
  const planLabel = isEliteEquivalent ? "Elite" : plan === "PRO" ? "Pro" : "Starter";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/70 bg-white/90 dark:border-white/5 dark:bg-black/55 backdrop-blur-2xl shadow-xl"
      {...props}
    >
      <SidebarHeader className="pt-5 pb-2">
        {/* Collapsed icon-only view */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center px-2 py-1">
          <Link href="/" className="flex items-center justify-center rounded-2xl size-10 bg-linear-to-br from-primary/20 to-secondary/10 border border-primary/25 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:opacity-80 transition-opacity">
            <Image src="/brand/lyraalpha-ai-symbol.svg" alt="LyraAlpha AI" width={40} height={40} className="w-full h-full object-contain p-1" />
          </Link>
        </div>
        {/* Expanded full logo view */}
        <div className="group-data-[collapsible=icon]:hidden px-2">
          <Link href="/" className="flex flex-col rounded-xl hover:bg-muted/40 dark:hover:bg-white/5 transition-colors duration-200 px-2 py-2 -mx-2 cursor-pointer">
            {/* Logo image row */}
            <div className="flex items-center gap-2">
              <Image
                src="/brand/lyraalpha-ai-logo-lockup.svg"
                alt="LyraAlpha AI"
                width={307}
                height={95}
                priority
                className="h-[78px] w-auto object-contain object-left shrink-0"
              />
              <span className="shrink-0 self-center inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-primary shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                Beta
              </span>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="mt-8 px-2">
        {navSections.map((section) => {
          const sectionItems = section.items.filter((item) => {
            if (item.adminOnly) {
              return (user?.publicMetadata as Record<string, unknown>)?.role === "admin";
            }
            if (item.eliteOnly && !isEliteEquivalent) {
              return false;
            }
            return true;
          });

          if (sectionItems.length === 0) return null;

          const isSettingsSection = section.label === "Settings";

          return (
            <SidebarGroup
              key={section.label}
              className={`group-data-[collapsible=icon]:p-0! ${
                isSettingsSection ? "mt-auto pt-3" : "mb-0 p-0"
              }`}
            >
              {/* Divider before Settings */}
              {isSettingsSection && (
                <div className="mb-2 px-2 group-data-[collapsible=icon]:hidden">
                  <div className="h-px bg-border/50" />
                </div>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-2 group-data-[collapsible=icon]:px-0!">
                  {sectionItems.map((item) => {
                    const ItemIcon = navIcons[item.key];
                    const isActive =
                      pathname === item.url ||
                      (item.url !== "/dashboard" && pathname.startsWith(`${item.url}/`));

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          className={`
                            relative h-11 rounded-2xl transition-all duration-300 ease-out overflow-hidden group/item
                            ${
                              isActive
                                ? "bg-primary/10 text-primary shadow-[0_0_12px_rgba(245,158,11,0.12)] border border-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/45 hover:border hover:border-border/70 dark:hover:bg-white/5 dark:hover:border-white/5"
                            }
                            group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:p-0!
                          `}
                        >
                          <Link
                            href={item.url}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                            className="flex items-center gap-3 w-full justify-start group-data-[collapsible=icon]:justify-center px-3"
                          >
                            <ItemIcon
                              className={`
                                size-5 shrink-0 transition-transform duration-300 group-hover/item:scale-110
                                ${isActive ? "text-primary drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]" : "opacity-70 group-hover/item:opacity-100"}
                              `}
                            />
                            <span
                              className={`
                                font-medium tracking-wide text-sm transition-all duration-300 group-data-[collapsible=icon]:hidden
                                ${isActive ? "translate-x-1" : "group-hover/item:translate-x-1"}
                              `}
                            >
                              {item.title}
                            </span>

                            {item.key === "watchlist" && driftCount > 0 && (
                              <span className="ml-auto shrink-0 inline-flex items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 min-w-[18px] h-[18px] text-[9px] font-bold text-amber-400 group-data-[collapsible=icon]:hidden">
                                {driftCount}
                              </span>
                            )}

                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_#f59e0b] group-data-[collapsible=icon]:hidden" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="pb-6 px-4">
        {showDeferredExtras ? (
          <SidebarDeferredExtras
            isEliteEquivalent={isEliteEquivalent}
            isLoaded={isLoaded}
            planLabel={planLabel}
            user={user}
          />
        ) : (
          <>
            <div className="mb-3 overflow-hidden rounded-2xl border border-border/50 bg-card/70 p-4 shadow-lg backdrop-blur-2xl group-data-[collapsible=icon]:hidden">
              <div className="mb-4 h-3 w-24 rounded-full bg-muted/40" />
              <div className="mb-2 h-4 w-28 rounded-full bg-primary/15" />
              <div className="h-1 w-full rounded-full bg-muted/50" />
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-4">
                  <div className="relative flex-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-none">
                    <div className="flex w-full items-center gap-3 rounded-2xl border border-border/75 bg-white/80 p-2 backdrop-blur-2xl dark:border-white/5 dark:bg-white/5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
                      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-slate-200 to-slate-300 p-[2px] dark:from-neutral-800 dark:to-black">
                        <div className="absolute inset-0 bg-linear-to-br from-primary to-transparent opacity-20" />
                        <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-white dark:bg-black">
                          <span className="text-sm font-bold text-primary">
                            {user?.firstName?.[0] ?? "U"}
                          </span>
                        </div>
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-semibold text-foreground dark:text-white">
                          {user?.fullName || "Trader"}
                        </span>
                        <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                          {planLabel} Plan
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden h-9 w-[92px] rounded-2xl border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur-xl group-data-[collapsible=icon]:hidden sm:block" />
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
