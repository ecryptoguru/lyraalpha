/**
 * Seeds support-kb.md into the pgvector KnowledgeDoc table.
 * Run: npx tsx scripts/seed-support-kb.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import OpenAI from "openai";
import {
  getAzureEmbeddingDeployment,
  getAzureOpenAIApiKey,
  getAzureOpenAIBaseURL,
} from "../src/lib/ai/config";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const openai = new OpenAI({
  apiKey: getAzureOpenAIApiKey(),
  baseURL: getAzureOpenAIBaseURL(),
});

const EMBEDDING_MODEL = getAzureEmbeddingDeployment() || "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const CHUNK_SIZE = 800;

function chunkText(text: string, fileName: string): Array<{ id: string; content: string }> {
  const lines = text.split("\n");
  const chunks: Array<{ id: string; content: string }> = [];
  let current: string[] = [];
  let charCount = 0;
  let chunkIndex = 0;

  for (const line of lines) {
    current.push(line);
    charCount += line.length + 1;

    if (charCount >= CHUNK_SIZE) {
      const content = current.join("\n").trim();
      if (content.length > 50) {
        chunks.push({ id: `${fileName.replace(".md", "")}-chunk-${chunkIndex}`, content });
        chunkIndex++;
        // Keep last CHUNK_OVERLAP chars as overlap
        const overlap = current.slice(-Math.floor(current.length * 0.15));
        current = overlap;
        charCount = overlap.join("\n").length;
      } else {
        current = [];
        charCount = 0;
      }
    }
  }

  // Final chunk
  const remaining = current.join("\n").trim();
  if (remaining.length > 50) {
    chunks.push({ id: `${fileName.replace(".md", "")}-chunk-${chunkIndex}`, content: remaining });
  }

  return chunks;
}

async function seed() {
  const filePath = path.join(process.cwd(), "src/lib/ai/knowledge/support-kb.md");
  const content = fs.readFileSync(filePath, "utf-8");
  const chunks = chunkText(content, "support-kb.md");

  console.log(`Seeding ${chunks.length} chunks from support-kb.md...`);

  // Delete existing support-kb chunks from isolated table
  await prisma.$executeRaw`DELETE FROM "SupportKnowledgeDoc";`;
  console.log("Cleared existing SupportKnowledgeDoc chunks.");

  let success = 0;
  for (const chunk of chunks) {
    try {
      const embRes = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk.content,
        dimensions: EMBEDDING_DIMS,
        encoding_format: "float",
      });
      const vector = embRes.data[0].embedding;
      const vectorStr = `[${vector.join(",")}]`;
      const metadata = JSON.stringify({ source: "support-kb", assetTypes: ["GLOBAL"] });

      await prisma.$executeRaw`
        INSERT INTO "SupportKnowledgeDoc" (id, content, metadata, embedding, "createdAt", "updatedAt")
        VALUES (${chunk.id}, ${chunk.content}, ${metadata}::jsonb, ${vectorStr}::vector, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET content = ${chunk.content}, metadata = ${metadata}::jsonb, embedding = ${vectorStr}::vector, "updatedAt" = NOW();
      `;
      success++;
      process.stdout.write(`\r  ${success}/${chunks.length} chunks embedded`);
    } catch (err) {
      console.error(`\nFailed chunk ${chunk.id}:`, err);
    }
  }

  console.log(`\nDone. ${success}/${chunks.length} chunks seeded.`);
  await prisma.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
