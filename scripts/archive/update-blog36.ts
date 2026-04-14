#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog36Content } from "./blog36-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog36Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "defi-blue-chips" },
    data: {
      content: blog36Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: defi-blue-chips (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
