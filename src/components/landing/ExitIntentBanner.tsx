"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ArrowRight, Gift } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "lyra-exit-intent-dismissed";
const ENABLE_DELAY_MS = 3000; // cooldown — don't trigger on initial page entry

export function ExitIntentBanner() {
  const [show, setShow] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setShow(false);
    sessionStorage.setItem(STORAGE_KEY, "1");
    previouslyFocused.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return; // mobile skip
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    let timeout: ReturnType<typeof setTimeout>;
    let enabled = false;
    const enableTimer = window.setTimeout(() => { enabled = true; }, ENABLE_DELAY_MS);

    const onLeave = (e: MouseEvent) => {
      if (!enabled) return;
      if (e.clientY < 10) {
        timeout = setTimeout(() => setShow(true), 200);
      }
    };
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mouseleave", onLeave);
      clearTimeout(timeout);
      clearTimeout(enableTimer);
    };
  }, []);

  // Focus trap + ESC handling
  useEffect(() => {
    if (!show) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = dialog.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && focusables.length > 0) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show, close]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div ref={dialogRef} className="relative mx-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0B1026] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-warning/8 blur-3xl" />
        <button onClick={close} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/5 hover:text-white/60" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <Gift className="h-6 w-6" />
        </div>
        <h3 id="exit-intent-title" className="mt-4 text-2xl font-bold tracking-tight text-white">Wait — don&apos;t leave empty-handed.</h3>
        <p className="mt-2 text-sm leading-7 text-white/50">
          Join 50,000+ investors getting deterministic crypto intelligence. Free forever. No credit card required.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/sign-up" onClick={close} className="flex items-center justify-center gap-2 rounded-xl bg-warning px-4 py-3 font-mono text-sm font-bold text-foreground transition-colors hover:bg-warning/90">
            Sign Up Free<ArrowRight className="h-4 w-4" />
          </Link>
          <button onClick={close} className="rounded-xl border border-white/10 px-4 py-3 font-mono text-sm font-semibold text-white/50 transition-colors hover:bg-white/5 hover:text-white/70">
            Maybe Later
          </button>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] text-white/25">Early members get priority access to Pro features</p>
      </div>
    </div>
  );
}
