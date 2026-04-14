#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog24Content } from "./blog24-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog24Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "ai-trading-bots-guide" },
    data: {
      content: blog24Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: ai-trading-bots-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
