/**
 * Stream utilities for Lyra AI service.
 * Provides stream wrapping for error handling and single-chunk streams.
 */

import { addCredits } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { randomUUID } from "crypto";

const logger = createLogger({ service: "lyra-streaming" });

/**
 * Wraps a textStream async iterable so that mid-stream iteration errors
 * trigger a credit refund. Without this, errors that surface during
 * stream consumption (after generateLyraStream has already returned)
 * bypass the outer try/catch refund path — users get charged for broken streams.
 */
export function refundOnStreamError(
  textStream: AsyncIterable<string>,
  userId: string,
  creditCost: number,
  streamLabel: string,
): AsyncGenerator<string> {
  const refundPromise = async () => {
    try {
      await addCredits(userId, creditCost, CreditTransactionType.ADJUSTMENT, "LLM stream failure refund", `lyra-refund:${randomUUID().slice(0, 8)}-${userId.slice(-6)}`);
      logger.warn({ userId, creditCost, streamLabel }, "Credits refunded after mid-stream LLM failure");
    } catch (refundError) {
      logger.error({ err: sanitizeError(refundError), userId, creditCost }, "Credit refund failed on mid-stream LLM failure");
    }
  };

  return (async function* () {
    try {
      for await (const chunk of textStream) {
        yield chunk;
      }
    } catch (streamError: unknown) {
      logger.error({ err: sanitizeError(streamError), userId, streamLabel }, "Mid-stream LLM error — refunding credits");
      void refundPromise();
      throw streamError;
    }
  })();
}

/**
 * Creates a streaming async generator for cache hits and trivial responses.
 * Splits text into smaller chunks to simulate streaming even for cached responses.
 */
export async function* singleChunkStream(text: string): AsyncGenerator<string> {
  const chunkSize = 10; // Send 10 characters at a time for cached responses
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
