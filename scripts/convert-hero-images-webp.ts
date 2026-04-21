import "dotenv/config";
import sharp from "sharp";
import { readdir, unlink } from "fs/promises";
import { join } from "path";

const BLOG_DIR = "public/blog";
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 800;
const QUALITY = 85;

async function convertHeroImage(filename: string): Promise<{ slug: string; size: number } | null> {
  const fullPath = join(BLOG_DIR, filename);

  // Early exit if not a jpg file
  if (!filename.endsWith(".jpg")) {
    return null;
  }

  // Extract slug from filename like "ai-agents-in-defi-...-hero.jpg"
  const slug = filename.replace(/-hero\.jpg$/, "");
  const outputFilename = `${slug}-hero.webp`;
  const outputPath = join(BLOG_DIR, outputFilename);

  try {
    const result = await sharp(fullPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: QUALITY })
      .toFile(outputPath);

    // Delete original after successful conversion
    await unlink(fullPath);

    const sizeKB = (result.size / 1024).toFixed(1);
    console.log(`✓ ${outputFilename} (${sizeKB} KB)`);

    return { slug, size: result.size };
  } catch (error) {
    console.error(`✗ Failed to convert ${filename}:`, error);
    return null;
  }
}

async function main(): Promise<void> {
  console.log(`\nConverting hero images to WebP (${TARGET_WIDTH}×${TARGET_HEIGHT}, ${QUALITY}% quality)...\n`);

  let files: string[];
  try {
    files = await readdir(BLOG_DIR);
  } catch (error) {
    console.error(`Failed to read directory ${BLOG_DIR}:`, error);
    process.exit(1);
  }

  const heroFiles = files.filter((f) => f.endsWith("-hero.jpg"));

  if (heroFiles.length === 0) {
    console.log("No hero images found to convert.");
    return;
  }

  console.log(`Found ${heroFiles.length} hero images...\n`);

  const results = await Promise.all(heroFiles.map((f) => convertHeroImage(f)));

  const successful = results.filter((r): r is { slug: string; size: number } => r !== null);
  const totalSize = successful.reduce((acc, r) => acc + r.size, 0);

  console.log(`\n✓ Converted ${successful.length}/${heroFiles.length} images (${(totalSize / 1024).toFixed(1)} KB total)`);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});