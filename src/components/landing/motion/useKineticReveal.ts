"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function getReducedMotionState() {
  return typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : true;
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function useReducedMotion() {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionState,
    () => true, // server: assume reduced to be safe
  );
  return reduced;
}

export function useInViewOnce({ threshold = 0.15 }: { threshold?: number } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function useMagnetic(ref: React.RefObject<HTMLElement | null>, { strength = 0.35 } = {}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) * strength;
      const dy = (e.clientY - centerY) * strength;
      setPosition({ x: dx, y: dy });
    };
    const onLeave = () => setPosition({ x: 0, y: 0 });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [ref, strength, reduced]);

  return position;
}

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const kineticVariants = {
  container: {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.04, delayChildren: 0.05 },
    },
  },
  word: {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: expoOut },
    },
  },
  card: {
    hidden: { opacity: 0, y: 48, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, ease: expoOut },
    },
  },
  fadeUp: {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: expoOut },
    },
  },
};
