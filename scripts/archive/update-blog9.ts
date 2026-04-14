#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog9Content } from "./blog9-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog9Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "ai-crypto-screener-guide" },
    data: {
      content: blog9Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: ai-crypto-screener-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
