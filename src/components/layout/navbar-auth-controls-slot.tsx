"use client";

import dynamic from "next/dynamic";

const NavbarAuthControls = dynamic(
  () => import("@/components/layout/navbar-auth-controls").then((mod) => mod.NavbarAuthControls),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="h-10 w-24 rounded-full border border-slate-200 bg-white/90 dark:border-white/12 dark:bg-white/3" />
        <div className="h-10 w-32 rounded-full bg-amber-400/80 shadow-[0_12px_40px_rgba(245,158,11,0.16)]" />
      </>
    ),
  },
);

export function NavbarAuthControlsSlot() {
  return <NavbarAuthControls />;
}
