"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@/lib/clerk-shim";
import { ChevronRight } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { useDashboardPoints } from "@/hooks/use-dashboard-points";

type SidebarUser = {
  firstName?: string | null;
  fullName?: string | null;
  imageUrl?: string | null;
};

export function SidebarDeferredExtras({
  isEliteEquivalent,
  isLoaded,
  planLabel,
  user,
}: {
  isEliteEquivalent: boolean;
  isLoaded: boolean;
  planLabel: string;
  user?: SidebarUser | null;
}) {
  const { mounted, points } = useDashboardPoints();
  const sidebarCredits = points?.credits ?? 0;
  const sidebarXP = {
    credits: points?.credits ?? 0,
    xp: points?.xp ?? 0,
    level: points?.level ?? 1,
    tierName: points?.tierName ?? "Beginner",
    tierEmoji: points?.tierEmoji ?? "🌱",
    progressPercent: points?.progressPercent ?? 0,
  };
  const maxCredits = isEliteEquivalent ? 1500 : planLabel === "Pro" ? 500 : 50;
  const creditsProgressPercent =
    sidebarCredits > 0 ? Math.min(100, Math.max(0, (sidebarCredits / maxCredits) * 100)) : 0;

  return (
    <>
      <div className="mb-3 group-data-[collapsible=icon]:hidden">
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-lg backdrop-blur-2xl">
          <Link
            href="/dashboard/rewards?tab=credits"
            className="group/credits flex items-center justify-between border-b border-border/40 px-4 py-3 transition-colors duration-200 hover:bg-primary/5"
          >
            <div className="mr-3 min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {planLabel} Plan
                </span>
                <span className="ml-auto text-[9px] font-bold tabular-nums text-primary/80">
                  {mounted ? `${creditsProgressPercent > 100 ? "100+" : creditsProgressPercent.toFixed(0)}%` : "--"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold leading-tight text-primary tabular-nums">
                  {mounted ? sidebarXP.credits.toLocaleString() : "--"}
                  <span className="ml-1 text-[9px] font-bold text-muted-foreground">credits</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-700"
                  style={{ width: `${mounted ? creditsProgressPercent : 0}%` }}
                />
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-200 group-hover/credits:translate-x-0.5 group-hover/credits:text-primary" />
          </Link>

          <Link
            href="/dashboard/rewards?tab=xp"
            className="group/xp hidden items-center justify-between px-4 py-3 transition-colors duration-200 hover:bg-amber-500/5 md:flex"
          >
            <div className="mr-3 min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-amber-500/20 bg-amber-500/10 text-[10px]">
                  {mounted ? sidebarXP.tierEmoji : "🌱"}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 transition-colors group-hover/xp:text-amber-500/80">
                  {mounted ? sidebarXP.tierName : "Beginner"}
                </span>
                <span className="ml-auto text-[9px] font-bold tabular-nums text-amber-500/80">
                  Lv {mounted ? sidebarXP.level : 1}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold leading-tight text-amber-500 tabular-nums">
                  {mounted ? sidebarXP.xp.toLocaleString() : "--"}
                  <span className="ml-1 text-[9px] font-bold text-muted-foreground">XP</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-amber-500/60 transition-all duration-700"
                  style={{ width: `${mounted ? sidebarXP.progressPercent : 0}%` }}
                />
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover/xp:translate-x-0.5 group-hover/xp:text-amber-500" />
          </Link>
        </div>
      </div>

      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-4">
            <div className="group/profile relative flex-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-none">
              {isLoaded ? (
                <div className="pointer-events-none absolute opacity-0">
                  <UserButton />
                </div>
              ) : null}
              <button
                onClick={() => {
                  const clerkButton = document.querySelector(".cl-userButtonTrigger") as HTMLButtonElement | null;
                  clerkButton?.click();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border/75 bg-white/80 p-2 backdrop-blur-2xl transition-all duration-300 hover:border-border hover:bg-white hover:shadow-lg hover:shadow-black/10 dark:border-white/5 dark:bg-white/5 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:shadow-black/20 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
              >
                <div className="relative size-10 shrink-0 overflow-hidden rounded-2xl bg-linear-to-br from-slate-200 to-slate-300 p-[2px] transition-transform duration-300 group-hover/profile:scale-105 dark:from-neutral-800 dark:to-black">
                  <div className="absolute inset-0 bg-linear-to-br from-primary to-transparent opacity-20" />
                  <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-white dark:bg-black">
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName || "User"}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {user?.firstName?.[0] ?? "U"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-foreground transition-colors group-hover/profile:text-primary dark:text-white">
                    {user?.fullName || "Trader"}
                  </span>
                  <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                    {planLabel} Plan
                  </span>
                </div>
              </button>
            </div>

            <div className="group-data-[collapsible=icon]:hidden">
              <ThemeToggle includeSystem={false} />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
