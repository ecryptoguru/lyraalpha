"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Tag, ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRELAUNCH_WAITLIST_SECTION_ID } from "@/lib/config/prelaunch";

type ModalState = "coupon" | "waitlist";

const MAX_ATTEMPTS = 3;

interface CouponSignUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CouponSignUpModal({ open, onOpenChange }: CouponSignUpModalProps) {
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>("coupon");
  const [attempts, setAttempts] = useState(0);

  // Persist attempt count across open/close cycles — prevents bypassing the
  // 3-strike gate by simply closing and reopening the modal.
  const persistedAttemptsRef = useState(() => ({ count: 0 }))[0];

  function handleClose(next: boolean) {
    if (!next) {
      setCoupon("");
      setError(null);
      // Only reset to coupon state if attempts NOT exhausted; otherwise keep waitlist view
      if (persistedAttemptsRef.count < MAX_ATTEMPTS) {
        setModalState("coupon");
      }
    }
    onOpenChange(next);
  }

  async function handleContinue() {
    const trimmed = coupon.trim();
    if (!trimmed) {
      setError("Please enter your access code to continue.");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/prelaunch/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json() as { valid: boolean };

      if (data.valid) {
        // Close modal then redirect to /sign-up with coupon in URL.
        // The sign-up page passes it as unsafeMetadata to Clerk so the
        // webhook can apply the correct ELITE plan on user.created.
        handleClose(false);
        router.push(`/sign-up?coupon=${encodeURIComponent(trimmed.toUpperCase())}`);
      } else {
        const newAttempts = attempts + 1;
        persistedAttemptsRef.count = newAttempts; // persist across modal close/reopen
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setModalState("waitlist");
        } else {
          const remaining = MAX_ATTEMPTS - newAttempts;
          setError(
            `Invalid access code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          );
        }
      }
    } catch {
      setError("Unable to validate right now. Please try again.");
    } finally {
      setIsValidating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleContinue();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-white/8 bg-[#070e1f] p-0 text-white shadow-[0_40px_100px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Top amber scan line */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/70 to-transparent z-10" />

        <div className="p-7 sm:p-8">
          {modalState === "coupon" ? (
            <CouponForm
              coupon={coupon}
              setCoupon={setCoupon}
              isValidating={isValidating}
              error={error}
              onContinue={handleContinue}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <WaitlistPrompt
              onClose={() => handleClose(false)}
              onTryAgain={() => { setAttempts(0); setError(null); setModalState("coupon"); }}
              attemptsExhausted={attempts >= MAX_ATTEMPTS}
            />
          )}
        </div>

        {/* Bottom teal bar */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-teal-400/40 to-transparent z-10" />

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-48 rounded-full bg-amber-400/6 blur-3xl" />
      </DialogContent>
    </Dialog>
  );
}

// ─── Coupon input state ──────────────────────────────────────────────────────

interface CouponFormProps {
  coupon: string;
  setCoupon: (v: string) => void;
  isValidating: boolean;
  error: string | null;
  onContinue: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function CouponForm({ coupon, setCoupon, isValidating, error, onContinue, onKeyDown }: CouponFormProps) {
  return (
    <>
      {/* Header */}
      <DialogHeader className="mb-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/8 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
            <Tag className="h-5 w-5" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/6 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-amber-400/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Early Access Only
          </span>
        </div>
        <DialogTitle className="text-2xl font-semibold tracking-[-0.03em] text-white">
          Enter your access code
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-7 text-white/45">
          InsightAlpha AI is currently invite-only. You need a valid access code
          to create an account.
        </DialogDescription>
      </DialogHeader>

      {/* Input + CTA */}
      <div className="space-y-3">
        <div className="relative">
          <Input
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value.toUpperCase());
            }}
            onKeyDown={onKeyDown}
            placeholder=""
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-14 rounded-2xl border-white/10 bg-white/5 pr-4 font-mono text-base tracking-[0.22em] text-white placeholder:text-white/20 focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20 transition-colors"
          />
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 font-mono text-xs text-rose-400">
            {error}
          </p>
        )}

        <Button
          onClick={onContinue}
          disabled={isValidating || !coupon.trim()}
          className="h-13 w-full rounded-2xl bg-amber-400 font-bold text-slate-950 shadow-[0_8px_30px_rgba(245,158,11,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_14px_40px_rgba(245,158,11,0.38)] disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
        >
          {isValidating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating…</>
          ) : (
            <><ArrowRight className="mr-2 h-4 w-4" /> Continue to Sign Up</>
          )}
        </Button>
      </div>

      {/* Footer */}
      <div className="mt-6 space-y-3">
        <p className="text-center font-mono text-[11px] text-white/30">
          Don&apos;t have a code?{" "}
          <button
            type="button"
            onClick={() => {
              document.getElementById(PRELAUNCH_WAITLIST_SECTION_ID)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="text-amber-400/70 underline underline-offset-2 hover:text-amber-400 transition-colors"
          >
            Join the waitlist
          </button>
        </p>

        <div className="flex items-center gap-2.5 rounded-2xl border border-white/6 bg-white/2 px-4 py-3.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-teal-400" />
          <p className="font-mono text-[10px] leading-5 text-white/30">
            Your code is validated server-side and never stored in the browser.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Waitlist redirect state ─────────────────────────────────────────────────

interface WaitlistPromptProps {
  onClose: () => void;
  onTryAgain: () => void;
  attemptsExhausted?: boolean;
}

function WaitlistPrompt({ onClose, onTryAgain, attemptsExhausted = false }: WaitlistPromptProps) {
  const router = useRouter();

  function handleJoinWaitlist() {
    onClose();
    setTimeout(() => {
      const section = document.getElementById(PRELAUNCH_WAITLIST_SECTION_ID);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // Not on landing page — navigate there and anchor to the waitlist section
        router.push(`/#${PRELAUNCH_WAITLIST_SECTION_ID}`);
      }
    }, 150);
  }

  return (
    <>
      <DialogHeader className="mb-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/8 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
            <Clock className="h-5 w-5" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
            Access Required
          </span>
        </div>
        <DialogTitle className="text-2xl font-semibold tracking-[-0.03em] text-white">
          Code not recognised
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-7 text-white/45">
          That access code isn&apos;t valid or may have already been used.
          Join the waitlist and we&apos;ll send you a personal invite when a spot opens.
        </DialogDescription>
      </DialogHeader>

      {/* Benefits */}
      <div className="mb-6 space-y-2.5 rounded-2xl border border-white/6 bg-white/2 p-5">
        {[
          "Priority position before public launch — guaranteed first in line",
          "Lock pre-launch pricing before it's gone",
          "Personal access code sent directly to your inbox",
        ].map((benefit) => (
          <div key={benefit} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-teal-400/25 bg-teal-400/8">
              <CheckCircle2 className="h-3 w-3 text-teal-400" />
            </div>
            <p className="text-sm leading-6 text-white/55">{benefit}</p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={handleJoinWaitlist}
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 font-bold text-slate-950 shadow-[0_8px_30px_rgba(245,158,11,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-300"
        >
          <Sparkles className="h-4 w-4" />
          Join the Waitlist
        </button>

        {!attemptsExhausted && (
          <button
            onClick={onTryAgain}
            className="h-11 w-full rounded-2xl border border-white/8 bg-white/3 font-mono text-xs text-white/40 transition-all hover:bg-white/5 hover:text-white/60"
          >
            Try a different code
          </button>
        )}
      </div>
    </>
  );
}
