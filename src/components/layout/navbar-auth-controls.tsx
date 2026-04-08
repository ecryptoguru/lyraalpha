"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { CouponSignUpModal } from "@/components/landing/coupon-signup-modal";
import { SignedIn, SignedOut } from "@/lib/clerk-shim";

import { NavbarAccountSlot } from "./navbar-account-slot";

export function NavbarAuthControls() {
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open modal when ?open=signup is in the URL (e.g. redirected from Clerk's "Sign up" link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") === "signup") {
      // Defer setState to avoid cascading renders (React best practice)
      setTimeout(() => {
        setModalOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }, 0);
    }
  }, []);

  return (
    <>
      <CouponSignUpModal open={modalOpen} onOpenChange={setModalOpen} />

      <SignedIn>
        <Link
          href="/dashboard"
          className="flex items-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 min-h-[38px] text-sm font-semibold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-white/8 dark:bg-white/3 dark:text-white/80 dark:hover:bg-white/8 dark:hover:text-white"
        >
          Dashboard
        </Link>
        <NavbarAccountSlot />
      </SignedIn>

      <SignedOut>
        <Link
          href="/sign-in"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-5 py-2 min-h-[38px] text-sm font-semibold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-white/8 dark:bg-white/3 dark:text-white/80 dark:hover:bg-white/8 dark:hover:text-white"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign In
        </Link>
      </SignedOut>
    </>
  );
}
