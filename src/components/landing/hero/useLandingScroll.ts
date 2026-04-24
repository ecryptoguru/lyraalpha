"use client";

import { useEffect, useRef } from "react";

/**
 * Track scroll progress within the landing page's scrollable <main> container.
 * Returns a ref to attach to the element that should receive parallax transforms.
 * Maps scroll position within the hero (0 at top → 1 at bottom) to translateY and opacity.
 */
export function useLandingScrollParallax({
  translateY = -80,
  opacityStart = 0.6,
}: { translateY?: number; opacityStart?: number } = {}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(
      'main[data-scroll-root="landing"]'
    );
    if (!scroller || !ref.current) return;

    const hero = ref.current.closest("section");
    if (!hero) return;

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const heroRect = hero.getBoundingClientRect();
        const heroTop = heroRect.top;
        const heroHeight = heroRect.height;
        // Normalized 0→1 as hero exits viewport (top goes from 0 to -heroHeight)
        const progress = Math.max(0, Math.min(1, -heroTop / heroHeight));
        const y = progress * translateY;
        const opacity =
          progress > opacityStart
            ? 1 - ((progress - opacityStart) / (1 - opacityStart)) * 0.8
            : 1;

        if (ref.current) {
          ref.current.style.transform = `translateY(${y}px)`;
          ref.current.style.opacity = `${Math.max(0.2, opacity)}`;
        }
      });
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [translateY, opacityStart]);

  return ref;
}
