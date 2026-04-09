"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="relative grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
              Create your account
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tighter text-foreground sm:text-5xl">
              Join LyraAlpha.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Create a Clerk account to access market intelligence, portfolio tools, and Lyra.
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
          </div>

          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 p-3 shadow-[0_24px_80px_-32px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              forceRedirectUrl="/dashboard"
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
