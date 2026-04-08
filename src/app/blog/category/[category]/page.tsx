import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getAllPosts, getAllCategories, formatDate } from "@/lib/blog/posts";

interface Props {
  params: Promise<{ category: string }>;
}

async function resolveCategoryPosts(categorySlug: string) {
  const all = await getAllPosts();
  const decoded = decodeURIComponent(categorySlug);
  return all.filter(
    (p) => p.category.toLowerCase().replace(/\s+/g, "-") === decoded.toLowerCase(),
  );
}

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((cat) => ({
    category: cat.toLowerCase().replace(/\s+/g, "-"),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const posts = await resolveCategoryPosts(category);
  if (posts.length === 0) return {};

  const categoryName = posts[0].category;
  const url = `https://lyraalpha.ai/blog/category/${category}`;

  return {
    title: `${categoryName} | LyraAlpha AI Blog`,
    description: `Articles on ${categoryName} — AI-grounded financial analysis, market regimes, and intelligent investing from LyraAlpha AI.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${categoryName} | LyraAlpha AI`,
      description: `Articles on ${categoryName} from LyraAlpha AI.`,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${categoryName} | LyraAlpha AI`,
      description: `Articles on ${categoryName} from LyraAlpha AI.`,
    },
  };
}

const accentColors: Record<string, string> = {
  "AI & Technology": "border-teal-400/20 bg-teal-400/6 text-teal-300",
  "Market Intelligence": "border-amber-400/20 bg-amber-400/6 text-amber-300",
  Markets: "border-white/15 bg-white/5 text-white/60",
};

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const posts = await resolveCategoryPosts(category);

  if (posts.length === 0) notFound();

  const categoryName = posts[0].category;
  const allCategories = await getAllCategories();

  return (
    <div className="flex min-h-screen flex-col bg-[#040816] font-sans text-white selection:bg-amber-300/30">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-40">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(245,158,11,0.06),transparent_65%)]" />
          <div className="container relative mx-auto max-w-7xl px-0">
            <Link
              href="/blog"
              className="group mb-8 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35 transition-colors hover:text-amber-400"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              All articles
            </Link>

            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.42em] text-amber-400/70">
              LyraAlpha AI · Category
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              {categoryName}
            </h1>
            <p className="mt-4 font-mono text-sm text-white/35">
              {posts.length} {posts.length === 1 ? "article" : "articles"}
            </p>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <div className="container mx-auto max-w-7xl px-0">
            {/* Posts grid */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.022] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_16px_48px_rgba(0,0,0,0.25)]"
                >
                  {post.heroImageUrl && (
                    <div className="mb-4 -mx-6 -mt-6 h-36 overflow-hidden">
                      <Image
                        src={post.heroImageUrl}
                        alt={post.title}
                        width={600}
                        height={144}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                      />
                    </div>
                  )}
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

            {/* Other categories */}
            <div className="mt-16 border-t border-white/8 pt-12">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.36em] text-white/30">
                Other categories
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {allCategories
                  .filter((cat) => cat !== categoryName)
                  .map((cat) => (
                    <Link
                      key={cat}
                      href={`/blog/category/${encodeURIComponent(cat.toLowerCase().replace(/\s+/g, "-"))}`}
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 font-mono text-[10px] transition-opacity hover:opacity-80 ${accentColors[cat] ?? "border-white/8 bg-white/3 text-white/45"}`}
                    >
                      {cat}
                    </Link>
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
