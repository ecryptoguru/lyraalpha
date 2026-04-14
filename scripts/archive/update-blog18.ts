#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog18Content } from "./blog18-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog18Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "market-narrative-tracker" },
    data: {
      content: blog18Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: market-narrative-tracker (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
