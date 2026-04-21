"use client";

import dynamic from "next/dynamic";

const NavbarAuthControls = dynamic(
  () => import("@/components/layout/navbar-auth-controls").then((mod) => mod.NavbarAuthControls),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-20 animate-pulse rounded-full border border-border/50 bg-white/60 dark:border-white/12 dark:bg-white/10" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-warning/60 shadow-[0_12px_40px_rgba(245,158,11,0.16)]" />
      </div>
    ),
  },
);

export function NavbarAuthControlsSlot() {
  return <NavbarAuthControls />;
}
