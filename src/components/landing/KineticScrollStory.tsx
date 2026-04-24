"use client";

import { useEffect, useRef } from "react";
import { PanelNoise } from "./scroll-story/PanelNoise";
import { PanelProcessing } from "./scroll-story/PanelProcessing";
import { PanelClarity } from "./scroll-story/PanelClarity";
import { PanelCoverage } from "./scroll-story/PanelCoverage";
import { PanelEdge } from "./scroll-story/PanelEdge";

export function KineticScrollStory() {
  const outerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scroller = outerRef.current?.closest("main") as HTMLElement | null ?? document.documentElement;
    const outer = outerRef.current;
    const track = trackRef.current;
    if (!outer || !track) return;

    let cachedOuterTop = 0;
    let cachedScrollRange = 0;
    let cachedMaxTranslate = 0;

    const recalcLayout = () => {
      const st = scroller === document.documentElement ? window.scrollY : (scroller as HTMLElement).scrollTop;
      const sTop = scroller === document.documentElement ? 0 : (scroller as HTMLElement).getBoundingClientRect().top;
      const oRect = outer.getBoundingClientRect();
      cachedOuterTop = oRect.top + st - sTop;
      cachedScrollRange = outer.offsetHeight - window.innerHeight;
      cachedMaxTranslate = track.scrollWidth - window.innerWidth;
    };

    recalcLayout();
    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const st = scroller === document.documentElement ? window.scrollY : (scroller as HTMLElement).scrollTop;
        const progress = Math.max(0, Math.min(1, (st - cachedOuterTop) / cachedScrollRange));
        track.style.transform = `translateX(${-progress * cachedMaxTranslate}px)`;
      });
    };

    const ro = new ResizeObserver(recalcLayout);
    ro.observe(outer);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div id="scroll-story" ref={outerRef} className="relative bg-[#040816]" style={{ height: "300vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-[#040816]">
        <div className="pointer-events-none absolute left-6 top-6 z-20 font-mono text-[9px] font-bold uppercase tracking-[0.35em] text-white/20">Scroll to explore →</div>
        <div className="pointer-events-none absolute right-6 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          {[...Array(5)].map((_, i) => (<div key={i} className="h-1.5 w-1.5 rounded-full bg-white/20" />))}
        </div>
        <div ref={trackRef} className="flex h-full w-max will-change-transform">
          <PanelNoise />
          <PanelProcessing />
          <PanelClarity />
          <PanelCoverage />
          <PanelEdge />
        </div>
      </div>
    </div>
  );
}
