#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog7Content } from "./blog7-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog7Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "multibagger-crypto-finder-guide" },
    data: {
      content: blog7Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: multibagger-crypto-finder-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
