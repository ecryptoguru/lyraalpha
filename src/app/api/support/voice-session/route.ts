import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { rateLimitChat } from "@/lib/rate-limit";
import { getGlobalNotes } from "@/lib/ai/memory";
import { buildMyraVoiceInstructions } from "@/lib/support/voice-prompt";
import { bm25SearchKnowledge } from "@/lib/support/ai-responder";
import { checkPromptInjection, INJECTION_PATTERNS } from "@/lib/ai/guardrails";
import { scrubPIIString } from "@/lib/ai/pii-scrub";
import { apiError } from "@/lib/api-response";
import { createLogger } from "@/lib/logger";
import { redis, redisSetNXStrict } from "@/lib/redis";

const logger = createLogger({ service: "voice-session" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── OpenAI Direct (not Azure) ────────────────────────────────────────────────
// The Realtime API (gpt-realtime-mini) is currently only available on the
// OpenAI native platform (api.openai.com), not on Azure OpenAI. All other
// Lyra/Myra text generation uses Azure OpenAI for data-residency and cost
// parity. This route issues an ephemeral token that the browser uses to
// connect directly to wss://api.openai.com/v1/realtime — the backend does
// NOT proxy the WebSocket. Keep the native key in OPENAI_API_KEY; do NOT
// reuse AZURE_OPENAI_API_KEY here.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const VOICE_MODEL = "gpt-realtime-mini";
const VOICE_OUTPUT_VOICE = "marin";
const VOICE_SESSION_FETCH_TIMEOUT_MS = 8_000;
// 60s TTL matches the ephemeral token lifetime (~60s). The lock only needs
// to cover the client_secrets fetch window — once the token is issued the
// browser connects directly to OpenAI. Releasing immediately on success
// prevents users from being blocked for 5 min after a failed or aborted
// session start.
const VOICE_SESSION_CONCURRENCY_TTL = 60;

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return apiError("Unauthorized", 401);

  if (!OPENAI_API_KEY) return apiError("OpenAI key not configured", 500);

  // Auth checks first — fast-fail before any DB work
  const userPlan = await getUserPlan(userId);
  if (userPlan !== "PRO" && userPlan !== "ELITE" && userPlan !== "ENTERPRISE") {
    return apiError("Voice requires a PRO or higher plan", 403);
  }

  const rateLimitResult = await rateLimitChat(userId, userPlan);
  if (rateLimitResult.response) return rateLimitResult.response;

  // Per-user concurrency cap: only one active voice session at a time.
  // Uses fail-closed lock (redisSetNXStrict) — if Redis is down, deny to prevent
  // unbounded concurrent sessions (each costs ~$0.15/min in audio tokens).
  const concurrencyKey = `voice:session:${userId}`;
  const lockAcquired = await redisSetNXStrict(concurrencyKey, VOICE_SESSION_CONCURRENCY_TTL);
  if (!lockAcquired) {
    logger.warn({ userId }, "Voice session: concurrent session blocked");
    return apiError("A voice session is already active. Please wait for it to end.", 429);
  }

  // ── Parallel phase ─────────────────────────────────────────────────────────
  // Fire the OpenAI client_secrets call at the same time as the DB/KB queries.
  // client_secrets takes 300-800ms; DB+KB takes 200-600ms — they overlap perfectly.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VOICE_SESSION_FETCH_TIMEOUT_MS);

  let ephemeralToken = "";

  try {
    const [ephemeralResult, userRecord, kbDocs, globalNotes] = await Promise.all([
      fetch("https://api.openai.com/v1/realtime/client_secrets", {
        signal: controller.signal,
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: VOICE_MODEL,
            output_modalities: ["audio"],
            max_output_tokens: 350,
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                  prompt:
                    "Transcribe ONLY in English, Hinglish, or Hindi. NEVER output Urdu script or Urdu vocabulary — if the speech sounds like Urdu, transcribe it as Hindi instead. Preserve code-switching across English, Hinglish, and Hindi. Keep product names in English. If the speech mixes languages, keep the transcript in English, Hinglish, or Hindi only.",
                },
                turn_detection: {
                  type: "semantic_vad",
                  create_response: true,
                  interrupt_response: true,
                  eagerness: "medium",
                },
              },
              output: {
                format: { type: "audio/pcm", rate: 24000 },
                voice: VOICE_OUTPUT_VOICE,
              },
            },
          },
        }),
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }).catch(() => null),
      bm25SearchKnowledge(
        "platform features credits plans lyra intel dse score portfolio watchlist compare assets shock simulator",
      )
        .then((docs) => docs.slice(0, 3).map((d) => d.content))
        .catch(() => [] as string[]),
      getGlobalNotes(userId, "myra").catch(() => ""),
    ]);

    if (!ephemeralResult.ok) {
      const failureText = await ephemeralResult.text().catch(() => "");
      logger.error(
        {
          userId,
          plan: userPlan,
          status: ephemeralResult.status,
          statusText: ephemeralResult.statusText,
          contentType: ephemeralResult.headers.get("content-type"),
          failurePreview: failureText.slice(0, 500),
        },
        "Voice session: client_secrets returned a non-OK response",
      );
      redis.del(concurrencyKey).catch(() => { /* TTL will expire naturally */ });
      return apiError(
        "We couldn't start your voice session. This is usually a temporary issue — please try again in a few seconds.",
        502,
      );
    }

    const data = (await ephemeralResult.json()) as {
      value?: string;
      client_secret?: { value?: string };
    };
    ephemeralToken =
      (typeof data.value === "string" && data.value.trim()) ||
      (typeof data.client_secret?.value === "string" && data.client_secret.value.trim()) ||
      "";

    if (!ephemeralToken) {
      logger.error(
        {
          userId,
          plan: userPlan,
          contentType: ephemeralResult.headers.get("content-type"),
          dataKeys: Object.keys(data),
        },
        "Voice session: client_secrets returned no ephemeral token",
      );
      redis.del(concurrencyKey).catch(() => { /* TTL will expire naturally */ });
      return apiError(
        "We couldn't start your voice session. This is usually a temporary issue — please try again in a few seconds.",
        502,
      );
    }

    // Build instructions after both DB and token are ready — no extra latency
    // Extract current page from query param for contextual responses
    const pageParam = new URL(request.url).searchParams.get("page") || undefined;

    // V-INJ: Validate page param against prompt injection before injecting into voice instructions.
    // The page param is user-controlled (query string) and gets embedded in the system prompt.
    // Also scrub PII — the referrer path may contain query params with emails, tokens, etc.
    let safePageParam: string | undefined;
    if (pageParam) {
      const scrubbedPage = scrubPIIString(pageParam);
      const injectionCheck = checkPromptInjection(scrubbedPage.normalize("NFKC"));
      if (!injectionCheck.isValid) {
        logger.warn({ userId, pageParam: scrubbedPage, reason: injectionCheck.reason }, "Voice session: injection pattern in page param — stripping");
      } else {
        safePageParam = scrubbedPage;
      }
    }

    // AUDIT-5: Re-scan stored globalNotes at READ time against current INJECTION_PATTERNS.
    // Notes are already filtered on write in `distillSessionNotes`, but a new pattern added
    // to the guardrail set after storage would not retroactively filter older rows. Drop
    // any line that matches before embedding into the voice system prompt.
    // Also re-scrub for PII — notes may contain historic user messages that slipped
    // through prior guardrails.
    let safeGlobalNotes: string | undefined;
    if (globalNotes) {
      const scrubbedNotes = scrubPIIString(globalNotes);
      const lines = scrubbedNotes.split("\n").filter((line) => {
        const normalized = line.normalize("NFKC");
        return !INJECTION_PATTERNS.some((p) => p.test(normalized));
      });
      const dropped = scrubbedNotes.split("\n").length - lines.length;
      if (dropped > 0) {
        logger.warn({ userId, dropped }, "Voice session: filtered injection-matching memory lines at render");
      }
      safeGlobalNotes = lines.join("\n") || undefined;
    }

    const instructions = buildMyraVoiceInstructions(
      {
        plan: userPlan,
        credits: userRecord?.credits ?? undefined,
        currentPage: safePageParam,
        globalNotes: safeGlobalNotes,
      },
      kbDocs,
    );

    logger.info({ userId, plan: userPlan }, "Voice session: ephemeral token issued");

    // Release the concurrency lock immediately — the ephemeral token is now
    // the user's session credential. The 60s TTL is only a safety net if
    // redis.del fails. This prevents users from being blocked after a normal
    // session start when they refresh or reconnect.
    redis.del(concurrencyKey).catch((delErr) =>
      logger.warn({ userId, err: delErr }, "Voice session: failed to release concurrency lock (TTL will expire naturally)"),
    );

    return Response.json({
      mode: "ephemeral",
      ephemeralKey: ephemeralToken,
      wssUrl: OPENAI_REALTIME_URL,
      model: VOICE_MODEL,
      voice: VOICE_OUTPUT_VOICE,
      instructions,
    });
  } catch (e) {
    logger.warn({ userId, err: e }, "Voice session: token generation failed");
    // Release lock on failure so the user can retry immediately
    redis.del(concurrencyKey).catch(() => { /* TTL will expire naturally */ });
    return apiError(
      "We couldn't start your voice session. This is usually a temporary issue — please try again in a few seconds.",
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Explicitly release the voice-session concurrency lock so the user can
 *  start a new session immediately. Called by the frontend when the user
 *  closes the voice widget or the session ends naturally.
 */
export async function DELETE(_request: Request) {
  const { userId } = await auth();
  if (!userId) return apiError("Unauthorized", 401);

  const concurrencyKey = `voice:session:${userId}`;
  try {
    await redis.del(concurrencyKey);
    logger.info({ userId }, "Voice session: concurrency lock released on DELETE");
    return Response.json({ released: true });
  } catch (e) {
    logger.warn({ userId, err: e }, "Voice session: failed to release lock on DELETE");
    return Response.json({ released: false });
  }
}
