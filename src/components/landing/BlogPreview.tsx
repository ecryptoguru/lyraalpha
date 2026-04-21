import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

import { LandingReveal } from "@/components/landing/LandingReveal";
import { getRecentPostsAsync, formatDate } from "@/lib/blog/posts";

const categoryAccent: Record<string, string> = {
  "AI & Technology":   "border-info/20 bg-info/6 text-info",
  "Market Intelligence": "border-warning/20 bg-warning/6 text-warning",
  Markets:             "border-white/15 bg-white/5 text-white/55",
};

export async function BlogPreview() {
  const posts = await getRecentPostsAsync(3);

  return (
    <section className="relative bg-[#040816] px-4 py-20 sm:px-6 sm:py-24">
      {/* Subtle top separator glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)]" />

      <div className="container mx-auto max-w-7xl px-0">
        <LandingReveal>
          {/* Header row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.42em] text-warning/65">
                From the journal
              </p>
              <h2 className="mt-3 text-3xl font-light tracking-[-0.04em] text-white sm:text-4xl">
                Intelligence,{" "}
                <span className="text-warning">written down.</span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/40">
                Deep dives on AI-grounded analysis, market regimes, and how
                serious investors think about financial decisions.
              </p>
            </div>
            <Link
              href="/blog"
              className="group shrink-0 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/55 transition-all duration-300 hover:border-warning/25 hover:bg-warning/6 hover:text-warning"
            >
              All articles
              <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </LandingReveal>

        {/* Cards */}
        <div className="mt-10 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <LandingReveal key={post.slug} delay={i * 80}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.022] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/14 hover:shadow-[0_16px_48px_rgba(0,0,0,0.3)]"
              >
                {/* Category badge */}
                <span
                  className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.28em] ${
                    categoryAccent[post.category] ??
                    "border-white/15 bg-white/5 text-white/50"
                  }`}
                >
                  {post.category}
                </span>

                {/* Title */}
                <h3 className="mt-4 flex-1 text-base font-semibold leading-snug tracking-tight text-white transition-colors group-hover:text-primary/60 sm:text-[17px]">
                  {post.title}
                </h3>

                {/* Description */}
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/38">
                  {post.description}
                </p>

                {/* Footer meta */}
                <div className="mt-5 flex items-center gap-3 border-t border-white/6 pt-4">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/28">
                    <Clock className="h-2.5 w-2.5" />
                    {post.readingTime}
                  </span>
                  <span className="font-mono text-[10px] text-white/28">
                    {formatDate(post.date)}
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-warning/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-warning" />
                </div>
              </Link>
            </LandingReveal>
          ))}
        </div>

        {/* Bottom CTA */}
        <LandingReveal delay={280}>
          <div className="mt-10 flex justify-center">
            <Link
              href="/blog"
              className="group inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-white/35 transition-all duration-300 hover:text-warning"
            >
              View all articles
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
