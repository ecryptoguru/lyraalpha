#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog22Content } from "./blog22-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog22Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "market-cycle-analysis" },
    data: {
      content: blog22Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: market-cycle-analysis (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
