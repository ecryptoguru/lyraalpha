import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export interface PublicToolPathItem {
  label: string;
  detail: string;
}

export interface PublicToolCardItem {
  title: string;
  description: string;
  href: string;
}

export interface PublicToolExampleItem {
  label: string;
  prompt: string;
  output: string;
}

export interface PublicToolComparisonRow {
  label: string;
  thisTool: string;
  alternative: string;
}

export interface PublicToolFaqItem {
  question: string;
  answer: string;
}

export function PublicToolPage({
  eyebrow,
  title,
  description,
  systemLabel,
  systemSummary,
  paths,
  ctaLabel,
  ctaHref,
  relatedTools,
  examples,
  comparisonTitle,
  comparisonAlternativeLabel,
  comparisonRows,
  faqs,
  seoIntro,
  seoBullets,
}: {
  eyebrow: string;
  title: string;
  description: string;
  systemLabel: string;
  systemSummary: string;
  paths: readonly PublicToolPathItem[];
  ctaLabel?: string;
  ctaHref?: string;
  relatedTools: readonly PublicToolCardItem[];
  examples: readonly PublicToolExampleItem[];
  comparisonTitle: string;
  comparisonAlternativeLabel: string;
  comparisonRows: readonly PublicToolComparisonRow[];
  faqs: readonly PublicToolFaqItem[];
  seoIntro: string;
  seoBullets: readonly string[];
}) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div
      className="flex h-dvh flex-col overflow-x-hidden bg-[#040816] font-sans text-white selection:bg-amber-300/30"
      suppressHydrationWarning
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,158,11,0.07),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(20,184,166,0.05),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[80px_80px]" />
      </div>

      <Navbar />

      <main
        data-scroll-root="landing"
        className="relative z-10 flex-1 overflow-x-clip overflow-y-auto scroll-smooth overscroll-contain will-change-scroll"
      >
        {/* ── Hero ── */}
        <section className="px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">

              {/* Left: headline card */}
              <div className="rounded-[2.8rem] border border-white/10 bg-white/2.8 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-10">
                <div className="mb-6">
                  <Link
                    href="/tools"
                    className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white/50 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/8 hover:text-white/80"
                  >
                    <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
                    All tools
                  </Link>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/8 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {eyebrow}
                </span>
                <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-[-0.055em] text-white sm:text-5xl">
                  {title}
                </h1>
                <p className="mt-5 max-w-xl border-l-2 border-teal-400/40 pl-5 font-mono text-sm leading-8 text-white/65 sm:text-base">
                  {description}
                </p>
                {ctaLabel && ctaHref && (
                  <div className="mt-8">
                    <Link
                      href={ctaHref}
                      className="group inline-flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-amber-400 px-8 py-3.5 font-mono text-sm font-bold text-slate-950 shadow-[0_0_40px_rgba(245,158,11,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_0_60px_rgba(245,158,11,0.4)]"
                    >
                      {ctaLabel}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Right: system summary card */}
              <div className="rounded-[2.4rem] border border-white/10 bg-white/2.5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-8">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/70">
                  {systemLabel}
                </p>
                <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
                  What this system does
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/58">{systemSummary}</p>
                <div className="mt-5 space-y-3">
                  {paths.map((path, i) => (
                    <div
                      key={path.label}
                      className={`rounded-[1.6rem] border p-4 ${
                        i === 0
                          ? "border-teal-400/20 bg-teal-400/5"
                          : i === 1
                          ? "border-amber-400/20 bg-amber-400/5"
                          : "border-white/8 bg-white/3"
                      }`}
                    >
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/38">
                        {path.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{path.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Examples ── */}
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2.4rem] border border-white/10 bg-white/2 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">
                Real examples
              </p>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                What you would actually use this for
              </h2>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {examples.map((example) => (
                  <div
                    key={example.label}
                    className="rounded-[1.9rem] border border-white/8 bg-white/3 p-5"
                  >
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-amber-300/70">
                      {example.label}
                    </p>
                    <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-black/30 p-4">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-teal-300/60">
                        Input
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/58">{example.prompt}</p>
                    </div>
                    <div className="mt-3 rounded-[1.35rem] border border-amber-400/20 bg-amber-400/5 p-4">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300/70">
                        Output
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{example.output}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison ── */}
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2.4rem] border border-white/10 bg-white/2.8 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">
                Comparison
              </p>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                {comparisonTitle}
              </h2>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[1.6rem] border border-white/8">
                  <thead>
                    <tr className="bg-black/20">
                      <th className="px-5 py-3.5 text-left font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/38">
                        Area
                      </th>
                      <th className="px-5 py-3.5 text-left font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-amber-300/70">
                        InsightAlpha
                      </th>
                      <th className="px-5 py-3.5 text-left font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/38">
                        {comparisonAlternativeLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row, i) => (
                      <tr
                        key={row.label}
                        className={`border-t border-white/6 ${i % 2 === 0 ? "bg-white/1" : ""}`}
                      >
                        <td className="px-5 py-4 text-sm font-bold text-white/90">{row.label}</td>
                        <td className="px-5 py-4 text-sm leading-6 text-white/65">{row.thisTool}</td>
                        <td className="px-5 py-4 text-sm leading-6 text-white/40">{row.alternative}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── SEO Context + FAQ ── */}
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">

              {/* SEO context */}
              <div className="rounded-[2.4rem] border border-white/10 bg-white/2 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-8">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">
                  About this system
                </p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                  How it fits into the platform
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/55">{seoIntro}</p>
                <div className="mt-5 space-y-3">
                  {seoBullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-start gap-3 rounded-[1.35rem] border border-white/8 bg-white/3 px-4 py-4"
                    >
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/60" />
                      <p className="text-sm leading-6 text-white/58">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div className="rounded-[2.4rem] border border-white/10 bg-white/2.5 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-8">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">
                  FAQ
                </p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                  Common questions
                </h2>
                <div className="mt-5 space-y-4">
                  {faqs.map((faq) => (
                    <div
                      key={faq.question}
                      className="rounded-[1.7rem] border border-white/8 bg-white/3 p-5"
                    >
                      <h3 className="text-sm font-bold text-white">{faq.question}</h3>
                      <p className="mt-2 text-sm leading-7 text-white/55">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Related tools ── */}
        <section className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2.4rem] border border-white/10 bg-white/2 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-8">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/38">
                Related systems
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {relatedTools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group rounded-[1.8rem] border border-white/8 bg-white/3 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/25 hover:bg-amber-400/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold tracking-tight text-white">{tool.title}</h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-amber-400/70" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/55">{tool.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA strip ── */}
        {ctaLabel && ctaHref && (
          <section className="px-4 pb-16 pt-4 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <div className="relative overflow-hidden rounded-[2.4rem] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.1),rgba(20,184,166,0.06)_50%,rgba(245,158,11,0.08))] p-8 shadow-[0_0_80px_rgba(245,158,11,0.08)] sm:p-10">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(245,158,11,0.06),transparent_70%)]" />
                <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/70">
                      Early access · Limited spots
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      Ready to stop guessing?
                    </h2>
                    <p className="mt-2 max-w-lg text-sm leading-7 text-white/55">
                      InsightAlpha computes before it speaks. Every AI response is grounded in deterministic engine output — no hallucinated metrics, no invented structure.
                    </p>
                  </div>
                  <Link
                    href={ctaHref}
                    className="group shrink-0 inline-flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-amber-400 px-8 py-4 font-mono text-sm font-bold text-slate-950 shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_0_60px_rgba(245,158,11,0.45)]"
                  >
                    {ctaLabel}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        <Footer />
      </main>
    </div>
  );
}
