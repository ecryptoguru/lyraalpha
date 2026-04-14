#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog11Content } from "./blog11-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog11Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "ai-crypto-analysis-tool-guide" },
    data: {
      content: blog11Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: ai-crypto-analysis-tool-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
