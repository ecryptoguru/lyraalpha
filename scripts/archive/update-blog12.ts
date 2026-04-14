#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog12Content } from "./blog12-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog12Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "on-chain-analysis-dashboard" },
    data: {
      content: blog12Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: on-chain-analysis-dashboard (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
