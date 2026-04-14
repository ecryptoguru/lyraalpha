#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog21Content } from "./blog21-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog21Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "crypto-bear-market-survival" },
    data: {
      content: blog21Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: crypto-bear-market-survival (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
