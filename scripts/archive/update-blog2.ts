#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog2Content } from "./blog2-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog2Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "portfolio-risk-calculator-guide" },
    data: {
      content: blog2Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: portfolio-risk-calculator-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
