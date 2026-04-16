import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "For individuals exploring AI-powered crypto intelligence.",
    features: ["5 Lyra queries/day", "Basic crypto analytics", "Market regime signals", "1 watchlist"],
    cta: "Get Started Free",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For serious crypto investors who want deeper signals and more queries.",
    features: ["100 Lyra queries/day", "Full crypto analytics", "Portfolio Intel", "Sector Pulse", "5 watchlists", "Priority support"],
    cta: "Start Pro Trial",
    href: "/sign-up",
    highlight: true,
  },
  {
    name: "Elite",
    price: "$79",
    period: "/month",
    description: "For professional crypto investors who need the full analytical stack.",
    features: ["Unlimited Lyra queries", "All Pro features", "Multibagger Radar", "Elite commands", "Compare Assets", "API access (coming soon)", "Dedicated support"],
    cta: "Go Elite",
    href: "/sign-up",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#040816]">
      <Navbar />
      <main className="flex-1">
        <section className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-400/80">Pricing</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Invest smarter.<br />
              <span className="text-amber-400">Pay less than one bad trade.</span>
            </h1>
            <p className="mt-5 text-base text-white/55 max-w-2xl mx-auto">
              Every plan includes AI-powered crypto intelligence, deterministic engine signals, and no hallucinated metrics.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-5xl grid gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-3xl border p-7 ${
                  plan.highlight
                    ? "border-amber-400/40 bg-amber-400/6 shadow-[0_0_40px_rgba(245,158,11,0.12)]"
                    : "border-white/10 bg-white/3"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">
                    Most Popular
                  </span>
                )}
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-white/40">{plan.period}</span>}
                </div>
                <p className="mt-3 text-sm text-white/50 leading-6">{plan.description}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-8 block rounded-full py-3 text-center text-sm font-bold transition-colors ${
                    plan.highlight
                      ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
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
