import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generateLyraStream } from "@/lib/ai/service";
import { rateLimitChat } from "@/lib/rate-limit";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { ChatMessageSchema } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";
import { createTimer, sanitizeError } from "@/lib/logger/utils";
import { LyraMessage } from "@/types/ai";
import { LyraContext } from "@/lib/engines/types";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "chat-api" });

export const maxDuration = 120;
export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  const timer = createTimer();

  try {
    logger.info({ method: "POST" }, "Chat request started");

    const { userId } = await auth();
    if (!userId) {
      logger.warn("Unauthorized chat request");
      return apiError("Unauthorized", 401);
    }

    // Fetch plan once — passed to both rateLimitChat and generateLyraStream
    // to avoid two independent getUserPlan DB/Redis round-trips per request.
    const userPlan = await getUserPlan(userId);

    const { response: rateLimitError, success } = await rateLimitChat(userId, userPlan);
    if (rateLimitError) {
      logger.warn({ userId }, "Rate limit exceeded");
      return rateLimitError;
    }
    const rateLimitHeaders = success?.headers;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }
    const validation = ChatMessageSchema.safeParse(body);

    if (!validation.success) {
      logger.warn(
        { userId, errors: validation.error.flatten() },
        "Invalid request parameters",
      );
      return apiError("Invalid parameters", 400, validation.error.flatten());
    }

    const {
      messages,
      symbol,
      contextData,
      sourcesLimit,
      skipAssetLinks = false,
      cacheScope,
    } = validation.data;

    const lyraContext: LyraContext = {
      scores: (contextData?.scores as LyraContext["scores"]) ?? {},
      symbol: symbol ?? contextData?.symbol,
      regime: contextData?.regime,
      assetName: contextData?.assetName,
      assetType: contextData?.assetType,
      region: contextData?.region,
      chatMode: contextData?.chatMode as LyraContext["chatMode"],
      compareContext: contextData?.compareContext as LyraContext["compareContext"],
    };

    logger.info(
      { userId, sourcesLimit, symbol, messageCount: messages.length },
      "Generating Lyra stream",
    );

    const { result, sources, remainingCredits, contextTruncated } = await generateLyraStream(
      messages as LyraMessage[],
      lyraContext,
      userId,
      { sourcesLimit, skipAssetLinks, cacheScope, preResolvedPlan: userPlan },
    );
    // Sources delivered via header — avoids touching the stream body which would require
    // an additional pipeThrough transform and worsen backpressure.
    // Cap at 10 to stay well within Nginx's ~8 KB header limit.
    // With full URLs, 20+ sources can exceed the limit and truncate silently.
    const MAX_SOURCES_IN_HEADER = 10;
    const sourcesHeader = sources && sources.length > 0
      ? encodeURIComponent(JSON.stringify(sources.slice(0, MAX_SOURCES_IN_HEADER)))
      : "";

    const sdkResult = result as Record<string, unknown>;

    // ── Cached / synthetic stream ────────────────────────────────────────────
    // Plain AsyncGenerator (trivial/cached responses). No SDK wrapper, no tee.
    if (typeof sdkResult.toTextStreamResponse !== "function") {
      const encoder = new TextEncoder();
      const cachedStream = (sdkResult as { textStream: AsyncIterable<string | null> }).textStream;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const delta of cachedStream) {
              if (delta != null) controller.enqueue(encoder.encode(delta));
            }
          } catch (err) {
            controller.error(err);
          } finally {
            controller.close();
          }
        },
        cancel() {
          // Client disconnected — no-op, let the generator exhaust naturally
          // to ensure onFinish fires for cost tracking / cache writes.
        },
      });
      const response = new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store",
          "X-Accel-Buffering": "no",
          ...(sourcesHeader ? { "X-Lyra-Sources": sourcesHeader } : {}),
          ...(typeof remainingCredits === "number" ? { "X-Credits-Remaining": String(remainingCredits) } : {}),
          ...(contextTruncated ? { "X-Context-Truncated": "true" } : {}),
        },
      });
      if (rateLimitHeaders) {
        for (const [k, v] of Object.entries(rateLimitHeaders)) response.headers.set(k, v);
      }
      return response;
    }

    // ── Live AI SDK stream ───────────────────────────────────────────────────
    // toTextStreamResponse() internally calls the `textStream` getter which calls
    // teeStream() → [stream1, stream2]. stream1 feeds sdkResponse.body.
    // stream2 becomes the new `this.baseStream` but is NEVER consumed.
    //
    // Web Streams tee spec: both branches share a single source. If stream2's
    // internal buffer fills (default HWM ~1 chunk) the source stops producing,
    // so stream1 stalls — typically after 50-100 tokens of buffering.
    //
    // Fix: drain stream2 (now at sdkResult.baseStream) in a fire-and-forget
    // background task immediately after calling toTextStreamResponse(). This
    // keeps the tee flowing at the model's full token rate.
    const sdkResponse = (sdkResult.toTextStreamResponse as () => Response)();

    // After the call above, sdkResult.baseStream === stream2 (the unconsumed tee branch).
    const remainingBase = (sdkResult as { baseStream?: ReadableStream }).baseStream;
    if (remainingBase) {
      // Fire-and-forget: drain stream2 so the tee never backpressures stream1.
      // This also ensures onFinish fires correctly (eventProcessor runs as data flows).
      remainingBase.pipeTo(new WritableStream({ write() {} })).catch((err) => {
        logger.warn({ err: sanitizeError(err) }, "Stream tee drain failed — stream1 may stall");
      });
    }

    const response = new Response(sdkResponse.body, {
      status: sdkResponse.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no",
        ...(sourcesHeader ? { "X-Lyra-Sources": sourcesHeader } : {}),
        ...(typeof remainingCredits === "number" ? { "X-Credits-Remaining": String(remainingCredits) } : {}),
        ...(contextTruncated ? { "X-Context-Truncated": "true" } : {}),
      },
    });
    if (rateLimitHeaders) {
      for (const [k, v] of Object.entries(rateLimitHeaders)) response.headers.set(k, v);
    }
    return response;

  } catch (error: unknown) {
    logger.error({ err: sanitizeError(error) }, "Chat request failed");
    return apiError("Failed to process chat request", 500);
  } finally {
    logger.info({ duration: timer.endFormatted() }, "Chat request completed");
  }
}
