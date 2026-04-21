import { directPrisma } from "../src/lib/prisma";

async function main() {
  // Find blog posts missing hero images
  const postsWithoutImages = await directPrisma.blogPost.findMany({
    where: { 
      status: "PUBLISHED",
      OR: [
        { heroImageUrl: null },
        { heroImageUrl: "" },
      ]
    },
    select: { slug: true, title: true, heroImageUrl: true },
  });
  
  console.log("Posts without hero images:", postsWithoutImages.length);
  for (const post of postsWithoutImages) {
    console.log(`- ${post.slug}: ${post.title}`);
  }
  
  // Also check all posts
  const allPosts = await directPrisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, title: true, heroImageUrl: true },
  });
  
  console.log("\n=== All Published Posts ===");
  for (const post of allPosts) {
    console.log(`${post.heroImageUrl ? "✓" : "✗"} ${post.slug}: ${post.title}`);
  }
  
  await directPrisma.$disconnect();
}

main().catch(console.error);
