import "dotenv/config";
import { redis } from "@/lib/redis";

async function findKeysByPattern(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, { match: pattern, count: 250 });
    const next = typeof nextCursor === "number" ? nextCursor : Number(nextCursor);
    cursor = Number.isFinite(next) ? next : 0;
    if (batch.length > 0) keys.push(...(batch as string[]));
  } while (cursor !== 0);
  return keys;
}

async function main() {
  const geminiKeys = await findKeysByPattern("lyra:model:gemini:*");
  const eduKeys = await findKeysByPattern("edu:*");
  const keys = [...geminiKeys, ...eduKeys];

  console.log(`Found ${geminiKeys.length} Gemini cache keys, ${eduKeys.length} educational cache keys`);

  if (keys.length === 0) {
    console.log("Nothing to delete. Done");
    return;
  }

  const pipeline = redis.pipeline();
  for (const key of keys) pipeline.del(key);
  await pipeline.exec();
  console.log(`Deleted ${keys.length} keys`);
  console.log("Done");
}

main().catch(console.error);
