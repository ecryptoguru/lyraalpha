"use client";

import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "lyraalpha-cookie-consent";

type Choice = "accepted" | "declined";

function readConsent(): Choice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(choice: Choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // no-op (private mode etc.)
  }
}

export function CookieConsentBanner() {
  // Start hidden on both server + first client render to avoid hydration mismatch.
  // Reveal after mount if user has not made a choice yet.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Defer to next paint to avoid synchronous setState in effect (React compiler rule)
    const id = requestAnimationFrame(() => {
      if (readConsent() === null) setVisible(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function record(choice: Choice) {
    writeConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed bottom-0 left-0 right-0 z-9999 border-t border-white/10 bg-[#040816]/95 backdrop-blur-xl px-4 py-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p id="cookie-consent-title" className="text-sm text-white/80">
              We use cookies to improve your experience and analyze site traffic.
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/40">
              By accepting, you agree to our{" "}
              <a href="/privacy" className="underline hover:text-white/60">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          <button
            onClick={() => record("declined")}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 sm:flex-initial"
          >
            Decline
          </button>
          <button
            onClick={() => record("accepted")}
            className="flex-1 rounded-full bg-warning px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-warning/90 sm:flex-initial"
          >
            Accept
          </button>
          <button
            onClick={() => record("declined")}
            aria-label="Dismiss cookie notice"
            className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
