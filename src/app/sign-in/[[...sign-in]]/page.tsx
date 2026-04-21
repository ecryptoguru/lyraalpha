"use client";

import { SignIn } from "@clerk/nextjs";
import { FeatureCards, type FeatureItem } from "@/components/auth/FeatureCards";

export default function SignInPage() {
  const featureItems: FeatureItem[] = [
    {
      label: "Dashboard",
      detail: "Track the most important signals, narratives, and portfolio context in one place.",
    },
    {
      label: "Lyra AI",
      detail: "Ask questions, get explanations, and move from signal to action faster.",
    },
    {
      label: "Analysis",
      detail: "Explore research, comparisons, and stress tests after you sign in.",
    },
  ];

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
              Sign in to LyraAlpha.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Sign in to access the dashboard, Lyra, portfolio analysis, and market intelligence.
            </p>
            <FeatureCards items={featureItems} />
          </div>
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-3 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-4">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              forceRedirectUrl="/dashboard/lyra"
              fallbackRedirectUrl="/dashboard/lyra"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
