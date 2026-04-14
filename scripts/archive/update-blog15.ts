#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog15Content } from "./blog15-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog15Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "whale-wallet-tracking" },
    data: {
      content: blog15Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: whale-wallet-tracking (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
