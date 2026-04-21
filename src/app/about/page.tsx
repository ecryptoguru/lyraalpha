import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#040816]">
      <Navbar />
      <main className="flex-1 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-warning/80">About</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Built for investors<br />
            <span className="text-warning">who think seriously.</span>
          </h1>
          <p className="mt-6 text-base text-white/55 leading-7">
            LyraAlpha AI is a financial intelligence platform that grounds every AI response in deterministic engine computation — so the analysis you get is reasoned, not hallucinated.
          </p>
          <p className="mt-4 text-base text-white/55 leading-7">
            We serve retail and semi-professional investors across India and the US who are tired of tools that generate confident-sounding noise. Our platform covers 5 asset classes: equities (NSE/BSE and NYSE/NASDAQ), crypto, ETFs, indices and commodities.
          </p>
          <p className="mt-4 text-base text-white/55 leading-7">
            The core thesis: most AI finance tools fail because they let a language model generate metrics from memory. LyraAlpha inverts this — compute first, interpret second. Every number shown was computed. Every insight references only computed numbers.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { stat: "250M+", label: "Target investors, US & India" },
              { stat: "6", label: "Deterministic signals computed first" },
              { stat: "5", label: "Asset classes in one system" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-white/3 p-6">
                <p className="text-3xl font-black text-warning">{item.stat}</p>
                <p className="mt-2 text-sm text-white/50 uppercase tracking-wider">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link
              href="/sign-up"
              className="inline-flex items-center rounded-full bg-warning px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-warning2496"
            >
              Start for Free
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
