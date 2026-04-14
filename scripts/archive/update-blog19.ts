#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog19Content } from "./blog19-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog19Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "macro-impact-analyzer" },
    data: {
      content: blog19Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: macro-impact-analyzer (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
