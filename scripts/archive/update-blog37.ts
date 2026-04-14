#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog37Content } from "./blog37-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog37Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "crypto-scams-to-avoid" },
    data: {
      content: blog37Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: crypto-scams-to-avoid (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
