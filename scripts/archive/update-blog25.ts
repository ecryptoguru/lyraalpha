#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog25Content } from "./blog25-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog25Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "autonomous-agents-crypto" },
    data: {
      content: blog25Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: autonomous-agents-crypto (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
