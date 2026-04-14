import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getAllPosts, formatDate } from "@/lib/blog/posts";
import { BLOG_SECTIONS, SECTION_COLORS, CATEGORY_TO_SECTION } from "@/lib/blog/blog-sections";

interface Props {
  params: Promise<{ section: string }>;
}

// Build reverse mapping: section slug -> categories
const SECTION_TO_CATEGORIES: Record<string, string[]> = {};
for (const [category, sectionSlug] of Object.entries(CATEGORY_TO_SECTION)) {
  if (!SECTION_TO_CATEGORIES[sectionSlug]) {
    SECTION_TO_CATEGORIES[sectionSlug] = [];
  }
  SECTION_TO_CATEGORIES[sectionSlug].push(category);
}

async function resolveSectionPosts(sectionSlug: string) {
  const all = await getAllPosts();
  const categories = SECTION_TO_CATEGORIES[sectionSlug];
  if (!categories) return [];
  
  return all.filter((p) => categories.includes(p.category));
}

function getSectionBySlug(slug: string) {
  return BLOG_SECTIONS.find((s) => s.slug === slug);
}

export async function generateStaticParams() {
  return BLOG_SECTIONS.map((section) => ({
    section: section.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const sectionData = getSectionBySlug(section);
  if (!sectionData) return {};

  const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://lyraalpha.xyz"}/blog/section/${section}`;

  return {
    title: `${sectionData.name} | LyraAlpha AI Blog`,
    description: `${sectionData.description} — Explore ${sectionData.postCount}+ articles on ${sectionData.name} from LyraAlpha AI.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${sectionData.name} | LyraAlpha AI`,
      description: sectionData.description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${sectionData.name} | LyraAlpha AI`,
      description: sectionData.description,
    },
  };
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const sectionData = getSectionBySlug(section);
  
  if (!sectionData) notFound();
  
  const posts = await resolveSectionPosts(section);
  const colors = SECTION_COLORS[sectionData.color];

  return (
    <div className="flex min-h-screen flex-col bg-[#040816] font-sans text-white selection:bg-amber-300/30">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-40">
          <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(245,158,11,0.06),transparent_65%)]`} />
          <div className="container relative mx-auto max-w-7xl px-0">
            <Link
              href="/blog"
              className="group mb-8 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35 transition-colors hover:text-amber-400"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              All articles
            </Link>

            <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.42em] ${colors.text}`}>
              LyraAlpha AI · Section
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              {sectionData.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">
              {sectionData.description}
            </p>
            <p className="mt-3 font-mono text-sm text-white/35">
              {posts.length} {posts.length === 1 ? "article" : "articles"}
            </p>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <div className="container mx-auto max-w-7xl px-0">
            {/* Posts grid */}
            {posts.length > 0 ? (
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
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.28em] ${colors.border} ${colors.bg} ${colors.text}`}>
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
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.022] p-12 text-center">
                <p className="text-white/55">No articles found in this section yet.</p>
                <Link
                  href="/blog"
                  className="mt-4 inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
                >
                  Browse all articles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            {/* Other sections */}
            <div className="mt-16 border-t border-white/8 pt-12">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.36em] text-white/30">
                Explore other sections
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {BLOG_SECTIONS.filter((s) => s.slug !== section).map((s) => {
                  const sColors = SECTION_COLORS[s.color];
                  return (
                    <Link
                      key={s.id}
                      href={`/blog/section/${s.slug}`}
                      className={`group rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${sColors.border} ${sColors.bg}`}
                    >
                      <h3 className={`text-sm font-medium ${sColors.text}`}>
                        {s.name}
                      </h3>
                      <p className="mt-1 text-xs text-white/45 line-clamp-2">
                        {s.description}
                      </p>
                      <span className="mt-2 block font-mono text-[9px] text-white/35">
                        {s.postCount} articles
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
