import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { NavbarAuthControlsSlot } from "@/components/layout/navbar-auth-controls-slot";
import { NavbarLinks } from "@/components/layout/navbar-links";
import { NavbarSurface } from "@/components/layout/navbar-surface";

export function Navbar() {
  return (
    <NavbarSurface>
      <Link href="/dashboard" className="group flex min-w-0 items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3 sm:hidden dark:border-white/10 dark:bg-white/3">
          <Image
            src="/brand/lyraalpha-ai-symbol.svg"
            alt="LyraAlpha AI Logo"
            fill
            sizes="40px"
            className="object-contain p-1.5"
            priority
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/lyraalpha-ai-logo-lockup.svg"
              alt="LyraAlpha AI"
              width={307}
              height={95}
              priority
              className="hidden h-11 w-auto object-contain sm:block"
            />
            <span className="rounded-full border border-teal-400/30 bg-teal-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.24em] text-teal-700 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-300">
              Beta
            </span>
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.3em] text-slate-400 sm:hidden dark:text-white/35">
            Crypto intelligence
          </p>
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
