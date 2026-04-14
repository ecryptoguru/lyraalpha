#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog14Content } from "./blog14-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog14Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "crypto-fundamental-analysis" },
    data: {
      content: blog14Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: crypto-fundamental-analysis (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
