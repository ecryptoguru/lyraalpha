#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog10Content } from "./blog10-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog10Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "high-growth-crypto-guide" },
    data: {
      content: blog10Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: high-growth-crypto-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
