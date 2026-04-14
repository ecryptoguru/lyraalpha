#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog34Content } from "./blog34-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog34Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "ethereum-analysis-2026" },
    data: {
      content: blog34Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: ethereum-analysis-2026 (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
