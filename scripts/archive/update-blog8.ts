#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog8Content } from "./blog8-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog8Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "undervalued-crypto-screener" },
    data: {
      content: blog8Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: undervalued-crypto-screener (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
