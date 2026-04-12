import { streamText } from "ai";
import { getSharedAISdkClient, getGpt54Deployment } from "./config";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { createHash } from "crypto";

const logger = createLogger({ service: "context-compress" });

const COMPRESS_SYSTEM_PROMPT =
  "You are a ruthless text compressor. Summarize this financial context into an ultra-dense, bulleted list of raw facts. Remove all filler, marketing text, disclaimers, and conversational fluff. Retain all numbers, tickers, entities, and definitive claims. KEEP IT AS SHORT AS POSSIBLE WITHOUT LOSING DATA.";

/**
 * Cheap, fast pre-flight context compression using GPT-5.4 Nano ($0.20/$1.25 per 1M tokens).
 * maxTokens=700 (~525 words): if you need 2000 output tokens you're not compressing.
 * verbosity:low ensures dense bullet output, not medium-verbose prose.
 * Results are cached in Redis (2h TTL) to avoid redundant compression of identical contexts.
 */
const COMPRESS_CACHE_TTL = 2 * 60 * 60; // 2 hours — aligned with MODERATE model cache TTL
const COMPRESS_TIMEOUT_MS = 8_000; // 8s — prevents indefinite hangs if nano model is unresponsive

export async function compressKnowledgeContext(rawContext: string, maxTokens: number = 700): Promise<string> {
  if (!rawContext || rawContext.length < 1000) return rawContext;

  const contextHash = createHash("sha256").update(rawContext).digest("hex").slice(0, 32);
  const cacheKey = `compress:${rawContext.length}:${contextHash}`;
  const cached = await getCache<string>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey, len: cached.length }, "Compression cache HIT");
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMPRESS_TIMEOUT_MS);

  try {
    const client = getSharedAISdkClient();
    const nanoDeployment = getGpt54Deployment("lyra-nano");

    const stream = streamText({
      model: client.responses(nanoDeployment),
      system: COMPRESS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawContext }],
      maxOutputTokens: maxTokens,
      abortSignal: controller.signal,
      providerOptions: {
        openai: { textVerbosity: "low" as const }, // text.verbosity:'low' → dense bullets, not prose
      },
    });
    const chunks: string[] = [];
    for await (const chunk of stream.textStream) {
      chunks.push(chunk);
    }
    const compressed = chunks.join("");
    if (compressed && compressed.length < rawContext.length) {
      // Calculate token savings using consistent char-to-token ratio (0.72 words/token, ~4 chars/word)
      const rawTokens = Math.ceil(rawContext.length / 4);
      const compressedTokens = Math.ceil(compressed.length / 4);
      const tokensSaved = rawTokens - compressedTokens;
      
      logger.info(
        { 
          originalLen: rawContext.length, 
          compressedLen: compressed.length,
          rawTokens,
          compressedTokens,
          tokensSaved,
          savingsPercent: Math.round((1 - compressed.length / rawContext.length) * 100)
        },
        "Context compressed via GPT-5.4 Nano",
      );
      setCache(cacheKey, compressed, COMPRESS_CACHE_TTL).catch(() => {});
      return compressed;
    }
    // Compression produced no improvement — return raw without caching.
    // Caching the full raw blob here would cause callers to silently receive an
    // uncompressed context on subsequent cache hits while believing it was compressed.
    logger.debug({ originalLen: rawContext.length }, "Compression no-op — returning raw context uncached");
    return rawContext;
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "AbortError";
    if (isTimeout) {
      logger.warn({ rawLen: rawContext.length, timeoutMs: COMPRESS_TIMEOUT_MS }, "Context compression timed out — falling back to raw context");
    } else {
      logger.error({ err: sanitizeError(e) }, "Context compression failed, falling back to raw context");
    }
    return rawContext;
  } finally {
    clearTimeout(timeoutId);
  }
}
