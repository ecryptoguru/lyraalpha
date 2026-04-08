"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ScrollToSectionButton } from "@/components/landing/scroll-to-section-button";
import { PRELAUNCH_WAITLIST_SECTION_ID } from "@/lib/config/prelaunch";

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
      {/* Backdrop blur bar */}
      <div className="relative border-t border-white/10 bg-[#040816]/90 backdrop-blur-xl">
        {/* Top amber line */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/50 to-transparent" />

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Left: message */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/8 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-amber-300 sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Limited spots
            </span>
            <p className="truncate font-mono text-[11px] text-white/55 sm:text-xs">
              Early access cohort open &mdash; priority pricing locked for early members.
            </p>
          </div>

          {/* Right: CTA */}
          <ScrollToSectionButton
            targetId={PRELAUNCH_WAITLIST_SECTION_ID}
            className="group shrink-0 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400 px-5 py-2.5 font-mono text-[11px] font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all duration-300 hover:bg-amber-300 hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] sm:text-xs"
          >
            Claim Early Access
            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </ScrollToSectionButton>
        </div>
      </div>
    </div>
  );
}
