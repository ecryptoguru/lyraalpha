/**
 * Batch script to generate hero images for all 100 static blog posts.
 * Usage:
 *   npx tsx scripts/generate-blog-hero-images.ts                  # run all posts
 *   npx tsx scripts/generate-blog-hero-images.ts --start 1 --end 4  # run posts 1-4
 *   npx tsx scripts/generate-blog-hero-images.ts --start 5 --end 50 # run posts 5-50
 */

import { generateBlogHeroImage } from "@/lib/blog/image-generator";
import { createLogger } from "@/lib/logger";
import { writeFile } from "fs/promises";
import { join } from "path";

// Import all weekly posts
import { week1Posts } from "@/lib/blog/blogs-week1";
import { week2Posts } from "@/lib/blog/blogs-week2";
import { week3Posts } from "@/lib/blog/blogs-week3";
import { week4Posts } from "@/lib/blog/blogs-week4";
import { week5Posts } from "@/lib/blog/blogs-week5";
import { week6Posts } from "@/lib/blog/blogs-week6";
import { week7Posts } from "@/lib/blog/blogs-week7";
import { week8Posts } from "@/lib/blog/blogs-week8";
import { week9Posts } from "@/lib/blog/blogs-week9";
import { week10Posts } from "@/lib/blog/blogs-week10";
import { week11Posts } from "@/lib/blog/blogs-week11";
import { week12Posts } from "@/lib/blog/blogs-week12";
import { week13Posts } from "@/lib/blog/blogs-week13";
import { week14Posts } from "@/lib/blog/blogs-week14";
import { week15Posts } from "@/lib/blog/blogs-week15";
import { week16Posts } from "@/lib/blog/blogs-week16";
import { week17Posts } from "@/lib/blog/blogs-week17";
import { week18Posts } from "@/lib/blog/blogs-week18";
import { week19Posts } from "@/lib/blog/blogs-week19";
import { week20Posts } from "@/lib/blog/blogs-week20";
import { week21Posts } from "@/lib/blog/blogs-week21";
import { week22Posts } from "@/lib/blog/blogs-week22";
import { week23Posts } from "@/lib/blog/blogs-week23";
import { week24Posts } from "@/lib/blog/blogs-week24";
import { week25Posts } from "@/lib/blog/blogs-week25";

const logger = createLogger({ service: "batch-hero-generator" });

// Aggregate all posts
const allPosts = [
  ...week1Posts,
  ...week2Posts,
  ...week3Posts,
  ...week4Posts,
  ...week5Posts,
  ...week6Posts,
  ...week7Posts,
  ...week8Posts,
  ...week9Posts,
  ...week10Posts,
  ...week11Posts,
  ...week12Posts,
  ...week13Posts,
  ...week14Posts,
  ...week15Posts,
  ...week16Posts,
  ...week17Posts,
  ...week18Posts,
  ...week19Posts,
  ...week20Posts,
  ...week21Posts,
  ...week22Posts,
  ...week23Posts,
  ...week24Posts,
  ...week25Posts,
];

// Deduplicate by slug (some posts may appear in multiple week files)
// Type assertion: all posts in weekly files have `keywords` field per blog post schema
const uniquePosts = Array.from(
  new Map(allPosts.map((p) => [p.slug, p])).values()
) as Array<{ slug: string; title: string; category: string; tags: string[] }>;

// Parse CLI range arguments
function parseRangeArgs(): { start: number; end: number } {
  const args = process.argv.slice(2);
  let start = 1;
  let end = uniquePosts.length;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && i + 1 < args.length) {
      start = parseInt(args[i + 1], 10);
    }
    if (args[i] === "--end" && i + 1 < args.length) {
      end = parseInt(args[i + 1], 10);
    }
  }

  // Clamp values
  if (start < 1) start = 1;
  if (end > uniquePosts.length) end = uniquePosts.length;

  return { start, end };
}

const { start: rangeStart, end: rangeEnd } = parseRangeArgs();

// Slice to selected range (1-indexed, inclusive)
const selectedPosts = uniquePosts.slice(rangeStart - 1, rangeEnd);

interface HeroMapping {
  [slug: string]: string;
}

async function main() {
  const results: HeroMapping = {};
  const failures: Array<{ slug: string; error: string }> = [];

  logger.info(
    { range: `${rangeStart}-${rangeEnd}`, total: uniquePosts.length },
    `Generating posts ${rangeStart}-${rangeEnd} of ${uniquePosts.length}`
  );

  for (let i = 0; i < selectedPosts.length; i++) {
    const post = selectedPosts[i];
    const progress = `${i + 1}/${selectedPosts.length}`;

    try {
      const { heroImageUrl } = await generateBlogHeroImage({
        title: post.title,
        category: post.category,
        keywords: post.tags ?? [],
        slug: post.slug,
      });
      results[post.slug] = heroImageUrl;
      logger.info({ progress, slug: post.slug, heroImageUrl }, "Generated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failures.push({ slug: post.slug, error: errorMessage });
      logger.error({ progress, slug: post.slug, error: errorMessage }, "Failed");
    }
  }

  // Write heroes.json mapping
  const heroesPath = join(process.cwd(), "src", "lib", "blog", "heroes.json");
  await writeFile(heroesPath, JSON.stringify(results, null, 2));
  logger.info({ heroesPath }, "Wrote heroes.json");

  // Summary
  const successCount = Object.keys(results).length;
  const failureCount = failures.length;

  console.log("\n========================================");
  console.log(`Hero Image Generation Complete`);
  console.log("========================================");
  console.log(`Range: ${rangeStart}-${rangeEnd} of ${uniquePosts.length} total`);
  console.log(`Success: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Output: ${heroesPath}`);

  if (failures.length > 0) {
    console.log("\nFailed posts:");
    for (const f of failures) {
      console.log(`  - ${f.slug}: ${f.error}`);
    }
  }

  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch((error) => {
  logger.error({ error }, "Fatal error in batch script");
  process.exit(1);
});