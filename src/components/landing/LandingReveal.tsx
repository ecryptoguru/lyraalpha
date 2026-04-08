"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface LandingRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  scale?: number;
  y?: number;
  threshold?: number;
  immediate?: boolean;
  rootMargin?: string;
}

type RevealCallback = (entry: IntersectionObserverEntry) => void;

interface ObserverRecord {
  observer: IntersectionObserver;
  listeners: WeakMap<Element, Set<RevealCallback>>;
  trackedElements: Set<Element>;
}

const observerRegistry = new Map<string, ObserverRecord>();

function getObserverKey(threshold: number, rootMargin: string) {
  return `${threshold}:${rootMargin}`;
}

function getObserver(threshold: number, rootMargin: string) {
  const key = getObserverKey(threshold, rootMargin);
  const existing = observerRegistry.get(key);
  if (existing) return existing;

  const listeners = new WeakMap<Element, Set<RevealCallback>>();
  const trackedElements = new Set<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        listeners.get(entry.target)?.forEach((callback) => callback(entry));
      }
    },
    { threshold, rootMargin },
  );

  const record = { observer, listeners, trackedElements };
  observerRegistry.set(key, record);
  return record;
}

export function LandingReveal({
  children,
  className = "",
  delay = 0,
  scale = 0.985,
  y = 28,
  threshold = 0.18,
  immediate = false,
  rootMargin = "0px 0px -10% 0px",
}: LandingRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) return;

    const node = ref.current;
    if (!node) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const key = getObserverKey(threshold, rootMargin);
    const { observer, listeners, trackedElements } = getObserver(threshold, rootMargin);
    const callback: RevealCallback = (entry) => {
      if (!entry.isIntersecting) return;
      setIsVisible(true);
      observer.unobserve(entry.target);
      trackedElements.delete(entry.target);
      const callbacks = listeners.get(entry.target);
      callbacks?.delete(callback);
      if (callbacks && callbacks.size === 0) {
        listeners.delete(entry.target);
      }
      if (trackedElements.size === 0) {
        observer.disconnect();
        observerRegistry.delete(key);
      }
    };

    const callbacks = listeners.get(node) ?? new Set<RevealCallback>();
    callbacks.add(callback);
    listeners.set(node, callbacks);
    trackedElements.add(node);
    observer.observe(node);

    return () => {
      const activeCallbacks = listeners.get(node);
      activeCallbacks?.delete(callback);
      if (activeCallbacks && activeCallbacks.size === 0) {
        listeners.delete(node);
        observer.unobserve(node);
        trackedElements.delete(node);
        if (trackedElements.size === 0) {
          observer.disconnect();
          observerRegistry.delete(key);
        }
      }
    };
  }, [immediate, rootMargin, threshold]);

  const style = useMemo(
    () =>
      ({
        transitionDelay: `${delay}ms`,
        ["--landing-reveal-y" as string]: `${y}px`,
        ["--landing-reveal-scale" as string]: scale.toString(),
      }) as CSSProperties,
    [delay, scale, y],
  );

  return (
    <div
      ref={ref}
      style={style}
      className={`landing-reveal ${isVisible ? "landing-reveal--visible" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
