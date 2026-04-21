import "dotenv/config";

/**
 * Batch script to generate hero images for blog posts that are missing them.
 * Processes weeks 11-15 (20 posts total, 4 per week).
 *
 * Usage:
 *   npx tsx scripts/generate-hero-images-batch.ts --week all      # process all weeks
 *   npx tsx scripts/generate-hero-images-batch.ts --week 11-12   # session 1
 *   npx tsx scripts/generate-hero-images-batch.ts --week 13-14  # session 2
 *   npx tsx scripts/generate-hero-images-batch.ts --week 15     # session 3
 */

import { week11Posts } from "../src/lib/blog/blogs-week11";
import { week12Posts } from "../src/lib/blog/blogs-week12";
import { week13Posts } from "../src/lib/blog/blogs-week13";
import { week14Posts } from "../src/lib/blog/blogs-week14";
import { week15Posts } from "../src/lib/blog/blogs-week15";
import { generateBlogHeroImage } from "../src/lib/blog/image-generator";
import { createLogger } from "../src/lib/logger";

const logger = createLogger({ service: "hero-image-batch" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogPost {
  slug: string;
  title: string;
  category: string;
  /** generateBlogHeroImage expects keywords; posts export 'tags' as fallback */
  keywords?: string[];
  tags: string[];
  heroImageUrl?: string;
}

function getKeywords(post: BlogPost): string[] {
  return post.keywords ?? post.tags;
}

// ---------------------------------------------------------------------------
// Week groupings for batching
// ---------------------------------------------------------------------------

const WEEK_MAP = {
  "11": week11Posts as BlogPost[],
  "12": week12Posts as BlogPost[],
  "13": week13Posts as BlogPost[],
  "14": week14Posts as BlogPost[],
  "15": week15Posts as BlogPost[],
};

type WeekRange = "all" | "11-12" | "13-14" | "15";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): WeekRange {
  const idx = process.argv.indexOf("--week");
  if (idx === -1 || idx + 1 >= process.argv.length) return "all";

  const raw = process.argv[idx + 1].trim();
  if (raw === "all") return "all";
  if (raw === "11-12") return "11-12";
  if (raw === "13-14") return "13-14";
  if (raw === "15") return "15";

  // Fallback: treat as a single week number
  if (/^\d+$/.test(raw) && raw in WEEK_MAP) return raw as WeekRange;

  logger.warn({ raw }, "Unrecognized --week value, defaulting to 'all'");
  return "all";
}

// ---------------------------------------------------------------------------
// Determine which weeks to process
// ---------------------------------------------------------------------------

function getWeeksToProcess(range: WeekRange): BlogPost[][] {
  switch (range) {
    case "11-12":
      return [week11Posts, week12Posts];
    case "13-14":
      return [week13Posts, week14Posts];
    case "15":
      return [week15Posts];
    case "all":
    default:
      return [week11Posts, week12Posts, week13Posts, week14Posts, week15Posts];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const range = parseArgs();
  const weeks = getWeeksToProcess(range);

  logger.info({ range, weekCount: weeks.length }, "Starting hero image batch");

  let generated = 0;
  let failed = 0;

  for (const weekPosts of weeks) {
    for (const post of weekPosts) {
      if (post.heroImageUrl) {
        logger.debug({ slug: post.slug }, "Skipping — hero image already exists");
        continue;
      }

      try {
        const result = await generateBlogHeroImage({
          title: post.title,
          category: post.category,
          keywords: getKeywords(post),
          slug: post.slug,
        });
        logger.info(
          { slug: post.slug, heroImageUrl: result.heroImageUrl },
          "Generated",
        );
        generated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ slug: post.slug, error: message }, "Failed");
        failed++;
      }
    }
  }

  logger.info(
    { generated, failed, total: generated + failed },
    `Generated ${generated} images, ${failed} failed`,
  );
}

main().catch((err) => {
  logger.fatal({ err }, "Batch script crashed");
  process.exit(1);
});