#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { blog27Content } from "./blog27-content";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function updateBlog() {
  const wordCount = blog27Content.split(/\s+/).length;
  
  await prisma.blogPost.update({
    where: { slug: "crypto-investing-beginners" },
    data: {
      content: blog27Content,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ UPDATED: crypto-investing-beginners (${wordCount} words)`);
  await prisma.$disconnect();
}

updateBlog().catch(console.error);
