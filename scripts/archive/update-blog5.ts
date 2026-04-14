#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog5Content } from "./blog5-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog5Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "portfolio-stress-test-guide" },
    data: {
      content: blog5Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: portfolio-stress-test-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
