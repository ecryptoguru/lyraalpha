"use client";

import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function NavbarSurface({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer setMounted to avoid cascading renders lint warning
    const id = requestAnimationFrame(() => setMounted(true));
    const scrollRoot = document.querySelector("[data-scroll-root='landing']");
    const target = scrollRoot instanceof HTMLElement ? scrollRoot : window;
    const readScrollTop = () =>
      scrollRoot instanceof HTMLElement ? scrollRoot.scrollTop : window.scrollY;
    const onScroll = () => setIsScrolled(readScrollTop() > 28);

    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(id);
      target.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav
      suppressHydrationWarning
      className="fixed left-3 right-3 top-3 z-50 mx-auto max-w-7xl sm:left-4 sm:right-4 sm:top-4"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.75rem] border transition-all duration-500",
          !mounted || !isScrolled
            ? "border-border/80 bg-white/72 backdrop-blur-xl dark:border-white/8 dark:bg-[#07111f]/56"
            : "border-border/50 bg-white/88 shadow-[0_22px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111f]/82 dark:shadow-[0_22px_70px_rgba(0,0,0,0.42)]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.65),transparent_22%,transparent_78%,rgba(0,212,255,0.10))] dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.04),transparent_22%,transparent_78%,rgba(0,212,255,0.12))]" />
        <div className="relative flex h-[72px] items-center justify-between gap-3 px-4 sm:h-18 sm:px-5">
          {children}
        </div>
      </div>
    </nav>
  );
}
