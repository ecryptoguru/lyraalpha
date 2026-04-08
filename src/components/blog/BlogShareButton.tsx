"use client";

import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { createShareObject } from "@/lib/intelligence-share";
import type { BlogPost } from "@/lib/blog/posts";

interface Props {
  post: BlogPost;
}

export function BlogShareButton({ post }: Props) {
  const shareObject = createShareObject({
    kind: "generic",
    mode: "insight",
    title: post.title,
    eyebrow: post.category,
    takeaway: post.description,
    context: `${post.readingTime} · ${post.author}`,
    href: `/blog/${post.slug}`,
  });

  return (
    <ShareInsightButton
      share={shareObject}
      label="Share"
      className="border-white/10 bg-white/3 text-white/45 hover:border-amber-400/20 hover:text-amber-300"
    />
  );
}
