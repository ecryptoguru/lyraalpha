"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignIn, useUser, useClerk } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { normalizePrelaunchCoupon } from "@/lib/config/prelaunch";

/**
 * Strict same-origin redirect guard.
 * Rejects absolute URLs (http://, https://, //), encoded absolute attempts,
 * and circular redirects back to sign-in. Falls back to /dashboard.
 */
function getSafeRedirectUrl(raw: string | null): string {
  if (!raw) return "/dashboard";
  try {
    // Decode any percent-encoded schemes before testing
    const decoded = decodeURIComponent(raw);
    // Reject anything that looks like an absolute or protocol-relative URL
    if (/^(https?:)?\/\//i.test(decoded) || /^[a-z][a-z0-9+\-.]*:/i.test(decoded)) {
      return "/dashboard";
    }
    // Must start with / and must not loop back to sign-in
    if (!decoded.startsWith("/") || decoded.startsWith("/sign-in")) {
      return "/dashboard";
    }
    return decoded;
  } catch {
    return "/dashboard";
  }
}

type AccessState = "checking" | "granted" | "requires_coupon" | "waitlisted" | "error";

const MAX_COUPON_ATTEMPTS = 3;

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const urlCoupon = normalizePrelaunchCoupon(
    searchParams.get("coupon") || searchParams.get("ref_coupon"),
  );

  const redirectUrl = useMemo(
    () => getSafeRedirectUrl(searchParams.get("redirect_url")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable — computed once on mount
  );

  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [coupon, setCoupon] = useState(urlCoupon ?? "");
  const [couponSubmitting, setCouponSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  // Apply autocomplete attributes to Clerk's injected inputs
  useEffect(() => {
    const apply = () => {
      for (const el of document.querySelectorAll<HTMLInputElement>(
        'input[type="email"], input[name="identifier"]',
      )) {
        if (!el.autocomplete) el.autocomplete = "email";
      }
      for (const el of document.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
        if (!el.autocomplete || el.autocomplete === "off") el.autocomplete = "current-password";
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Deduplicated access check — used both on sign-in and on retry
  const checkAccess = useCallback(
    async (signal?: AbortSignal) => {
      setAccessState("checking");
      setError(null);
      try {
        const res = await fetch("/api/auth/prelaunch-status", {
          cache: "no-store",
          signal,
        });
        if (signal?.aborted) return;

        if (!res.ok) {
          setAccessState("error");
          setError("Unable to verify access. Please try again.");
          return;
        }

        const data = (await res.json()) as { entitled: boolean };
        if (signal?.aborted) return;

        if (data.entitled) {
          setAccessState("granted");
          router.replace(redirectUrl);
          return;
        }
        setAccessState("requires_coupon");
      } catch (err) {
        if (signal?.aborted) return;
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (!isAbort) {
          setAccessState("error");
          setError("Network error. Please check your connection and try again.");
        }
      }
    },
    [redirectUrl, router],
  );

  // Once Clerk confirms user is signed in, check prelaunch access
  const checkAccessRef = useRef(checkAccess);
  checkAccessRef.current = checkAccess;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAccessState("checking");
      return;
    }
    const controller = new AbortController();
    void checkAccessRef.current(controller.signal);
    return () => controller.abort();
  }, [isLoaded, isSignedIn]);

  const handleRedeemCoupon = useCallback(async () => {
    const normalized = normalizePrelaunchCoupon(coupon);
    if (!normalized || couponSubmitting) return;

    setCouponSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/prelaunch-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon: normalized }),
      });
      const data = (await res.json()) as { error?: string; redirectUrl?: string };

      if (!res.ok) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_COUPON_ATTEMPTS) {
          // Auto-add to waitlist, then sign out
          const email = user?.primaryEmailAddress?.emailAddress;
          if (email) {
            try {
              await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  source: "sign_in_coupon_gate",
                  notes: "Auto-added after 3 failed coupon attempts at sign-in gate",
                }),
              });
            } catch {
              /* silently ignore */
            }
          }
          await signOut();
          setAccessState("waitlisted");
        } else {
          const remaining = MAX_COUPON_ATTEMPTS - newAttempts;
          setError(
            `${data.error ?? "Coupon not found or expired."} ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          );
        }
        return;
      }

      // Clear stale onboarding cache so fresh onboarding flow shows
      try {
        window.localStorage.removeItem("onboarding:completed:v1");
      } catch {
        /* ignore */
      }

      router.replace(data.redirectUrl ?? "/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCouponSubmitting(false);
    }
  }, [attempts, coupon, couponSubmitting, router, signOut, user]);

  // Auto-redeem coupon from URL once sign-in + coupon state are both ready
  const autoRedeemedRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn) return;
    if (accessState !== "requires_coupon") return;
    if (!urlCoupon) return;
    if (couponSubmitting) return;
    if (autoRedeemedRef.current) return;
    autoRedeemedRef.current = true;
    void handleRedeemCoupon();
  }, [accessState, couponSubmitting, handleRedeemCoupon, isSignedIn, urlCoupon]);

  // ─── Signed-in state views ─────────────────────────────────────────────────
  if (isSignedIn) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
          <div className="w-full max-w-md overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-7">

            {(accessState === "checking" || accessState === "granted") && (
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary/70">
                    {accessState === "checking" ? "Checking access" : "Access granted"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {accessState === "checking"
                      ? "Verifying your account…"
                      : "Preparing your dashboard…"}
                  </p>
                </div>
              </div>
            )}

            {accessState === "error" && (
              <div className="space-y-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-destructive/70">
                  Access Error
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={() => void checkAccess()}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Try again
                </button>
              </div>
            )}

            {accessState === "requires_coupon" && (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary/70">
                    Pre-launch access
                  </p>
                  <h2 className="mt-3 text-xl font-bold text-foreground">
                    Enter your access code
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    An approved access code is required to enter the platform.
                  </p>
                </div>

                {/* Attempt indicator dots */}
                {attempts > 0 && (
                  <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: MAX_COUPON_ATTEMPTS }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-full transition-colors ${
                          i < attempts
                            ? "bg-destructive"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground/60">
                      {MAX_COUPON_ATTEMPTS - attempts} attempt{MAX_COUPON_ATTEMPTS - attempts === 1 ? "" : "s"} left
                    </span>
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && void handleRedeemCoupon()}
                    placeholder="ACCESS CODE"
                    className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 font-mono text-sm tracking-[0.2em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                    maxLength={32}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                  />
                  {error && (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-center text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <button
                    onClick={() => void handleRedeemCoupon()}
                    disabled={!coupon.trim() || couponSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {couponSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {couponSubmitting ? "Verifying…" : "Continue"}
                  </button>
                </div>
              </div>
            )}

            {accessState === "waitlisted" && (
              <div className="space-y-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-500/70">
                  Added to Waitlist
                </p>
                <h2 className="text-xl font-bold text-foreground">You&apos;re on the waitlist</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  No valid access code was found after {MAX_COUPON_ATTEMPTS} attempts. We&apos;ve
                  added you to the waitlist and will send a personal invite when a spot opens.
                </p>
                <button
                  onClick={() => router.replace("/")}
                  className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
                >
                  Return to home
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    );
  }

  // ─── Not signed in — show Clerk UI ────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="relative grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              system-led access
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tighter text-foreground sm:text-5xl">
              Sign in to continue where the system takes you.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Use sign-in when you already have access and want to move straight into portfolio
              intelligence, market narratives, Lyra, compare or stress testing.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Portfolio",
                  detail: "Start with concentration, overlap and fragility before you rebalance.",
                },
                {
                  label: "Narratives",
                  detail: "Read the dominant market story before reacting to isolated moves.",
                },
                {
                  label: "AI reasoning",
                  detail: "Use Lyra for deeper scenario framing and follow-up questions.",
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
          </div>
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-3 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-4">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/?open=signup"
              forceRedirectUrl={redirectUrl}
              fallbackRedirectUrl={redirectUrl}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
