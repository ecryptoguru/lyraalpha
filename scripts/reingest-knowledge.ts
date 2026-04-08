#!/usr/bin/env tsx
/**
 * Re-ingest Knowledge Base — Chunk, Embed, Store
 *
 * Replaces old whole-file embeddings with semantic chunks (~300-500 tokens each).
 * Uses text-embedding-3-large with dimensions:1536 for better quality.
 *
 * Usage: npx tsx scripts/reingest-knowledge.ts [--force]
 *
 * --force: Delete all existing chunks and re-embed from scratch
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { chunkMarkdownFile } from "../src/lib/ai/chunker";
import {
  getAzureEmbeddingDeployment,
  getAzureOpenAIApiKey,
  getAzureOpenAIBaseURL,
} from "../src/lib/ai/config";

// ─── Config ───
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const KNOWLEDGE_DIR = path.join(process.cwd(), "src/lib/ai/knowledge");

// ─── Init ───
const openaiClient = new OpenAI({
  apiKey: getAzureOpenAIApiKey(),
  baseURL: getAzureOpenAIBaseURL(),
});

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ No DATABASE_URL or DIRECT_URL found in environment");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const force = args.includes("--force");

// ─── Helpers ───
async function getEmbedding(text: string): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: getAzureEmbeddingDeployment() || EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
    encoding_format: "float",
  });
  return response.data[0].embedding;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

// ─── Main ───
async function main() {
  console.log("\n📚 Knowledge Base Re-Ingestion");
  console.log(`   Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d)`);
  console.log(`   Force: ${force}`);
  console.log(`   Dir: ${KNOWLEDGE_DIR}\n`);

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error("❌ Knowledge directory not found:", KNOWLEDGE_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} knowledge files: ${files.join(", ")}\n`);

  let totalChunks = 0;
  let totalEmbedded = 0;
  let totalTokensEstimate = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
    const fileId = file.replace(".md", "");

    // Check existing chunks
    const existingChunks = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "KnowledgeDoc"
      WHERE id LIKE ${fileId + "-chunk-%"};
    `;
    const existingCount = Number(existingChunks[0]?.count || 0);

    if (existingCount > 0 && !force) {
      console.log(`⏭️  ${file}: ${existingCount} chunks already exist (use --force to re-embed)`);
      totalChunks += existingCount;
      continue;
    }

    // Delete old entries (both whole-file and chunks)
    if (force || existingCount > 0) {
      const deleted1 = await prisma.$executeRaw`DELETE FROM "KnowledgeDoc" WHERE id = ${fileId};`;
      const deleted2 = await prisma.$executeRaw`DELETE FROM "KnowledgeDoc" WHERE id LIKE ${fileId + "-chunk-%"};`;
      console.log(`🗑️  Deleted ${deleted1 + deleted2} old entries for ${file}`);
    }

    // Chunk the file
    const chunks = chunkMarkdownFile(content, file);
    console.log(`\n📄 ${file}: ${chunks.length} chunks created`);
    totalChunks += chunks.length;

    // Embed and store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const charCount = chunk.content.length;
      const tokenEstimate = Math.ceil(charCount / 4);
      totalTokensEstimate += tokenEstimate;

      try {
        const embedding = await getEmbedding(chunk.content);
        const metadataJson = JSON.stringify(chunk.metadata);
        const vectorString = toPgVectorLiteral(embedding);

        await prisma.$executeRawUnsafe(`
          INSERT INTO "KnowledgeDoc" (id, content, metadata, embedding, "createdAt")
          VALUES ($1, $2, $3::jsonb, $4::vector, NOW())
          ON CONFLICT (id) DO UPDATE
          SET content = $2, metadata = $3::jsonb, embedding = $4::vector;
        `, chunk.id, chunk.content, metadataJson, vectorString);

        totalEmbedded++;
        const pct = Math.round(((i + 1) / chunks.length) * 100);
        process.stdout.write(`\r   Embedding: ${i + 1}/${chunks.length} (${pct}%) — ${chunk.metadata.section.slice(0, 40)}...`);

        // Rate limit: ~3000 RPM for embeddings, add small delay
        if ((i + 1) % 50 === 0) await sleep(1000);
      } catch (e) {
        console.error(`\n   ❌ Failed chunk ${chunk.id}:`, (e as Error).message);
      }
    }

    console.log(`\n   ✅ ${file}: ${chunks.length} chunks embedded and stored`);
  }

  // Summary
  console.log("\n" + "─".repeat(60));
  console.log("📊 Re-Ingestion Summary");
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Newly embedded: ${totalEmbedded}`);
  console.log(`   Estimated tokens: ~${totalTokensEstimate.toLocaleString()}`);
  console.log(`   Estimated cost: ~$${((totalTokensEstimate / 1_000_000) * 0.13).toFixed(4)}`);
  console.log("─".repeat(60) + "\n");

  // Verify
  const finalCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "KnowledgeDoc";
  `;
  console.log(`🔍 KnowledgeDoc table: ${Number(finalCount[0]?.count)} total rows\n`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
