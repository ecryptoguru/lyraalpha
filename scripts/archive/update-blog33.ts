#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog33Content } from "./blog33-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog33Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "bitcoin-analysis-2026" },
    data: {
      content: blog33Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: bitcoin-analysis-2026 (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
