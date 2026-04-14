#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog6Content } from "./blog6-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog6Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "best-crypto-to-buy-now-analysis" },
    data: {
      content: blog6Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: best-crypto-to-buy-now-analysis (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
