#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog26Content } from "./blog26-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog26Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "intent-based-trading" },
    data: {
      content: blog26Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: intent-based-trading (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
