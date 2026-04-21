import Link from "next/link";
import { Tag, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCache } from "@/lib/redis";
import { TrendingQuestionService } from "@/lib/services/trending-question.service";
import type { BlogPost } from "@/lib/blog/posts";

interface Props {
  post: BlogPost;
}

async function getTrendingQueries(): Promise<string[]> {
  try {
    const CACHE_KEY = "lyra:trending";
    const cached = await getCache(CACHE_KEY);
    if (cached && typeof cached === "object" && "questions" in cached) {
      const q = (cached as { questions: { question: string }[] }).questions;
      return q.slice(0, 4).map((x) => x.question);
    }

    let questions = await prisma.trendingQuestion.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      take: 4,
      select: { question: true },
    });

    if (questions.length === 0) {
      questions = TrendingQuestionService.getCuratedFallback().slice(0, 4);
    }

    return questions.map((q) => q.question);
  } catch {
    return [];
  }
}

async function TrendingWidget() {
  const queries = await getTrendingQueries();
  if (queries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.022] p-5">
      <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.32em] text-white/30">
        <TrendingUp className="h-3 w-3" />
        Trending on LyraAlpha
      </p>
      <ul className="mt-3 space-y-2">
        {queries.map((q) => (
          <li key={q}>
            <Link
              href={`/sign-up?q=${encodeURIComponent(q)}`}
              className="block text-xs leading-5 text-white/40 transition-colors hover:text-white/70"
            >
              {q}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function BlogSidebar({ post }: Props) {
  const { userId } = await auth();
  const isLoggedIn = Boolean(userId);

  const lyraQuery = encodeURIComponent(
    `Tell me more about ${post.tags.slice(0, 2).join(" and ")} in the context of ${post.category}`,
  );

  return (
    <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
      {/* Tags */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.022] p-5">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.32em] text-white/30">
          Topics
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/3 px-2.5 py-1 font-mono text-[9px] text-white/40"
            >
              <Tag className="h-2 w-2" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Trending widget */}
      <TrendingWidget />

      {/* CTA — contextual based on auth state */}
      {isLoggedIn ? (
        <div className="relative overflow-hidden rounded-2xl border border-info/20 bg-info/5 p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-info/40 to-transparent" />
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-info/70">
            Ask Lyra
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-white/70">
            Explore this topic with AI-grounded analysis on your portfolio.
          </p>
          <Link
            href={`/dashboard/lyra?q=${lyraQuery}`}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-info/10 px-4 py-2.5 font-mono text-[10px] font-bold text-info ring-1 ring-info/20 transition-all hover:bg-info/20"
          >
            Ask Lyra about this →
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-warning/20 bg-warning/5 p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-warning/40 to-transparent" />
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-info/70">
            Beta · Free access
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-white/70">
            The platform that computes before it speaks. Try it free during Beta.
          </p>
          <Link
            href="/sign-up"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-warning px-4 py-2.5 font-mono text-[10px] font-bold text-foreground transition-all hover:bg-warning4739"
          >
            Start Free Beta
          </Link>
        </div>
      )}
    </aside>
  );
}
