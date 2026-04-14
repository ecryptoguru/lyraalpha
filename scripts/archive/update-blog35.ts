#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog35Content } from "./blog35-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog35Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "solana-analysis-2026" },
    data: {
      content: blog35Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: solana-analysis-2026 (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
