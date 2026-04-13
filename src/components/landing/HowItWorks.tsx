import { ArrowRightLeft, BrainCircuit, Cpu } from "lucide-react";

import { LandingReveal } from "@/components/landing/LandingReveal";

const steps = [
  {
    title: "The Deterministic Engine",
    description:
      "DSE Scores, Market Regime, ARCS, and Stress Scenarios are computed before any AI speaks. The model interprets output — it never invents structure.",
    tag: "DSE Scores · Market Regime · ARCS · Stress Scenarios",
    icon: Cpu,
  },
  {
    title: "The AI Agents",
    description:
      "Lyra handles market intelligence. Myra handles product guidance. Hard architectural boundary between them. Model routing scales with query complexity.",
    tag: "Nano, Mini, Full Routing · Isolated Analysis",
    icon: BrainCircuit,
  },
  {
    title: "Premium Workflows",
    description:
      "Compare Assets, Shock Simulator, and Portfolio Intelligence are repeatable routines built on computed signals — not generic chat.",
    tag: "Compare Assets · Shock Simulator · Portfolio Intelligence",
    icon: ArrowRightLeft,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative bg-[#040816] px-4 py-24 sm:px-6 sm:py-28"
      suppressHydrationWarning
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_60%,rgba(20,184,166,0.05),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 obsidian-grid opacity-30" />

      <div className="container relative z-10 mx-auto max-w-7xl px-0">
        <LandingReveal>
          <div className="grid gap-12 xl:grid-cols-[0.8fr_1.2fr] xl:items-start">
            <div className="max-w-xl xl:sticky xl:top-28">
              <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-amber-200/65">
                Three distinct layers
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Computation ›› Intelligence ›› Workflows.
              </h2>
              <p className="mt-5 text-base leading-8 text-white/52 sm:text-lg">
                The engines compute. The AI interprets. The workflows turn it into habit.
              </p>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute left-5 top-6 hidden h-[calc(100%-3rem)] w-px bg-[linear-gradient(180deg,rgba(245,158,11,0),rgba(245,158,11,0.45),rgba(245,158,11,0))] lg:block" />
              <div className="space-y-6">
                {steps.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <LandingReveal key={step.title} delay={index * 120} y={24}>
                      <div
                        className={`relative rounded-[2.3rem] border border-white/8 bg-white/[0.028] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition-transform duration-300 hover:-translate-y-1 sm:p-8 ${
                          index === 1 ? "lg:ml-12" : index === 2 ? "lg:mr-12" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-amber-300/18 bg-amber-300/9 text-amber-200">
                              <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/36">
                              Step 0{index + 1}
                            </p>
                          </div>
                          <div className="landing-pulse-line h-px w-14 bg-amber-300/45" />
                        </div>
                        <h3 className="mt-8 max-w-xl text-2xl font-bold tracking-tight text-white sm:text-[1.85rem]">
                          {step.title}
                        </h3>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/54 sm:text-base">
                          {step.description}
                        </p>
                        {"tag" in step && (
                          <p className="mt-3 font-mono text-[10px] leading-5 text-white/28">
                            {step.tag}
                          </p>
                        )}
                      </div>
                    </LandingReveal>
                  );
                })}
              </div>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
