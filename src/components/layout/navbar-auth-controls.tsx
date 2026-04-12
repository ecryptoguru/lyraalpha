"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";

import { SignedIn, SignedOut } from "@/lib/clerk-shim";

import { NavbarAccountSlot } from "./navbar-account-slot";
import { AuthButton } from "./AuthButton";

export function NavbarAuthControls() {
  return (
    <>
      <SignedIn>
        <Link
          href="/dashboard/lyra"
          className="flex items-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 min-h-[38px] text-sm font-semibold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-white/8 dark:bg-white/3 dark:text-white/80 dark:hover:bg-white/8 dark:hover:text-white"
        >
          Ask Lyra
        </Link>
        <NavbarAccountSlot />
      </SignedIn>

      <SignedOut>
        <div className="flex items-center gap-3">
          <AuthButton href="/sign-in" icon={<LogIn className="h-3.5 w-3.5" />}>
            Sign In
          </AuthButton>
          <AuthButton href="/sign-up" variant="primary">
            Sign Up
          </AuthButton>
        </div>
      </SignedOut>
    </>
  );
}
