import { test, expect } from "@playwright/test";

const HEADERS = {
  SKIP_AUTH: "true",
  "x-skip-auth": "true",
  SKIP_RATE_LIMIT: "true",
  "x-skip-rate-limit": "true",
  "Content-Type": "application/json",
};

test.describe("E2E bypass contracts", () => {
  test("auth bypass is active for protected plan API", async ({ request }) => {
    const res = await request.get("/api/user/plan", { headers: HEADERS });
    expect(res.status(), "Expected auth bypass to prevent 401 on /api/user/plan").not.toBe(401);
    expect(res.ok()).toBeTruthy();

    const data = await res.json();
    expect(data.plan).toBeDefined();
    expect(["STARTER", "PRO", "ELITE", "ENTERPRISE"]).toContain(data.plan);
  });

  test("auth bypass is active for protected chat API", async ({ request }) => {
    const res = await request.post("/api/chat", {
      headers: HEADERS,
      data: {
        messages: [{ role: "user", content: "What is the global market trend right now?" }],
        contextData: {
          symbol: "GLOBAL",
          assetType: "GLOBAL",
          scores: {},
        },
        symbol: "GLOBAL",
      },
    });

    expect(res.status(), "Expected auth bypass to prevent 401 on /api/chat").not.toBe(401);
    expect(res.ok()).toBeTruthy();
  });

  test("rate-limit bypass prevents 429s on repeated chat requests", async ({ request }) => {
    for (let i = 0; i < 12; i += 1) {
      const res = await request.post("/api/chat", {
        headers: HEADERS,
        data: {
          messages: [{ role: "user", content: `What is RSI? ${i}` }],
          contextData: {
            symbol: "GLOBAL",
            assetType: "GLOBAL",
            scores: {},
          },
          symbol: "GLOBAL",
        },
        failOnStatusCode: false,
      });

      expect(res.status(), `Expected no 401/429 on repeated request ${i + 1}`).not.toBe(401);
      expect(res.status(), `Expected rate-limit bypass to prevent 429 on request ${i + 1}`).not.toBe(429);
      expect([200, 400]).toContain(res.status());
    }
  });
});
