import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const sections = [
  {
    title: "Deterministic Engine First",
    body: "Every signal LyraAlpha produces — trend score, volatility regime, price action pattern — is computed by deterministic engines before any AI touches it. The AI never invents a metric; it only interprets what the engines already measured.",
  },
  {
    title: "No Hallucinated Metrics",
    body: "Generic LLMs confidently invent price targets, P/E ratios and sector classifications. LyraAlpha's AI is only allowed to reference numbers that were computed by the signal layer. If a metric wasn't computed, it isn't shown.",
  },
  {
    title: "Market Regime Awareness",
    body: "Before any analysis, the platform classifies the current market regime (bull trend, bear trend, high volatility, accumulation, distribution). Every response is contextualised against the active regime so reasoning stays grounded.",
  },
  {
    title: "5 Asset Classes, One System",
    body: "Equities (NSE/BSE & NYSE/NASDAQ), crypto, ETFs, indices and commodities are all analysed through the same deterministic pipeline — ensuring consistent signal quality across markets.",
  },
  {
    title: "Lyra vs Raw Data",
    body: "Lyra is not a data lookup tool. It is a reasoning layer. It takes your question, the engine-computed signals and the current market context and produces a structured thesis — setup, risk, next step — not a data dump.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#040816]">
      <Navbar />
      <main className="flex-1 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-warning/80">Methodology</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            How LyraAlpha<br />
            <span className="text-warning">avoids hallucinations.</span>
          </h1>
          <p className="mt-5 text-base text-white/55 leading-7">
            Most AI finance tools fail because they let a language model generate metrics from memory. LyraAlpha inverts this: compute first, interpret second. Every number shown was computed. Every insight references only computed numbers.
          </p>

          <div className="mt-16 space-y-12">
            {sections.map((s, i) => (
              <div key={s.title} className="flex gap-6">
                <div className="shrink-0 mt-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-warning/20 bg-warning/8 text-[11px] font-black text-warning">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{s.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-white/55">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
