import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { rateLimitChat } from "@/lib/rate-limit";
import { getGlobalNotes } from "@/lib/ai/memory";
import { buildMyraVoiceInstructions } from "@/lib/support/voice-prompt";
import { bm25SearchKnowledge } from "@/lib/support/ai-responder";
import { apiError } from "@/lib/api-response";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "voice-session" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const VOICE_MODEL = "gpt-realtime-mini";
const VOICE_OUTPUT_VOICE = "marin";
const VOICE_SESSION_FETCH_TIMEOUT_MS = 8_000;

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

export async function GET() {
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
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                  prompt:
                    "Transcribe only English, Hinglish, and Hindi. Preserve code-switching across those three languages, keep product names in English, and never output Urdu or any other language. If the speech mixes languages, keep the transcript in English, Hinglish, or Hindi only.",
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
      prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
      bm25SearchKnowledge(
        "platform features credits plans lyra intel dse score portfolio watchlist compare assets shock simulator",
      ).then((docs) => docs.slice(0, 3).map((d) => d.content)),
      getGlobalNotes(userId, "myra"),
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
      return apiError("Voice session token generation failed", 502);
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
      return apiError("Voice session token generation failed", 502);
    }

    // Build instructions after both DB and token are ready — no extra latency
    const instructions = buildMyraVoiceInstructions(
      {
        plan: userPlan,
        credits: userRecord?.credits ?? undefined,
        globalNotes: globalNotes || undefined,
      },
      kbDocs,
    );

    logger.info({ userId, plan: userPlan }, "Voice session: ephemeral token issued");

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
    return apiError("Voice session token generation failed", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
