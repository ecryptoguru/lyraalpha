#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog30Content } from "./blog30-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog30Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "staking-guide-2026" },
    data: {
      content: blog30Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: staking-guide-2026 (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
