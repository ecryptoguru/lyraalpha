/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockGetUserPlan = vi.fn();
const mockRateLimitChat = vi.fn();
const mockFindUnique = vi.fn();
const mockGetGlobalNotes = vi.fn();
const mockBuildMyraVoiceInstructions = vi.fn();
const mockBm25SearchKnowledge = vi.fn();
const mockRedisDel = vi.fn().mockResolvedValue(1);
const mockApiError = vi.fn((message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  }),
);
const mockCreateLogger = vi.fn(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/middleware/plan-gate", () => ({ getUserPlan: mockGetUserPlan }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitChat: mockRateLimitChat }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
  },
}));
vi.mock("@/lib/ai/memory", () => ({ getGlobalNotes: mockGetGlobalNotes }));
vi.mock("@/lib/support/voice-prompt", () => ({
  buildMyraVoiceInstructions: mockBuildMyraVoiceInstructions,
}));
vi.mock("@/lib/support/ai-responder", () => ({ bm25SearchKnowledge: mockBm25SearchKnowledge }));
vi.mock("@/lib/api-response", () => ({ apiError: mockApiError }));
vi.mock("@/lib/logger", () => ({ createLogger: mockCreateLogger }));
vi.mock("@/lib/redis", () => ({
  redis: { del: mockRedisDel },
  redisSetNXStrict: vi.fn().mockResolvedValue(true),
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

const fetchMock = vi.fn();

// Always reset modules between tests so module-level consts are re-evaluated
// are re-evaluated with the current process.env for each test.
async function loadRoute() {
  vi.resetModules();
  // Re-register mocks after resetModules so the freshly-imported module gets them
  vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
  vi.mock("@/lib/middleware/plan-gate", () => ({ getUserPlan: mockGetUserPlan }));
  vi.mock("@/lib/rate-limit", () => ({ rateLimitChat: mockRateLimitChat }));
  vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mockFindUnique } } }));
  vi.mock("@/lib/ai/memory", () => ({ getGlobalNotes: mockGetGlobalNotes }));
  vi.mock("@/lib/support/voice-prompt", () => ({ buildMyraVoiceInstructions: mockBuildMyraVoiceInstructions }));
  vi.mock("@/lib/support/ai-responder", () => ({ bm25SearchKnowledge: mockBm25SearchKnowledge }));
  vi.mock("@/lib/api-response", () => ({ apiError: mockApiError }));
  vi.mock("@/lib/logger", () => ({ createLogger: mockCreateLogger }));
  vi.mock("@/lib/redis", () => ({
    redis: { del: mockRedisDel },
    redisSetNXStrict: vi.fn().mockResolvedValue(true),
    getCache: vi.fn(),
    setCache: vi.fn(),
  }));
  return import("./route");
}

