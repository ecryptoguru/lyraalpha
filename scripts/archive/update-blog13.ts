#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog13Content } from "./blog13-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog13Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "technical-analysis-crypto-guide" },
    data: {
      content: blog13Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: technical-analysis-crypto-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
