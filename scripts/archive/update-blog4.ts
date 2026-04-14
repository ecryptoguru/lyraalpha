#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog4Content } from "./blog4-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog4Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "portfolio-health-score-explained" },
    data: {
      content: blog4Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: portfolio-health-score-explained (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
