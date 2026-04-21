import { LandingReveal } from "@/components/landing/LandingReveal";

const trustMetrics = [
  {
    value: "01 · The Data Glut",
    label: "400M+ crypto holders, same fragmented streams: prices, charts, on-chain data, news — zero synthesis.",
    accent: "default",
  },
  {
    value: "02 · The AI Illusion",
    label: "Generic AI finance tools hallucinate metrics. They invent structure that should have been computed. No auditability, no trust.",
    accent: "gold",
  },
  {
    value: "03 · The Missing Framework",
    label: "No framework exists to turn on-chain signals and regime context into a decision. The problem isn't data access — it's synthesis.",
    accent: "cyan",
  },
] as const;

export function Trust() {
  return (
    <section className="relative bg-[#040816] px-4 py-10 sm:px-6 sm:py-14" suppressHydrationWarning>
      <div className="container mx-auto max-w-7xl px-0" suppressHydrationWarning>
        <LandingReveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.022] p-6 backdrop-blur-sm sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#00D4FF]/40 to-transparent" />
            <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <div className="max-w-xl">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.34em] text-[#FFD700]/65">
                  The problem we solve
                </p>
                <h2 className="mt-4 text-3xl font-light tracking-[-0.04em] text-white sm:text-4xl">
                  You have the data.
                  <span className="block text-[#FFD700]">You lack the judgment layer.</span>
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/42 sm:text-base">
                  The edge is in the engine that synthesizes the data — and the AI that interprets it without hallucinating.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  {trustMetrics.map((metric) => (
                    <div
                      key={metric.value}
                      className={`h-full rounded-2xl border p-5 transition-transform duration-300 hover:-translate-y-1 ${
                        metric.accent === "gold"
                          ? "border-[#FFD700]/20 bg-[#FFD700]/6"
                          : metric.accent === "cyan"
                          ? "border-[#00D4FF]/18 bg-[#00D4FF]/5"
                          : "border-white/8 bg-white/2.5"
                      }`}
                    >
                      <p
                        className={`font-mono text-[10px] font-bold uppercase tracking-[0.3em] ${
                          metric.accent === "gold"
                            ? "text-[#FFD700]"
                            : metric.accent === "cyan"
                            ? "text-[#00D4FF]"
                            : "text-white/50"
                        }`}
                      >
                        {metric.value}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-white/50">{metric.label}</p>
                    </div>
                  ))}
                </div>
                {/* Signature callout */}
                <div className="relative overflow-hidden rounded-2xl border border-warning/15 bg-warning/4 px-6 py-5">
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-warning/6 to-transparent" />
                  <p className="relative font-mono text-sm leading-7 text-white/60 italic">
                    &ldquo;The gap is not between investors and data. It is between data and the analytical
                    layer that turns signals into a decision. That layer is what LyraAlpha builds.”
                  </p>
                  <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-warning/60">
                    LyraAlpha AI · Core Thesis
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
