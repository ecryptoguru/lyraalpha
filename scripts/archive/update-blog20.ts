#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog20Content } from "./blog20-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog20Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "crypto-bull-market-guide" },
    data: {
      content: blog20Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: crypto-bull-market-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
