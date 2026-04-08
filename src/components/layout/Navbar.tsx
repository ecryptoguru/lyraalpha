import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { NavbarAuthControlsSlot } from "@/components/layout/navbar-auth-controls-slot";
import { NavbarLinks } from "@/components/layout/navbar-links";
import { NavbarSurface } from "@/components/layout/navbar-surface";

export function Navbar() {
  return (
    <NavbarSurface>
      <Link href="/" className="group flex min-w-0 items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3 dark:border-white/10 dark:bg-white/3">
          <Image
            src="/logo.png"
            alt="InsightAlpha AI Logo"
            fill
            sizes="40px"
            className="object-contain p-1.5"
            priority
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base dark:text-white">
              InsightAlpha AI
            </span>
            <span className="hidden rounded-full border border-amber-300/30 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.24em] text-amber-600 sm:inline-flex dark:border-amber-300/18 dark:bg-amber-300/8 dark:text-amber-100/75">
              Pre-launch
            </span>
          </div>
          {/* Mobile: Pre-launch badge below name — -ml-0.5 compensates for border visual offset */}
          <span className="-ml-0.5 mt-0.5 inline-flex sm:hidden rounded-full border border-amber-300/30 bg-amber-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.22em] text-amber-600 dark:border-amber-300/18 dark:bg-amber-300/8 dark:text-amber-100/75">
            Pre-launch
          </span>
          <p className="hidden mt-1.5 text-[10px] uppercase tracking-[0.3em] text-slate-400 sm:block dark:text-white/35">
            Market intelligence for conviction
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <NavbarLinks />
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500 lg:flex dark:border-white/8 dark:bg-white/3 dark:text-white/42">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-200" />
          Waitlist open
        </div>
        <NavbarAuthControlsSlot />
      </div>
    </NavbarSurface>
  );
}
