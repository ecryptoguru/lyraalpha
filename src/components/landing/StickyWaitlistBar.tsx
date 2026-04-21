"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

export function StickyWaitlistBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>("[data-scroll-root='landing']");
    if (!scroller) return;
    const onScroll = () => {
      setVisible(scroller.scrollTop > scroller.clientHeight * 0.8);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-50 transition-transform duration-500 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="relative border-t border-white/10 bg-[#040816]/90 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-info/50 to-transparent" />

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-info/25 bg-info/8 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-info sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
              Beta · Open
            </span>
            <p className="truncate font-mono text-[11px] text-white/55 sm:text-xs">
              Free ELITE access during Beta &mdash; 300 credits, no card required.
            </p>
          </div>

          <Link
            href="/sign-up"
            className="group shrink-0 inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning px-5 py-2.5 font-mono text-[11px] font-bold text-warning-foreground shadow-warning/25 transition-all duration-300 hover:bg-warning/90 hover:shadow-warning/40 sm:text-xs"
          >
            <Zap className="h-3 w-3" />
            Sign Up Free
            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
