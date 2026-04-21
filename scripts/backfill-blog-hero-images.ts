import { directPrisma } from "../src/lib/prisma";
import { generateBlogHeroImage } from "../src/lib/blog/image-generator";

async function main() {
  // Find all posts without hero images
  const postsWithoutImages = await directPrisma.blogPost.findMany({
    where: { 
      status: "PUBLISHED",
      OR: [
        { heroImageUrl: null },
        { heroImageUrl: "" },
      ]
    },
    select: { 
      id: true,
      slug: true, 
      title: true, 
      category: true,
      keywords: true,
    },
  });
  
  console.log(`Found ${postsWithoutImages.length} posts without hero images`);
  
  for (const post of postsWithoutImages) {
    try {
      console.log(`\nGenerating image for: ${post.slug}`);
      
      const result = await generateBlogHeroImage({
        slug: post.slug,
        title: post.title,
        category: post.category,
        keywords: post.keywords || [],
      });
      
      // Update the post with the new image URL
      await directPrisma.blogPost.update({
        where: { id: post.id },
        data: { heroImageUrl: result.heroImageUrl },
      });
      
      console.log(`✓ Updated: ${result.heroImageUrl}`);
    } catch (err) {
      console.error(`✗ Failed for ${post.slug}:`, err);
    }
  }
  
  console.log("\nDone!");
  await directPrisma.$disconnect();
}

main().catch(console.error);