function stubFetch(response?: Response) {
  vi.stubGlobal(
    "fetch",
    fetchMock.mockResolvedValue(
      response ??
        new Response(JSON.stringify({ client_secret: { value: "ek_test_token" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-openai-key";

  mockAuth.mockResolvedValue({ userId: "user_123" });
  mockGetUserPlan.mockResolvedValue("PRO");
  mockRateLimitChat.mockResolvedValue({ response: null });
  mockFindUnique.mockResolvedValue({ credits: 42 });
  mockGetGlobalNotes.mockResolvedValue("global notes");
  mockBuildMyraVoiceInstructions.mockReturnValue("SYS-PROMPT");
  mockBm25SearchKnowledge.mockResolvedValue([{ content: "kb-a" }, { content: "kb-b" }]);

  stubFetch();
});

function mockRequest(url = "http://localhost/api/support/voice-session") {
  return new Request(url);
}

describe("GET /api/support/voice-session", () => {
  // ─── Auth / guard checks ───────────────────────────────────────────────────

  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("403 when plan is STARTER", async () => {
    mockGetUserPlan.mockResolvedValueOnce("STARTER");
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Voice requires a PRO or higher plan" });
  });

  it("403 when plan is unknown", async () => {
    mockGetUserPlan.mockResolvedValueOnce("FREE");
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(403);
  });

  it("forwards rate-limit response when rate limited", async () => {
    const limitResponse = new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
    mockRateLimitChat.mockResolvedValueOnce({ response: limitResponse });
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(429);
  });

  it("500 when OPENAI_API_KEY is missing", async () => {
    process.env.OPENAI_API_KEY = "";
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "OpenAI key not configured" });
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  it("returns a clean session payload without leaking instructions (value shape)", async () => {
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    const body = (await res.json()) as {
      mode: string;
      ephemeralKey: string;
      wssUrl: string;
      model: string;
      voice: string;
      instructions?: string;
    };

    expect(body).toEqual({
      mode: "ephemeral",
      ephemeralKey: "ek_test_token",
      wssUrl: "wss://api.openai.com/v1/realtime",
      model: "gpt-realtime-mini",
      voice: "marin",
      instructions: "SYS-PROMPT",
    });
  });

  it("builds instructions from user context and includes them in the response", async () => {
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());

    expect(mockBuildMyraVoiceInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "PRO", credits: 42, globalNotes: "global notes" }),
      ["kb-a", "kb-b"],
    );

    const body = (await res.json()) as { instructions: string };
    expect(body.instructions).toBe("SYS-PROMPT");
  });

  it("sends correct body to client_secrets: session wrapper with type+model+voice, no instructions", async () => {
    const { GET } = await loadRoute();
    await GET(mockRequest());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string) as {
      session: {
        type: string;
        model?: string;
        output_modalities?: string[];
        max_output_tokens?: number;
        audio?: { input?: { format?: { type?: string; rate?: number }; transcription?: { model?: string; prompt?: string }; turn_detection?: { type?: string } }; output?: { format?: { type?: string; rate?: number }; voice?: string } };
        instructions?: string;
      };
    };
    expect(payload.session.type).toBe("realtime");
    expect(payload.session.model).toBe("gpt-realtime-mini");
    expect(payload.session.max_output_tokens).toBe(350);
    expect(payload.session.audio?.input?.format).toEqual({ type: "audio/pcm", rate: 24000 });
    expect(payload.session.audio?.input?.transcription?.prompt).toContain("Transcribe ONLY in English, Hinglish, or Hindi");
    expect(payload.session.audio?.input?.transcription?.prompt).toContain("NEVER output Urdu script or Urdu vocabulary");
    expect(payload.session.audio?.output?.voice).toBe("marin");
    expect(payload.session.audio?.output?.format).toEqual({ type: "audio/pcm", rate: 24000 });
    expect(payload.session.output_modalities).toEqual(["audio"]);
    expect(payload.session.instructions).toBeUndefined();
  });

  it("accepts client_secret.value token shape", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ client_secret: { value: "cs_token_abc" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    const body = (await res.json()) as { ephemeralKey: string };
    expect(res.status).toBe(200);
    expect(body.ephemeralKey).toBe("cs_token_abc");
  });

  it("works when user has no credits (credits is null)", async () => {
    mockFindUnique.mockResolvedValueOnce({ credits: null });
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
    expect(mockBuildMyraVoiceInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ credits: undefined }),
      expect.any(Array),
    );
  });

  it("works when globalNotes is empty string — omitted from context", async () => {
    mockGetGlobalNotes.mockResolvedValueOnce("");
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
    expect(mockBuildMyraVoiceInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ globalNotes: undefined }),
      expect.any(Array),
    );
  });

  it("caps KB docs to 3 even when bm25 returns more", async () => {
    mockBm25SearchKnowledge.mockResolvedValueOnce([
      { content: "doc-1" },
      { content: "doc-2" },
      { content: "doc-3" },
      { content: "doc-4" },
      { content: "doc-5" },
    ]);
    const { GET } = await loadRoute();
    await GET(mockRequest());
    expect(mockBuildMyraVoiceInstructions).toHaveBeenCalledWith(
      expect.any(Object),
      ["doc-1", "doc-2", "doc-3"],
    );
  });

  it("accepts ELITE plan", async () => {
    mockGetUserPlan.mockResolvedValueOnce("ELITE");
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
  });

  it("accepts ENTERPRISE plan", async () => {
    mockGetUserPlan.mockResolvedValueOnce("ENTERPRISE");
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
  });

  // ─── OpenAI error handling ────────────────────────────────────────────────

  it("502 when OpenAI returns a non-OK status (401)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "We couldn't start your voice session. This is usually a temporary issue — please try again in a few seconds." });
  });

  it("502 when OpenAI returns a non-OK status (502)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 }),
    );
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
  });

  it("502 when OpenAI returns OK but empty token value", async () => {
    stubFetch(new Response(JSON.stringify({ value: "" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
  });

  it("502 when OpenAI returns OK but value field is missing entirely", async () => {
    stubFetch(new Response(JSON.stringify({ someOtherField: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
  });

  it("502 when fetch throws (network error / timeout abort)", async () => {
    vi.stubGlobal("fetch", fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError"),
    ) as never);
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
  });

  it("502 when fetch throws a generic network error", async () => {
    vi.stubGlobal("fetch", fetchMock.mockRejectedValue(new Error("ECONNREFUSED")) as never);
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
  });

  it("sends Authorization Bearer header to OpenAI", async () => {
    const { GET } = await loadRoute();
    await GET(mockRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-openai-key");
    expect(headers["api-key"]).toBeUndefined();
  });

  it("sends POST to the OpenAI client_secrets endpoint", async () => {
    const { GET } = await loadRoute();
    await GET(mockRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(init.method).toBe("POST");
  });

  it("passes page query param to buildMyraVoiceInstructions as currentPage", async () => {
    const { GET } = await loadRoute();
    const res = await GET(mockRequest("http://localhost/api/support/voice-session?page=%2Fdashboard%2Fportfolio"));
    expect(res.status).toBe(200);
    expect(mockBuildMyraVoiceInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: "/dashboard/portfolio" }),
      expect.any(Array),
    );
  });

  it("omits currentPage when no page query param is provided", async () => {
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
    expect(mockBuildMyraVoiceInstructions).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: undefined }),
      expect.any(Array),
    );
  });

  // ─── Lock release ───────────────────────────────────────────────────────────

  it("releases the concurrency lock immediately on success", async () => {
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
    expect(mockRedisDel).toHaveBeenCalledWith("voice:session:user_123");
  });

  it("releases the concurrency lock on OpenAI error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    expect(res.status).toBe(502);
    expect(mockRedisDel).toHaveBeenCalledWith("voice:session:user_123");
  });

  // ─── DELETE endpoint ────────────────────────────────────────────────────────

  it("DELETE releases the concurrency lock and returns released:true", async () => {
    mockRedisDel.mockResolvedValueOnce(1);
    const { DELETE } = await loadRoute();
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.released).toBe(true);
    expect(mockRedisDel).toHaveBeenCalledWith("voice:session:user_123");
  });

  it("DELETE returns released:false when redis.del fails", async () => {
    mockRedisDel.mockRejectedValueOnce(new Error("Redis down"));
    const { DELETE } = await loadRoute();
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.released).toBe(false);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    const { DELETE } = await loadRoute();
    const res = await DELETE(mockRequest());
    expect(res.status).toBe(401);
  });

  // ─── Actionable error messages ──────────────────────────────────────────────

  it("returns actionable error message on OpenAI non-OK", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 }),
    );
    const { GET } = await loadRoute();
    const res = await GET(mockRequest());
    const body = await res.json();
    expect(body.error).toContain("try again");
  });
});
