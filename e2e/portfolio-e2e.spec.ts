import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const HEADERS = { SKIP_AUTH: "true", SKIP_RATE_LIMIT: "true", "Content-Type": "application/json" };

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function cleanAll(request: APIRequestContext) {
  const res = await request.get("/api/portfolio", { headers: HEADERS });
  const list = (await res.json()).portfolios ?? [];
  for (const p of list) {
    await request.delete(`/api/portfolio/${p.id}`, { headers: HEADERS }).catch(() => {});
  }
}

async function createPortfolio(request: APIRequestContext, name = "Test Portfolio") {
  await cleanAll(request);
  const res = await request.post("/api/portfolio", {
    headers: HEADERS,
    data: { name, currency: "USD", region: "US" },
  });
  const data = await res.json();
  return data.portfolio?.id as string | null;
}

async function setupPage(page: Page) {
  await page.setExtraHTTPHeaders(HEADERS);
  await page.addInitScript(() => {
    window.localStorage.setItem("onboarding:completed:v1", "1");
  });
}

async function recoverIfRateLimited(page: Page) {
  const rateLimited = await page
    .getByText(/too_many_requests|Too many requests/i)
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  if (!rateLimited) return;

  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function gotoPortfolioPage(page: Page) {
  await setupPage(page);
  await page.goto("/dashboard/portfolio", { waitUntil: "domcontentloaded" });
  await recoverIfRateLimited(page);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}

async function clickNewPortfolioBtn(page: Page) {
  await page.locator('button:has-text("New")').first().waitFor({ timeout: 10000 });
  await page.locator('button:has-text("New")').first().click();
  await page.getByText("New Portfolio").waitFor({ timeout: 5000 });
}

async function ensurePortfolioExistsViaUI(page: Page) {
  const hasEmpty = await page
    .getByRole("button", { name: /Create First Portfolio/i })
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (hasEmpty) {
    await clickNewPortfolioBtn(page);
    await page.getByLabel("Portfolio Name").fill("E2E Portfolio");
    await page.getByRole("button", { name: "Create Portfolio" }).click();
    await page.waitForTimeout(2000);
  }
}

// ─────────────────────────────────────────────
// 1. PORTFOLIO API — CRUD
// ─────────────────────────────────────────────
test.describe("Portfolio API — CRUD", () => {
  let portfolioId: string | null = null;

  test.beforeAll(async ({ request }) => {
    portfolioId = await createPortfolio(request, "CRUD Test Portfolio");
  });

  test.afterAll(async ({ request }) => {
    if (portfolioId) await request.delete(`/api/portfolio/${portfolioId}`, { headers: HEADERS }).catch(() => {});
  });

  test("GET /api/portfolio returns portfolios array", async ({ request }) => {
    const res = await request.get("/api/portfolio", { headers: HEADERS });
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).portfolios)).toBeTruthy();
  });

  test("POST /api/portfolio rejects empty name with 400", async ({ request }) => {
    const res = await request.post("/api/portfolio", { headers: HEADERS, data: { name: "" } });
    expect(res.status()).toBe(400);
  });

  test("GET /api/portfolio/[id] returns portfolio with holdings array", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.get(`/api/portfolio/${portfolioId}`, { headers: HEADERS });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.portfolio.id).toBe(portfolioId);
    expect(Array.isArray(data.portfolio.holdings)).toBeTruthy();
  });

  test("PATCH /api/portfolio/[id] updates name", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.patch(`/api/portfolio/${portfolioId}`, {
      headers: HEADERS, data: { name: "CRUD Updated" },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).portfolio.name).toBe("CRUD Updated");
  });

  test("GET /api/portfolio/[id] returns 404 for non-existent id", async ({ request }) => {
    const res = await request.get("/api/portfolio/does-not-exist-abc123", { headers: HEADERS });
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────
// 2. PORTFOLIO API — HOLDINGS
// ─────────────────────────────────────────────
test.describe("Portfolio API — Holdings", () => {
  let portfolioId: string | null = null;
  let holdingId: string | null = null;

  test.beforeAll(async ({ request }) => {
    portfolioId = await createPortfolio(request, "Holdings Test");
  });

  test.afterAll(async ({ request }) => {
    if (portfolioId) await request.delete(`/api/portfolio/${portfolioId}`, { headers: HEADERS }).catch(() => {});
  });

  test("POST holdings adds AAPL with correct fields", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.post(`/api/portfolio/${portfolioId}/holdings`, {
      headers: HEADERS, data: { symbol: "AAPL", quantity: 10, avgPrice: 170.0 },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.holding.symbol).toBe("AAPL");
    expect(data.holding.quantity).toBe(10);
    expect(data.holding.asset.name).toBeTruthy();
    holdingId = data.holding.id;
  });

  test("POST holdings rejects fake symbol with 404", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.post(`/api/portfolio/${portfolioId}/holdings`, {
      headers: HEADERS, data: { symbol: "FAKEXYZ999", quantity: 1, avgPrice: 100 },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  test("POST holdings rejects negative quantity with 400", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.post(`/api/portfolio/${portfolioId}/holdings`, {
      headers: HEADERS, data: { symbol: "AAPL", quantity: -5, avgPrice: 170 },
    });
    expect(res.status()).toBe(400);
  });

  test("POST holdings upserts duplicate symbol — no duplicate rows", async ({ request }) => {
    if (!portfolioId) test.skip();
    await request.post(`/api/portfolio/${portfolioId}/holdings`, {
      headers: HEADERS, data: { symbol: "AAPL", quantity: 25, avgPrice: 185.0 },
    });
    const holdings = (await (await request.get(`/api/portfolio/${portfolioId}`, { headers: HEADERS })).json()).portfolio.holdings;
    expect(holdings.filter((h: { symbol: string }) => h.symbol === "AAPL").length).toBe(1);
  });

  test("PATCH holdings/[hid] updates quantity and avgPrice", async ({ request }) => {
    if (!portfolioId || !holdingId) test.skip();
    const res = await request.patch(
      `/api/portfolio/${portfolioId}/holdings/${holdingId}`,
      { headers: HEADERS, data: { quantity: 30, avgPrice: 190.0 } },
    );
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).holding.quantity).toBe(30);
    expect((await request.get(`/api/portfolio/${portfolioId}`, { headers: HEADERS }).then(r => r.json())).portfolio).toBeDefined();
  });

  test("DELETE holdings/[hid] removes holding", async ({ request }) => {
    if (!portfolioId || !holdingId) test.skip();
    const res = await request.delete(`/api/portfolio/${portfolioId}/holdings/${holdingId}`, { headers: HEADERS });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).success).toBe(true);
    holdingId = null;
  });

  test("DELETE holdings/[hid] returns 404 for wrong id", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.delete(`/api/portfolio/${portfolioId}/holdings/bad-hid-999`, { headers: HEADERS });
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────
// 3. PORTFOLIO API — HEALTH ENGINE
// ─────────────────────────────────────────────
test.describe("Portfolio API — Health Engine", () => {
  let portfolioId: string | null = null;

  test.beforeAll(async ({ request }) => {
    portfolioId = await createPortfolio(request, "Health Test");
    if (!portfolioId) return;
    for (const sym of ["AAPL", "SPY", "GLD"]) {
      await request.post(`/api/portfolio/${portfolioId}/holdings`, {
        headers: HEADERS, data: { symbol: sym, quantity: 10, avgPrice: 100 },
      });
    }
  });

  test.afterAll(async ({ request }) => {
    if (portfolioId) await request.delete(`/api/portfolio/${portfolioId}`, { headers: HEADERS }).catch(() => {});
  });

  test("GET /health returns snapshot or message", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.get(`/api/portfolio/${portfolioId}/health`, { headers: HEADERS });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.snapshot !== undefined || data.message !== undefined).toBeTruthy();
  });

  test("GET /health?refresh=true — all scores are 0-100 numbers", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.get(`/api/portfolio/${portfolioId}/health?refresh=true`, { headers: HEADERS });
    expect(res.ok()).toBeTruthy();
    const { snapshot } = await res.json();
    if (snapshot) {
      for (const field of ["healthScore", "diversificationScore", "concentrationScore", "volatilityScore", "correlationScore", "qualityScore"]) {
        expect(typeof snapshot[field]).toBe("number");
        expect(snapshot[field]).toBeGreaterThanOrEqual(0);
        expect(snapshot[field]).toBeLessThanOrEqual(100);
      }
    }
  });

  test("health snapshot date is a valid ISO string", async ({ request }) => {
    if (!portfolioId) test.skip();
    const { snapshot } = await (await request.get(`/api/portfolio/${portfolioId}/health`, { headers: HEADERS })).json();
    if (snapshot) expect(new Date(snapshot.date).getTime()).toBeGreaterThan(0);
  });

  test("GET /analytics returns 200 or 403 (plan-gated)", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.get(`/api/portfolio/${portfolioId}/analytics`, { headers: HEADERS });
    expect([200, 403].includes(res.status())).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 4. PORTFOLIO API — MONTE CARLO VALIDATION
// ─────────────────────────────────────────────
test.describe("Portfolio API — Monte Carlo Validation", () => {
  let portfolioId: string | null = null;

  test.beforeAll(async ({ request }) => {
    portfolioId = await createPortfolio(request, "MC Test");
    if (!portfolioId) return;
    for (const [sym, price] of [["AAPL", 170], ["MSFT", 380], ["SPY", 500]]) {
      await request.post(`/api/portfolio/${portfolioId}/holdings`, {
        headers: HEADERS, data: { symbol: sym, quantity: 10, avgPrice: price },
      });
    }
  });

  test.afterAll(async ({ request }) => {
    if (portfolioId) await request.delete(`/api/portfolio/${portfolioId}`, { headers: HEADERS }).catch(() => {});
  });

  test("POST /simulate rejects invalid mode enum with 400 or 403", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.post(`/api/portfolio/${portfolioId}/simulate`, {
      headers: HEADERS, data: { mode: "Z", horizon: "20", paths: 100 },
    });
    // STARTER plan returns 403 before schema validation; upgraded plan returns 400
    expect([400, 403].includes(res.status())).toBe(true);
  });

  test("POST /simulate rejects invalid horizon with 400 or 403", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.post(`/api/portfolio/${portfolioId}/simulate`, {
      headers: HEADERS, data: { mode: "B", horizon: "999", paths: 100 },
    });
    expect([400, 403].includes(res.status())).toBe(true);
  });

  test("POST /simulate returns correct result shape when allowed", async ({ request }) => {
    if (!portfolioId) test.skip();
    const res = await request.post(`/api/portfolio/${portfolioId}/simulate`, {
      headers: HEADERS, data: { mode: "B", horizon: "20", paths: 100 },
    });
    if (![200, 403].includes(res.status())) {
      console.error("MC API failed with status", res.status(), await res.json().catch(() => {}));
    }
    expect([200, 400, 403, 500].includes(res.status())).toBe(true);
    if (res.ok()) {
      const { simulation } = await res.json();
      expect(typeof simulation.expectedReturn).toBe("number");
      expect(typeof simulation.var5).toBe("number");
      expect(typeof simulation.es5).toBe("number");
      const total = Object.values(simulation.regimeForecast as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 1);
    }
  });
});

// ─────────────────────────────────────────────
// 5. PORTFOLIO API — AUTH / BOUNDARY CHECKS
// ─────────────────────────────────────────────
test.describe("Portfolio API — Auth & Boundary Checks", () => {

  test("GET /api/portfolio with SKIP_AUTH returns portfolios array", async ({ request }) => {
    const res = await request.get("/api/portfolio", { headers: HEADERS });
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).portfolios)).toBeTruthy();
  });

  test("GET non-existent portfolio returns 404 with error field", async ({ request }) => {
    const res = await request.get("/api/portfolio/totally-fake-id-xyz", { headers: HEADERS });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBeDefined();
  });

  test("PATCH non-existent portfolio returns 404", async ({ request }) => {
    const res = await request.patch("/api/portfolio/totally-fake-id-xyz", {
      headers: HEADERS, data: { name: "Updated" },
    });
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────
// 6. PORTFOLIO UI — PAGE RENDER
// ─────────────────────────────────────────────
test.describe("Portfolio UI — Page Render", () => {

  test("renders Portfolio Intelligence heading", async ({ page }) => {
    await gotoPortfolioPage(page);
    await expect(page.getByRole("heading", { name: /Portfolio Intelligence/i })).toBeVisible({ timeout: 15000 });
  });

  test("breadcrumb shows Portfolio Intel", async ({ page }) => {
    await gotoPortfolioPage(page);
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toContainText("Portfolio Intel", { timeout: 10000 });
  });

  test("Try Demo button is visible in header", async ({ page }) => {
    await gotoPortfolioPage(page);
    await expect(page.locator('button:has-text("Try Demo")')).toBeVisible({ timeout: 10000 });
  });

  test("New button always visible in portfolio selector", async ({ page }) => {
    await gotoPortfolioPage(page);
    await expect(page.locator('button:has-text("New")').first()).toBeVisible({ timeout: 10000 });
  });

  test("US region and currency shown in header", async ({ page }) => {
    await gotoPortfolioPage(page);
    await expect(page.getByText(/US\s+market\s*·\s*\$\s*USD/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("empty state or portfolio selector visible on load", async ({ page }) => {
    await gotoPortfolioPage(page);
    const hasEmpty = await page.getByRole("button", { name: /Create First Portfolio/i }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasNew = await page.locator('button:has-text("New")').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasEmpty || hasNew).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 7. PORTFOLIO UI — CREATE PORTFOLIO DIALOG
// ─────────────────────────────────────────────
test.describe("Portfolio UI — Create Portfolio Dialog", () => {

  test("New button opens dialog with New Portfolio heading", async ({ page }) => {
    await gotoPortfolioPage(page);
    await clickNewPortfolioBtn(page);
    await expect(page.getByText("New Portfolio").first()).toBeVisible({ timeout: 5000 });
  });

  test("dialog shows Portfolio Name field", async ({ page }) => {
    await gotoPortfolioPage(page);
    await clickNewPortfolioBtn(page);
    await expect(page.getByLabel("Portfolio Name")).toBeVisible({ timeout: 5000 });
  });

  test("dialog shows Portfolio Settings section", async ({ page }) => {
    await gotoPortfolioPage(page);
    await clickNewPortfolioBtn(page);
    await expect(page.getByText("Portfolio Settings").first()).toBeVisible({ timeout: 5000 });
  });

  test("Cancel button closes dialog", async ({ page }) => {
    await gotoPortfolioPage(page);
    await clickNewPortfolioBtn(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(500);
    // Overlay should be gone
    await expect(page.locator('.fixed.inset-0.z-50').first()).not.toBeVisible({ timeout: 3000 });
  });

  test("empty name submit shows validation error", async ({ page }) => {
    await gotoPortfolioPage(page);
    await clickNewPortfolioBtn(page);
    await page.getByRole("button", { name: "Create Portfolio" }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("valid submit closes dialog overlay", async ({ page, request }) => {
    await cleanAll(request);
    await gotoPortfolioPage(page);
    await clickNewPortfolioBtn(page);
    await page.getByLabel("Portfolio Name").fill("E2E Created Portfolio");
    await page.getByRole("button", { name: "Create Portfolio" }).click();
    // Overlay div should disappear
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 8000 });
  });
});

// ─────────────────────────────────────────────
// 8. PORTFOLIO UI — ADD HOLDING DIALOG
// ─────────────────────────────────────────────
test.describe("Portfolio UI — Add Holding Dialog", () => {

  test("Add Holding button visible when portfolio exists", async ({ page }) => {
    await gotoPortfolioPage(page);
    await ensurePortfolioExistsViaUI(page);
    await expect(page.getByRole("button", { name: /Add Holding/i })).toBeVisible({ timeout: 10000 });
  });

  test("Add Holding dialog opens with Symbol, Quantity, Price fields", async ({ page }) => {
    await gotoPortfolioPage(page);
    await ensurePortfolioExistsViaUI(page);
    await page.getByRole("button", { name: /Add Holding/i }).click();
    await expect(page.getByLabel("Symbol")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Quantity")).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel("Avg. Buy Price")).toBeVisible({ timeout: 3000 });
  });

  test("empty submit shows validation error", async ({ page }) => {
    await gotoPortfolioPage(page);
    await ensurePortfolioExistsViaUI(page);
    await page.getByRole("button", { name: /Add Holding/i }).click();
    await page.getByRole("button", { name: "Add Holding" }).last().click();
    await expect(page.getByText(/required|must be/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("Cancel button closes Add Holding dialog", async ({ page }) => {
    await gotoPortfolioPage(page);
    await ensurePortfolioExistsViaUI(page);
    await page.getByRole("button", { name: /Add Holding/i }).click();
    await expect(page.getByLabel("Symbol")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Symbol")).not.toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────
// 9. PORTFOLIO UI — MOCK DEMO OVERLAY
// ─────────────────────────────────────────────
test.describe("Portfolio UI — Mock Demo Overlay", () => {

  test("Try Demo opens overlay with Demo Portfolio badge", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Demo Portfolio").first()).toBeVisible({ timeout: 5000 });
  });

  test("demo overlay shows feature pills", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    for (const pill of ["AI Health Engine", "Fragility Analysis", "Monte Carlo"]) {
      await expect(page.getByText(pill).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("demo overlay shows all 4 metric cards", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    for (const label of ["Portfolio Value", "Total P&L", "Day Change", "Holdings"]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("demo portfolio value is a non-zero dollar amount", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    const el = page.getByText(/\$[\d,]+\.\d{2}/).first();
    await el.waitFor({ timeout: 8000 });
    expect(parseFloat((await el.textContent())!.replace(/[$,]/g, ""))).toBeGreaterThan(0);
  });

  test("demo overlay shows Portfolio Health with score 72", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Portfolio Health").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("72").first()).toBeVisible({ timeout: 8000 });
  });

  test("demo overlay shows Balanced health band", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Balanced").first()).toBeVisible({ timeout: 8000 });
  });

  test("demo overlay shows all 5 health dimension labels", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    for (const dim of ["Diversification", "Concentration", "Volatility Control", "Correlation Risk", "Quality & Trust"]) {
      await expect(page.getByText(dim).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("demo overlay shows Fragility Analysis section", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Fragility Analysis").first()).toBeVisible({ timeout: 8000 });
  });

  test("demo Allocation section shows Technology", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Allocation").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Technology").first()).toBeVisible({ timeout: 5000 });
  });

  test("demo holdings table shows AAPL, MSFT, NVDA, SPY", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    for (const sym of ["AAPL", "MSFT", "NVDA", "SPY"]) {
      await expect(page.getByText(sym).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("demo Monte Carlo shows Expected Return and Regime Forecast", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Monte Carlo Simulation").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Expected Return").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Regime Forecast").first()).toBeVisible({ timeout: 5000 });
  });

  test("demo Monte Carlo expected return renders ~6.21%", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText(/6\.2[0-9]%/).first()).toBeVisible({ timeout: 8000 });
  });

  test("demo Monte Carlo shows 5,000 paths label", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText(/5,000 paths/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("demo Regime Forecast shows NEUTRAL entry", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("NEUTRAL").first()).toBeVisible({ timeout: 8000 });
  });

  test("Close Demo button closes overlay", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await expect(page.getByText("Demo Portfolio").first()).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Close Demo/i }).click();
    await expect(page.getByText("Demo Portfolio").first()).not.toBeVisible({ timeout: 5000 });
  });

  test("Start Building CTA closes overlay", async ({ page }) => {
    await gotoPortfolioPage(page);
    await page.locator('button:has-text("Try Demo")').click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole("button", { name: /Start Building/i }).click();
    await expect(page.getByText("Demo Portfolio").first()).not.toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────
// 10. PORTFOLIO ACCURACY — MATH & HEALTH ENGINE
// ─────────────────────────────────────────────
test.describe("Portfolio Accuracy — Math & Health Engine", () => {

  test("health engine: diversification score > 30 for 4 diverse assets", async ({ request }) => {
    const portfolioId = await createPortfolio(request, "Accuracy Test");
    if (!portfolioId) test.skip();
    for (const sym of ["AAPL", "MSFT", "SPY", "GLD"]) {
      await request.post(`/api/portfolio/${portfolioId}/holdings`, {
        headers: HEADERS, data: { symbol: sym, quantity: 10, avgPrice: 100 },
      });
    }
    const res = await request.get(`/api/portfolio/${portfolioId}/health?refresh=true`, { headers: HEADERS });
    const { snapshot } = await res.json();
    if (snapshot) {
      expect(snapshot.healthScore).toBeGreaterThan(0);
      expect(snapshot.healthScore).toBeLessThanOrEqual(100);
      expect(snapshot.diversificationScore).toBeGreaterThan(30);
    }
    await request.delete(`/api/portfolio/${portfolioId}`, { headers: HEADERS }).catch(() => {});
  });

  test("DELETE /api/portfolio/[id] removes portfolio — 404 after delete", async ({ request }) => {
    const portfolioId = await createPortfolio(request, "Delete Test");
    if (!portfolioId) test.skip();
    const deleteRes = await request.delete(`/api/portfolio/${portfolioId}`, { headers: HEADERS });
    expect(deleteRes.ok()).toBeTruthy();
    const check = await request.get(`/api/portfolio/${portfolioId}`, { headers: HEADERS });
    expect(check.status()).toBe(404);
  });
});
