"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "For individuals exploring AI-powered crypto intelligence.",
    features: ["5 Lyra queries/day", "Basic crypto analytics", "Market regime signals", "1 watchlist"],
    cta: "Get Started Free",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 24,
    description: "For serious crypto investors who want deeper signals and more queries.",
    features: ["100 Lyra queries/day", "Full crypto analytics", "Portfolio Intel", "Sector Pulse", "5 watchlists", "Priority support"],
    cta: "Start Pro Trial",
    href: "/sign-up?plan=pro",
    highlight: true,
  },
  {
    name: "Elite",
    monthlyPrice: 79,
    annualPrice: 63,
    description: "For professional crypto investors who need the full analytical stack.",
    features: ["Unlimited Lyra queries", "All Pro features", "Multibagger Radar", "Elite commands", "Compare Assets", "API access (coming soon)", "Dedicated support"],
    cta: "Go Elite",
    href: "/sign-up?plan=elite",
    highlight: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  return (
    <div className="min-h-screen flex flex-col bg-[#040816]">
      <Navbar />
      <main className="flex-1">
        <section className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-warning/80">Pricing</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Invest smarter.<br />
              <span className="text-warning">Pay less than one bad trade.</span>
            </h1>
            <p className="mt-5 text-base text-white/55 max-w-2xl mx-auto">
              Every plan includes AI-powered crypto intelligence, deterministic engine signals, and no hallucinated metrics.
            </p>
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/3 p-1 backdrop-blur-sm">
              <button onClick={() => setAnnual(true)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${annual ? "bg-warning text-foreground" : "text-white/50 hover:text-white"}`}>Annual</button>
              <button onClick={() => setAnnual(false)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${!annual ? "bg-warning text-foreground" : "text-white/50 hover:text-white"}`}>Monthly</button>
            </div>
            {annual && <p className="mt-2 font-mono text-[10px] text-warning/60">Save up to 20% with annual billing</p>}
          </div>

          <div className="mx-auto mt-16 max-w-5xl grid gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-3xl border p-7 ${
                  plan.highlight
                    ? "border-warning/40 bg-warning/6 shadow-[0_0_40px_rgba(245,158,11,0.12)]"
                    : "border-white/10 bg-white/3"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-warning/30 bg-warning/15 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-warning">
                    Most Popular
                  </span>
                )}
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.monthlyPrice === 0 ? "Free" : `$${annual ? plan.annualPrice : plan.monthlyPrice}`}</span>
                  {plan.monthlyPrice > 0 && <span className="text-sm text-white/40">/mo</span>}
                </div>
                {annual && plan.monthlyPrice > 0 && (
                  <p className="font-mono text-[10px] text-white/25 line-through">${plan.monthlyPrice}/mo monthly</p>
                )}
                <p className="mt-3 text-sm text-white/50 leading-6">{plan.description}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-8 block rounded-full py-3 text-center text-sm font-bold transition-colors ${
                    plan.highlight
                      ? "bg-warning text-foreground hover:bg-warning3963"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
