"use client";

import { useEffect, useRef, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";

export function StickyBottomCTABar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (dismissed) return;
    const scroller = document.querySelector<HTMLElement>('[data-scroll-root="landing"]');
    if (!scroller) return;

    const heroBottom = scroller.clientHeight * 0.8;
    const onScroll = () => {
      const shouldShow = scroller.scrollTop > heroBottom;
      if (shouldShow !== visibleRef.current) {
        visibleRef.current = shouldShow;
        setVisible(shouldShow);
      }
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  if (!visible || dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" role="region" aria-label="Sign up call to action">
      <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#040816]/85 px-4 py-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-6">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Limited Access</p>
          <p className="mt-0.5 text-sm font-semibold text-white">Join 50,000+ investors — free to start</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-up" className="inline-flex items-center gap-1.5 rounded-full bg-warning px-4 py-2 font-mono text-xs font-bold text-foreground transition-colors hover:bg-warning/90">
            Sign Up Free<ArrowRight className="h-3 w-3" />
          </Link>
          <button onClick={() => setDismissed(true)} className="flex h-8 w-8 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/5 hover:text-white/60" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
