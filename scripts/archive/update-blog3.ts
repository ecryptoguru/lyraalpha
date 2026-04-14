#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog3Content } from "./blog3-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog3Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "portfolio-diversification-analyzer" },
    data: {
      content: blog3Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: portfolio-diversification-analyzer (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
