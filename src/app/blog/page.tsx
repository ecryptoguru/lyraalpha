import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Tag } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getAllPosts, getAllTags, getAllCategories, formatDate } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog | InsightAlpha AI — Market Intelligence & Financial Analysis",
  description:
    "Deep dives on AI-grounded financial analysis, market regimes, deterministic scoring, and intelligent investing across US and India markets.",
  alternates: {
    canonical: "https://insightalpha.ai/blog",
  },
  openGraph: {
    title: "Blog | InsightAlpha AI",
    description:
      "Deep dives on AI-grounded financial analysis, market regimes, deterministic scoring, and intelligent investing across US and India markets.",
    url: "https://insightalpha.ai/blog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | InsightAlpha AI",
    description:
      "Deep dives on AI-grounded financial analysis, market regimes, deterministic scoring, and intelligent investing.",
  },
};

const accentColors: Record<string, string> = {
  "AI & Technology": "border-teal-400/20 bg-teal-400/6 text-teal-300",
  "Market Intelligence": "border-amber-400/20 bg-amber-400/6 text-amber-300",
  Markets: "border-white/15 bg-white/5 text-white/60",
};

export default async function BlogPage() {
  const [sorted, allTags, allCategories] = await Promise.all([
    getAllPosts(),
    getAllTags(),
    getAllCategories(),
  ]);
  const [featured, ...rest] = sorted;

  return (
    <div className="flex min-h-screen flex-col bg-[#040816] font-sans text-white selection:bg-amber-300/30">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-40">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(245,158,11,0.07),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[80px_80px] opacity-[0.04]" />

          <div className="container relative mx-auto max-w-7xl px-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.42em] text-amber-400/70">
              InsightAlpha AI · Journal
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Intelligence,{" "}
              <span className="text-amber-400">written down.</span>
            </h1>
            <p className="mt-6 max-w-2xl font-mono text-sm leading-8 text-white/45 sm:text-base">
              Deep dives on deterministic analysis, AI-grounded financial
              intelligence, market regimes, and how serious investors think
              about US and India markets.
            </p>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <div className="container mx-auto max-w-7xl px-0">

            {/* Featured post */}
            {featured && (
              <Link
                href={`/blog/${featured.slug}`}
                className="group relative mb-10 block overflow-hidden rounded-3xl border border-white/8 bg-white/[0.022] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/20 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:p-10"
              >
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-400/4 to-transparent" />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.28em] ${accentColors[featured.category] ?? "border-white/15 bg-white/5 text-white/55"}`}>
                      {featured.category}
                    </span>
                    <span className="font-mono text-[10px] text-white/30">
                      Featured
                    </span>
                  </div>
                  <h2 className="mt-5 max-w-3xl text-2xl font-light leading-snug tracking-[-0.03em] text-white transition-colors group-hover:text-amber-100 sm:text-3xl lg:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
                    {featured.description}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-white/35">
                    <span className="flex items-center gap-1.5 font-mono text-[10px]">
                      <Clock className="h-3 w-3" />
                      {featured.readingTime}
                    </span>
                    <span className="font-mono text-[10px]">
                      {formatDate(featured.date)}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-400 transition-all group-hover:gap-2.5">
                      Read article
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts */}
            {rest.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.022] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_16px_48px_rgba(0,0,0,0.25)]"
                  >
                    <div className="flex-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.28em] ${accentColors[post.category] ?? "border-white/15 bg-white/5 text-white/55"}`}>
                        {post.category}
                      </span>
                      <h2 className="mt-4 text-base font-semibold leading-snug tracking-tight text-white transition-colors group-hover:text-amber-100 sm:text-lg">
                        {post.title}
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-white/42">
                        {post.description}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center gap-3 border-t border-white/6 pt-4 text-white/30">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="h-3 w-3" />
                        {post.readingTime}
                      </span>
                      <span className="font-mono text-[10px]">
                        {formatDate(post.date)}
                      </span>
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-amber-400/50 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-amber-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Category links */}
            <div className="mt-16 border-t border-white/8 pt-12">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.36em] text-white/30">
                Categories
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {allCategories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/blog/category/${encodeURIComponent(cat.toLowerCase().replace(/\s+/g, "-"))}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] transition-opacity hover:opacity-80 ${accentColors[cat] ?? "border-white/8 bg-white/3 text-white/45"}`}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>

            {/* Tags cloud */}
            <div className="mt-10 border-t border-white/8 pt-10">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.36em] text-white/30">
                Topics
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {allTags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/3 px-3 py-1.5 font-mono text-[10px] text-white/45"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
