"use client";

import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const COACHMARK_KEY = "coachmark:completed:v1";

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "sidebar-trigger",
    title: "Navigation Sidebar",
    description: "Collapse or expand the sidebar to navigate between dashboard sections.",
    position: "right",
  },
  {
    targetId: "navbar-search",
    title: "Search & Command Palette",
    description: "Search assets or press ⌘K to open the command palette for quick navigation.",
    position: "bottom",
  },
  {
    targetId: "region-toggle",
    title: "Region Toggle",
    description: "Switch between US and India markets to get region-specific intelligence.",
    position: "bottom",
  },
  {
    targetId: "density-badge",
    title: "Density Mode",
    description: "Toggle between cozy and compact spacing. Press ⌘⇧P to switch quickly.",
    position: "bottom",
  },
  {
    targetId: "live-chat-bubble",
    title: "Myra Support Chat",
    description: "Ask Myra anything about the platform — she's always here to help.",
    position: "left",
  },
];

const CARD_WIDTH = 288;
const CARD_HEIGHT_EST = 160;

interface Coords {
  cardLeft: number;
  cardTop: number;
  highlight: { left: number; top: number; width: number; height: number };
}

export function CoachmarkTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { window.localStorage.setItem(COACHMARK_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // Keyboard navigation: Escape to dismiss, ArrowRight/Left to navigate steps
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, dismiss]);

  // Check if tour should show
  useEffect(() => {
    try {
      const done = window.localStorage.getItem(COACHMARK_KEY);
      if (done === "1") return;
    } catch { /* ignore */ }

    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Compute position via ResizeObserver + resize/scroll listeners (no polling).
  // Retries on RAF while the target element hasn't mounted yet.
  useLayoutEffect(() => {
    if (!visible) return;
    const currentStep = TOUR_STEPS[step];
    if (!currentStep) return;

    let cancelled = false;
    let rafId: number | null = null;
    let observer: ResizeObserver | null = null;
    let observedEl: Element | null = null;

    const compute = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-coachmark="${currentStep.targetId}"]`);
      if (!el) {
        rafId = requestAnimationFrame(compute);
        return;
      }

      if (el !== observedEl) {
        observer?.disconnect();
        observedEl = el;
        observer = new ResizeObserver(compute);
        observer.observe(el);
      }

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let cardLeft: number;
      let cardTop: number;

      switch (currentStep.position) {
        case "right":
          cardLeft = rect.right + 12;
          cardTop = rect.top + rect.height / 2 - CARD_HEIGHT_EST / 2;
          break;
        case "left":
          cardLeft = rect.left - 12 - CARD_WIDTH;
          cardTop = rect.top + rect.height / 2 - CARD_HEIGHT_EST / 2;
          break;
        case "top":
          cardLeft = cx - CARD_WIDTH / 2;
          cardTop = rect.top - 12 - CARD_HEIGHT_EST;
          break;
        case "bottom":
        default:
          cardLeft = cx - CARD_WIDTH / 2;
          cardTop = rect.bottom + 12;
          break;
      }

      // Clamp to viewport
      cardLeft = Math.max(12, Math.min(vw - CARD_WIDTH - 12, cardLeft));
      cardTop = Math.max(12, Math.min(vh - CARD_HEIGHT_EST - 12, cardTop));

      setCoords({
        cardLeft,
        cardTop,
        highlight: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      });
    };

    compute();
    window.addEventListener("resize", compute, { passive: true });
    window.addEventListener("scroll", compute, { passive: true, capture: true });

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, { capture: true });
    };
  }, [visible, step]);

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const showCard = visible && coords && currentStep;

  return (
    <AnimatePresence>
      {showCard && (
        <motion.div
          key="coachmark-tour"
          className="fixed inset-0 z-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-label="Feature tour"
        >
          {/* Backdrop — dismiss on click */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={dismiss} />

          {/* Highlight ring — pointer-events none so the target stays clickable */}
          <div
            className="absolute pointer-events-none rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-200"
            style={{
              left: coords.highlight.left - 6,
              top: coords.highlight.top - 6,
              width: coords.highlight.width + 12,
              height: coords.highlight.height + 12,
            }}
          />

          {/* Coachmark card */}
          <motion.div
            className="absolute z-201 w-72 rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] p-4 pointer-events-auto"
            style={{ left: coords.cardLeft, top: coords.cardTop }}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/60">
                  {step + 1} / {TOUR_STEPS.length}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted/30 transition-colors"
                aria-label="Dismiss tour"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            <h3 className="text-sm font-bold text-foreground mb-1">{currentStep.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.description}</p>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
              <button
                onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
              >
                {isLast ? "Done" : "Next"}
                {!isLast && <ChevronRight className="h-3 w-3" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
