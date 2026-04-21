"use client";

import { SignUp } from "@clerk/nextjs";
import { FeatureCards, type FeatureItem } from "@/components/auth/FeatureCards";

export default function SignUpPage() {
  const featureItems: FeatureItem[] = [
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
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="relative grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
              Create your account
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tighter text-foreground sm:text-5xl">
              Join LyraAlpha.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Create your LyraAlpha account to access market intelligence, portfolio tools, and Lyra.
            </p>

            <FeatureCards items={featureItems} />
          </div>

          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-3 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              forceRedirectUrl="/dashboard/lyra"
              fallbackRedirectUrl="/dashboard/lyra"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
