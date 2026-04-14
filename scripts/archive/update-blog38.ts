#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog38Content } from "./blog38-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog38Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "future-of-crypto" },
    data: {
      content: blog38Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: future-of-crypto (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
