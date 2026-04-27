import { getAllPosts } from "@/lib/blog/posts";
import { escHtml } from "@/lib/utils/html";

export const revalidate = 3600;

function escXml(str: string): string {
  return escHtml(str).replace(/'/g, "&apos;");
}

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

function imageEnclosureMime(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME[ext] ?? "image/jpeg";
}

export async function GET() {
  const posts = await getAllPosts();
  const BASE_URL = process.env.APP_URL || "https://lyraalpha.xyz";

  const items = posts
    .map((post) => {
      const url = `${BASE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.date).toUTCString();
      const description = escXml(post.metaDescription ?? post.description);
      const title = escXml(post.title);
      const author = escXml(post.author);
      const category = escXml(post.category);

      return `
    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <author>contact@lyraalpha.ai (${author})</author>
      <category>${category}</category>
      ${post.tags.map((t) => `<category>${escXml(t)}</category>`).join("\n      ")}
      ${post.heroImageUrl ? `<enclosure url="${escXml(post.heroImageUrl)}" type="${imageEnclosureMime(post.heroImageUrl)}" length="0" />` : ""}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>LyraAlpha AI — Market Intelligence Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Deep dives on AI-grounded financial analysis, market regimes, deterministic scoring, and intelligent investing across US and India markets.</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/logo.png</url>
      <title>LyraAlpha AI</title>
      <link>${BASE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
