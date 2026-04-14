#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog29Content } from "./blog29-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog29Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "lump-sum-vs-dca" },
    data: {
      content: blog29Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: lump-sum-vs-dca (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
