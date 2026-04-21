/**
 * Shared Framer Motion variants and transition presets.
 * All durations/easings align with CSS custom properties in globals.css.
 * Every component that animates should import from here — no one-off durations.
 */

// ── Transition presets (match CSS --duration-* / --ease-* tokens) ──────────

const easeOut = [0.25, 0.46, 0.45, 0.94] as const;
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export const transitions = {
  fast: { duration: 0.12, ease: easeOut },
  base: { duration: 0.2, ease: easeOut },
  slow: { duration: 0.35, ease: easeOut },
  slower: { duration: 0.5, ease: easeOutExpo },
  spring: { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 },
  springGentle: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  springBouncy: { type: "spring" as const, stiffness: 500, damping: 28, mass: 0.6 },
};

// ── Variant factories ──────────────────────────────────────────────────────

/** Fade up — the workhorse entrance animation */
export const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { ...transitions.base, delay } },
  exit: { opacity: 0, y: 4, transition: transitions.fast },
});

/** Fade only — for overlays, tooltips, toasts */
export const fadeIn = (delay = 0) => ({
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { ...transitions.fast, delay } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
});

/** Scale fade — for modals, dialogs, popovers */
export const scaleFade = (delay = 0) => ({
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { ...transitions.spring, delay } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: easeOut } },
});

/** Slide from right — for sheets, panels */
export const slideRight = (delay = 0) => ({
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { ...transitions.slower, delay } },
  exit: { x: "100%", opacity: 0, transition: transitions.slow },
});

/** Slide from bottom — for mobile sheets */
export const slideUp = (delay = 0) => ({
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { ...transitions.slower, delay } },
  exit: { y: "100%", opacity: 0, transition: transitions.slow },
});

// ── Stagger container + child ──────────────────────────────────────────────

/** Wrap a list parent with this; children use `staggerChild` */
export const staggerContainer = (staggerMs = 40) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: staggerMs / 1000, delayChildren: 0.04 },
  },
});

/** Each list item uses this as its variants */
export const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.base,
  },
};

// ── Card hover micro-interaction ────────────────────────────────────────────

export const cardHover = {
  rest: { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)" },
  hover: {
    scale: 1.005,
    y: -2,
    boxShadow: "0 8px 30px -12px rgba(245, 158, 11, 0.15)",
    transition: transitions.spring,
  },
};

// ── Page transition ────────────────────────────────────────────────────────

export const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: 4, transition: { duration: 0.1 } },
};

// ── Dialog / popover ───────────────────────────────────────────────────────

export const dialogVariants = scaleFade();
export const popoverVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transitions.fast },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.08 } as const },
};

// ── Reusable AnimatePresence props ─────────────────────────────────────────

export const presenceConfig = {
  initial: "hidden" as const,
  animate: "visible" as const,
  exit: "exit" as const,
};

// ── Reduced motion ──────────────────────────────────────────────────────────

/** Check if the user prefers reduced motion (SSR-safe) */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Instant transition — use when reduced motion is preferred */
export const instant = { duration: 0 };

/** Returns the appropriate transition based on user preference */
export function accessibleTransition(normal: typeof transitions.base) {
  return prefersReducedMotion() ? instant : normal;
}
