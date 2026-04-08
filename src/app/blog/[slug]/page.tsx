import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock, Calendar } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getAllSlugs, getRecentPostsAsync, getPostBySlugAsync, formatDate } from "@/lib/blog/posts";
import { tokenizeInline } from "@/lib/blog/content-parser";
import { BlogShareButton } from "@/components/blog/BlogShareButton";
import { BlogReadingProgress } from "@/components/blog/BlogReadingProgress";
import { BlogSidebar } from "@/components/blog/BlogSidebar";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlugAsync(slug);
  if (!post) return {};

  const url = `https://lyraalpha.ai/blog/${post.slug}`;
  const ogImages = post.heroImageUrl
    ? [{ url: post.heroImageUrl, width: 1200, height: 630, alt: post.title }]
    : [{ url: "https://lyraalpha.ai/og-default.png", width: 1200, height: 630, alt: "LyraAlpha AI" }];

  return {
    title: `${post.title} | LyraAlpha AI Blog`,
    description: post.metaDescription ?? post.description,
    keywords: post.keywords ?? post.tags,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.metaDescription ?? post.description,
      url,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.metaDescription ?? post.description,
      images: ogImages.map((img) => img.url),
    },
  };
}

function JsonLd({ post }: { post: NonNullable<Awaited<ReturnType<typeof getPostBySlugAsync>>> }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription ?? post.description,
    author: {
      "@type": "Organization",
      name: post.author,
      url: "https://lyraalpha.ai",
    },
    publisher: {
      "@type": "Organization",
      name: "LyraAlpha AI",
      url: "https://lyraalpha.ai",
      logo: {
        "@type": "ImageObject",
        url: "https://lyraalpha.ai/logo.png",
      },
    },
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://lyraalpha.ai/blog/${post.slug}`,
    },
    keywords: (post.keywords ?? post.tags).join(", "),
    ...(post.heroImageUrl ? { image: post.heroImageUrl } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function parseInline(text: string): React.ReactNode[] {
  return tokenizeInline(text).map((token, i) => {
    if (token.kind === "bold") {
      return (
        <strong key={i} className="font-semibold text-white/85">
          {token.value}
        </strong>
      );
    }
    if (token.kind === "link") {
      return (
        <a
          key={i}
          href={token.href}
          className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
          {...(token.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {token.text}
        </a>
      );
    }
    return token.value;
  });
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let bulletBuffer: string[] = [];
  let numberedBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key++} className="my-4 space-y-2 pl-5">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex items-start gap-2 leading-7 text-white/55">
            <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/60" />
            <span>{parseInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  const flushNumbered = () => {
    if (numberedBuffer.length === 0) return;
    elements.push(
      <ol key={key++} className="my-4 list-decimal space-y-2 pl-6">
        {numberedBuffer.map((item, i) => (
          <li key={i} className="leading-7 text-white/55">
            {parseInline(item)}
          </li>
        ))}
      </ol>,
    );
    numberedBuffer = [];
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    elements.push(
      <pre
        key={key++}
        className="my-5 overflow-x-auto rounded-xl border border-white/8 bg-white/3 px-5 py-4 font-mono text-xs leading-6 text-white/65"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
    codeLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Code fence toggle
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        flushBullets();
        flushNumbered();
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        flushCode();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ")) {
      flushNumbered();
      bulletBuffer.push(trimmed.slice(2));
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      flushBullets();
      numberedBuffer.push(numberedMatch[2]);
      continue;
    }

    flushBullets();
    flushNumbered();

    if (!trimmed) {
      elements.push(<div key={key++} className="h-3" />);
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={key++}
          className="mt-10 mb-4 text-xl font-semibold tracking-tight text-white sm:text-2xl"
        >
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h3
          key={key++}
          className="mt-8 mb-3 text-lg font-semibold tracking-tight text-white"
        >
          {trimmed.slice(2)}
        </h3>,
      );
    } else if (trimmed === "---") {
      elements.push(<hr key={key++} className="my-8 border-white/8" />);
    } else {
      elements.push(
        <p key={key++} className="leading-8 text-white/55">
          {parseInline(trimmed)}
        </p>,
      );
    }
  }

  // Flush any remaining buffers
  flushBullets();
  flushNumbered();
  if (inCodeBlock) flushCode();

  return elements;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlugAsync(slug);
  if (!post) notFound();

  // Fetch count+1 to guarantee 2 related posts even if current slug appears in results
  const recentPosts = await getRecentPostsAsync(4);
  const related = recentPosts.filter((p) => p.slug !== slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-[#040816] font-sans text-white selection:bg-amber-300/30">
      <JsonLd post={post} />
      <BlogReadingProgress />
      <Navbar />

      <main className="flex-1">
        {/* Hero image (agent-generated) */}
        {post.heroImageUrl && (
          <div className="relative h-64 w-full overflow-hidden sm:h-80 lg:h-96">
            <Image
              src={post.heroImageUrl}
              alt={post.title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
            {/* Logo watermark overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-[#040816] via-[#040816]/40 to-transparent" />
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                LyraAlpha AI
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <section
          className={`relative overflow-hidden px-4 pb-12 sm:px-6 ${post.heroImageUrl ? "pt-10" : "pt-32 sm:pt-40"}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_20%,rgba(245,158,11,0.06),transparent_60%)]" />
          <div className="container relative mx-auto max-w-4xl px-0">
            <Link
              href="/blog"
              className="group mb-8 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35 transition-colors hover:text-amber-400"
            >
              <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
              All articles
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/blog/category/${encodeURIComponent(post.category.toLowerCase().replace(/\s+/g, "-"))}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/6 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-amber-300 transition-opacity hover:opacity-80"
              >
                {post.category}
              </Link>
              {post.sourceAgent && (
                <span className="font-mono text-[9px] text-white/25">
                  by {post.sourceAgent}
                </span>
              )}
            </div>

            <h1 className="mt-5 text-3xl font-light leading-snug tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 text-base leading-8 text-white/45 sm:text-lg">
              {post.description}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-5 border-t border-white/8 pt-6 text-white/32">
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                <Calendar className="h-3 w-3" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px]">
                <Clock className="h-3 w-3" />
                {post.readingTime}
              </span>
              <span className="font-mono text-[10px]">By {post.author}</span>
              <div className="ml-auto">
                <BlogShareButton post={post} />
              </div>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="px-4 pb-16 sm:px-6">
          <div className="container mx-auto max-w-4xl px-0">
            <div className="grid gap-10 lg:grid-cols-[1fr_220px]">
              {/* Article */}
              <article className="prose-custom space-y-1 text-sm sm:text-base">
                {renderContent(post.content)}
              </article>

              {/* Sidebar */}
              <BlogSidebar post={post} />
            </div>
          </div>
        </section>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="border-t border-white/8 px-4 py-16 sm:px-6">
            <div className="container mx-auto max-w-4xl px-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.36em] text-white/30">
                Continue reading
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {related.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group rounded-2xl border border-white/8 bg-white/[0.022] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15"
                  >
                    <p className="text-sm font-semibold leading-snug text-white/80 transition-colors group-hover:text-amber-100">
                      {p.title}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-white/38">{p.description}</p>
                    <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-amber-400/60 transition-all group-hover:gap-2.5 group-hover:text-amber-400">
                      Read article
                      <ArrowLeft className="h-3 w-3 rotate-180 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
