"use client";

import { useState } from "react";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "lyraalpha-cookie-consent";

function hasConsent(): boolean {
  try {
    return !!localStorage.getItem(CONSENT_KEY);
  } catch {
    return false;
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => !hasConsent());

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-9999 border-t border-white/10 bg-[#040816]/95 backdrop-blur-xl px-4 py-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm text-white/80">
              We use cookies to improve your experience and analyze site traffic.
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/40">
              By continuing, you agree to our{" "}
              <a href="/privacy" className="underline hover:text-white/60">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={accept}
            className="rounded-full bg-warning px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-warning/90"
          >
            Accept
          </button>
          <button
            onClick={accept}
            aria-label="Dismiss cookie notice"
            className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
