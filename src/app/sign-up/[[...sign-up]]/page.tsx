"use client";

import { SignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { normalizePrelaunchCoupon } from "@/lib/config/prelaunch";

type PageState = "loading" | "validating" | "ready" | "invalid";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCoupon = normalizePrelaunchCoupon(
    searchParams.get("coupon") || searchParams.get("ref_coupon"),
  );

  const [state, setState] = useState<PageState>("loading");
  const [validCoupon, setValidCoupon] = useState<string | null>(null);

  // Track whether the user manually navigated away (e.g. "Go back now") so we
  // can cancel any pending setTimeout redirect and avoid a double-navigation.
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!urlCoupon) {
      router.replace("/?open=signup");
      return;
    }

    setState("validating");

    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch("/api/prelaunch/validate-coupon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: urlCoupon }),
          signal: controller.signal,
        });
        const payload = (await res.json()) as { valid?: boolean };

        if (controller.signal.aborted) return;

        if (res.ok && payload.valid) {
          setValidCoupon(urlCoupon);
          setState("ready");
        } else {
          setState("invalid");
          // Deferred auto-redirect — cancelled if user clicks "Go back now"
          timerRef.current = setTimeout(() => {
            if (!cancelledRef.current) router.replace("/?open=signup");
          }, 3000);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (!isAbort) {
          setState("invalid");
          timerRef.current = setTimeout(() => {
            if (!cancelledRef.current) router.replace("/?open=signup");
          }, 3000);
        }
      }
    })();

    return () => {
      controller.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  function handleGoBack() {
    cancelledRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    router.replace("/?open=signup");
  }

  // ─── Loading / redirecting ──────────────────────────────────────────────
  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground/60">
          Redirecting…
        </p>
      </main>
    );
  }

  // ─── Validating coupon ──────────────────────────────────────────────────
  if (state === "validating") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary/70">
              Validating access code
            </p>
            <p className="text-sm text-muted-foreground">Please wait…</p>
          </div>
        </div>
      </main>
    );
  }

  // ─── Invalid coupon ─────────────────────────────────────────────────────
  if (state === "invalid") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.06),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.06),transparent_30%)]" />
        <div className="w-full max-w-md text-center space-y-5 rounded-4xl border border-white/10 bg-card/70 p-8 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/25 bg-destructive/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-destructive/80">
            Access denied
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-foreground">
            Code not recognised
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            That access code isn&apos;t valid or may have already been used.
            Returning you to the access page in a moment…
          </p>
          <button
            onClick={handleGoBack}
            className="w-full rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go back now
          </button>
        </div>
      </main>
    );
  }

  // ─── Ready — show Clerk sign-up form ────────────────────────────────────
  const afterSignUpUrl = validCoupon
    ? `/sign-in?redirect_url=%2Fdashboard&coupon=${encodeURIComponent(validCoupon)}`
    : "/sign-in?redirect_url=%2Fdashboard";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="relative grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">

          {/* ── Left panel ─────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
              Access approved
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tighter text-foreground sm:text-5xl">
              Create your account.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Your access code has been verified. Complete registration to enter the platform.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Portfolio",
                  detail: "Concentration, overlap and fragility analysis from day one.",
                },
                {
                  label: "Narratives",
                  detail: "Market regime framing before you react to isolated signals.",
                },
                {
                  label: "Lyra AI",
                  detail: "Deeper scenario framing grounded in computed data, not guesses.",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-background/60 p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground/85">{item.detail}</p>
                </div>
              ))}
            </div>

            {validCoupon && (
              <div className="mt-6 flex items-center gap-2 rounded-3xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
                <span className="text-emerald-400 text-sm">✦</span>
                <span className="text-sm text-emerald-300 font-medium">Access code verified</span>
                <span className="ml-auto rounded bg-emerald-950/40 px-1.5 py-0.5 font-mono text-xs text-emerald-400/70">
                  {validCoupon}
                </span>
              </div>
            )}
          </div>

          {/* ── Right panel — Clerk SignUp ───────────────────────────────── */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-3 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              forceRedirectUrl={afterSignUpUrl}
              fallbackRedirectUrl={afterSignUpUrl}
              unsafeMetadata={validCoupon ? { coupon_code: validCoupon } : undefined}
            />
          </div>

        </div>
      </div>
    </main>
  );
}
