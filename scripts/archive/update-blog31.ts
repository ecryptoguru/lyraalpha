#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog31Content } from "./blog31-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog31Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "yield-farming-guide" },
    data: {
      content: blog31Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: yield-farming-guide (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
