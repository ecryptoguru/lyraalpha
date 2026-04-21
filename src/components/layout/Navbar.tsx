import Image from "next/image";
import Link from "next/link";

import { NavbarAuthControlsSlot } from "@/components/layout/navbar-auth-controls-slot";
import { NavbarLinks } from "@/components/layout/navbar-links";
import { NavbarSurface } from "@/components/layout/navbar-surface";

export function Navbar() {
  return (
    <NavbarSurface>
      <Link href="/" className="group flex min-w-0 items-center gap-2">
        {/* Mobile: symbol only */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-opacity duration-200 group-hover:opacity-80 sm:hidden">
          <Image
            src="/brand/lyraalpha-ai-symbol.svg"
            alt="LyraAlpha AI Logo"
            fill
            sizes="40px"
            className="object-contain p-1.5"
            priority
          />
        </div>
        {/* Desktop: full lockup + Beta badge */}
        <div className="hidden sm:flex items-center gap-2">
          <Image
            src="/brand/lyraalpha-ai-logo-lockup.svg"
            alt="LyraAlpha AI"
            width={307}
            height={95}
            priority
            className="h-[68px] w-auto object-contain transition-opacity duration-200 group-hover:opacity-80"
          />
          <span className="shrink-0 inline-flex items-center rounded-full border border-cyan-400/50 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-400 shadow-[0_0_12px_rgba(0,212,255,0.25)]">
            Beta
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <NavbarLinks />
        <NavbarAuthControlsSlot />
      </div>
    </NavbarSurface>
  );
}
