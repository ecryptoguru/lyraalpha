#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog16Content } from "./blog16-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog16Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "sentiment-analysis-crypto" },
    data: {
      content: blog16Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: sentiment-analysis-crypto (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
