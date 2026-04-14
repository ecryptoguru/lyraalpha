#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog17Content } from "./blog17-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog17Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "ai-market-intelligence-dashboard" },
    data: {
      content: blog17Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: ai-market-intelligence-dashboard (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
