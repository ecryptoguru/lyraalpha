#!/usr/bin/env tsx
/**
 * Rewrite All 100 Blogs with Premium Content
 * Updates existing blogs in database with research-backed, humanized content
 * 
 * Run: npx tsx scripts/rewrite-all-blogs-premium.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generatePremiumContent, BlogPostData } from "./generate-premium-blog";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

// Import all posts from the data file
import { ALL_SEO_POSTS, SEOPost } from "./seo-blogs-data";

// Convert SEOPost to BlogPostData format
const convertToBlogPostData = (post: SEOPost): BlogPostData => ({
  slug: post.slug,
  title: post.title,
  description: post.description,
  section: post.section,
  category: post.category,
  tags: post.tags,
  keywords: post.keywords,
  priority: post.priority,
  featured: post.featured,
});

async function rewriteAllBlogs() {
  console.log("\n========================================");
  console.log("Premium Blog Rewrite Script");
  console.log("========================================");
  console.log(`Target: ${ALL_SEO_POSTS.length} blogs`);
  console.log("Quality: Research-backed, humanized, GEO-optimized");
  console.log("========================================\n");

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < ALL_SEO_POSTS.length; i++) {
    const seoPost = ALL_SEO_POSTS[i];
    const post = convertToBlogPostData(seoPost);
    
    try {
      // Check if post exists
      const existing = await prisma.blogPost.findUnique({
        where: { slug: post.slug },
      });

      if (!existing) {
        console.log(`⚠️  SKIPPED: ${post.slug} (not found in database)`);
        continue;
      }

      // Generate premium content
      const content = generatePremiumContent(post);
      const wordCount = content.split(/\s+/).length;

      // Update in database
      await prisma.blogPost.update({
        where: { slug: post.slug },
        data: {
          content,
          updatedAt: new Date(),
        },
      });

      updated++;
      console.log(`✅ UPDATED: ${post.slug} (${wordCount} words)`);

      // Small delay to prevent database overload
      if (i % 10 === 0 && i > 0) {
        console.log(`   ... ${i}/${ALL_SEO_POSTS.length} complete`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      failed++;
      console.error(`❌ FAILED: ${post.slug}`);
      console.error(`   ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================");
  console.log(`Updated: ${updated}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Total:   ${ALL_SEO_POSTS.length}`);
  console.log("========================================");

  await prisma.$disconnect();
}

rewriteAllBlogs().catch((error) => {
  console.error("Script failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
