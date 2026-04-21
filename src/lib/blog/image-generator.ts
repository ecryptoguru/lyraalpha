import { generateImageImage } from "@/lib/ai/image";
import { buildHeroImagePrompt } from "@/lib/images/prompts";
import { createLogger } from "@/lib/logger";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const logger = createLogger({ service: "blog-hero-generator" });

export interface GenerateBlogHeroImageParams {
  title: string;
  category: string;
  keywords: string[];
  slug: string;
}

export interface GenerateBlogHeroImageResult {
  heroImageUrl: string;
  path: string;
}

/**
 * Generates a premium hero image for a blog post using GPT Image 1.5.
 * Saves the JPEG to public/blog/{slug}-hero.jpg and returns the public URL.
 */
export async function generateBlogHeroImage({
  title,
  category,
  keywords,
  slug,
}: GenerateBlogHeroImageParams): Promise<GenerateBlogHeroImageResult> {
  // Build prompt
  const prompt = buildHeroImagePrompt(title, category, keywords);
  logger.info({ slug, promptLength: prompt.length }, "Generating hero image for blog post");

  // Generate image (medium quality, 1536x1024 landscape)
  const imageBytes = await generateImageImage({
    prompt,
    size: "1536x1024",
    quality: "medium",
  });

  // Ensure public/blog directory exists
  const blogDir = join(process.cwd(), "public", "blog");
  await mkdir(blogDir, { recursive: true });

  // Save JPEG
  const filename = `${slug}-hero.jpg`;
  const filePath = join(blogDir, filename);
  await writeFile(filePath, imageBytes);
  logger.info({ filePath, sizeBytes: imageBytes.length }, "Hero image saved");

  // Return public URL path
  const heroImageUrl = `/blog/${filename}`;
  return { heroImageUrl, path: filePath };
}