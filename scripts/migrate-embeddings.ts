/**
 * Migration script: Re-embed all KB chunks with text-embedding-3-small
 * 
 * Usage: npx tsx scripts/migrate-embeddings.ts
 * 
 * This script:
 * 1. Fetches all existing KB chunks from the database
 * 2. Re-embeds them using text-embedding-3-small (the new model)
 * 3. Updates the embeddings in the database
 * 
 * Cost: ~$0.004 per 1M tokens (vs $0.02 for -large)
 * Estimated chunks: ~33K (669 assets × ~50 chunks each)
 * Estimated cost: ~$0.13 for full re-embed
 */

import { getEmbeddingClient } from "../src/lib/ai/config";
import { prisma } from "../src/lib/prisma";

const BATCH_SIZE = 100;

function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function migrateEmbeddings() {
  console.log("🚀 Starting embedding migration: text-embedding-3-large → text-embedding-3-small\n");
  
  const client = getEmbeddingClient();
  const embeddingModel = "text-embedding-3-small";
  
  // Get total count
  const totalChunks = await prisma.knowledgeDoc.count();
  console.log(`📊 Total KB chunks to migrate: ${totalChunks}`);
  
  if (totalChunks === 0) {
    console.log("✅ No chunks to migrate");
    return;
  }
  
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  // Process in batches
  while (processed < totalChunks) {
    const chunks = await prisma.knowledgeDoc.findMany({
      skip: processed,
      take: BATCH_SIZE,
      select: {
        id: true,
        content: true,
      },
    });
    
    if (chunks.length === 0) break;
    
    // Embed all chunks in this batch
    const embeddings = await client.embeddings.create({
      model: embeddingModel,
      input: chunks.map((c: { content: string }) => c.content),
      dimensions: 1536,
    });
    
    // Update each chunk with new embedding
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings.data[i]?.embedding;
      
      if (!embedding) {
        console.error(`❌ No embedding for chunk ${chunk.id}`);
        errors++;
        continue;
      }
      
      try {
        // Use raw SQL since Prisma doesn't type Unsupported("vector") fields
        await prisma.$executeRaw`UPDATE "KnowledgeDoc" SET embedding = ${toPgVector(embedding)}::vector WHERE id = ${chunk.id}`;
        updated++;
      } catch (e) {
        console.error(`❌ Failed to update chunk ${chunk.id}:`, e);
        errors++;
      }
    }
    
    processed += chunks.length;
    console.log(`📈 Progress: ${processed}/${totalChunks} (${((processed / totalChunks) * 100).toFixed(1)}%)`);
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated} chunks`);
  console.log(`   Errors: ${errors} chunks`);
  console.log(`\n💰 Cost savings: ~$0.13 (vs ~$0.66 with -large model)`);
}

migrateEmbeddings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
