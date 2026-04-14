#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog1Content } from "./blog1-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog1Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "ai-portfolio-analyzer-complete-guide" },
    data: {
      content: blog1Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: ai-portfolio-analyzer-complete-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
