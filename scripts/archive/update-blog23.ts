#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog23Content } from "./blog23-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog23Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "defai-explained" },
    data: {
      content: blog23Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: defai-explained (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
