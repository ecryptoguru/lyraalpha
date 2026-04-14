#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog28Content } from "./blog28-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog28Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "dollar-cost-averaging-crypto" },
    data: {
      content: blog28Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: dollar-cost-averaging-crypto (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
