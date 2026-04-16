import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

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
          <span className="shrink-0 inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-primary shadow-[0_0_8px_rgba(245,158,11,0.15)]">
            Beta
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <NavbarLinks />
        <Link
          href="/sign-up"
          className="hidden items-center gap-2 rounded-full border border-teal-400/30 bg-teal-50/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.26em] text-teal-700 transition-colors hover:bg-teal-100 lg:flex dark:border-teal-400/20 dark:bg-teal-400/8 dark:text-teal-300 dark:hover:bg-teal-400/12"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Sign Up Free
        </Link>
        <NavbarAuthControlsSlot />
      </div>
    </NavbarSurface>
  );
}
