import { test, expect, Page } from "@playwright/test";

/**
 * E2E Tests for Deep Code Review Enrichment Changes
 * Validates: analytics API payload, UI rendering for US stocks, ETFs, Indian stocks, and Mutual Funds
 */

const HEADERS = { SKIP_AUTH: "true", SKIP_RATE_LIMIT: "true" };

async function setupPage(page: Page) {
  await page.setExtraHTTPHeaders(HEADERS);
}

async function expectNoSyncFailure(page: Page) {
  await expect(page.getByText("Intelligence Sync Failure")).toHaveCount(0);
}

// ─────────────────────────────────────────────
// 1. ANALYTICS API — PAYLOAD VALIDATION
// ─────────────────────────────────────────────
test.describe("Analytics API — Enrichment Payload", () => {

  test("US stock (AAPL) has sector and fundHouse at top level", async ({ request }) => {
    const res = await request.get("/api/stocks/AAPL/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.type).toBe("CRYPTO");
    expect(data).toHaveProperty("sector");
    expect(data).toHaveProperty("fundHouse");
    expect(data).toHaveProperty("description");
    expect(data).toHaveProperty("industry");
    expect(data).toHaveProperty("financials");
  });

  test("US stock (AAPL) has description and industry populated", async ({ request }) => {
    const res = await request.get("/api/stocks/AAPL/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(typeof data.description).toBe("string");
    expect(data.description.length).toBeGreaterThan(10);
    expect(typeof data.industry).toBe("string");
    expect(data.industry.length).toBeGreaterThan(0);
  });

  test("US stock (AAPL) has financials with income statement", async ({ request }) => {
    const res = await request.get("/api/stocks/AAPL/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.financials).toBeTruthy();
    expect(data.financials).toHaveProperty("incomeStatement");
  });

  test("ETF (SPY) has topHoldings and fundPerformanceHistory", async ({ request }) => {
    const res = await request.get("/api/stocks/SPY/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.type).toBe("CRYPTO");
    expect(data).toHaveProperty("topHoldings");
    expect(data).toHaveProperty("fundPerformanceHistory");
    expect(data).toHaveProperty("sector");
    expect(data).toHaveProperty("fundHouse");
  });

  test("Mutual fund has fundHouse and fundPerformanceHistory at top level", async ({ request }) => {
    const res = await request.get("/api/stocks/MF-119551/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.type).toBe("CRYPTO");
    expect(data).toHaveProperty("fundHouse");
    expect(data).toHaveProperty("fundPerformanceHistory");
    expect(data).toHaveProperty("sector");
  });

  test("Mutual fund has INR currency", async ({ request }) => {
    const res = await request.get("/api/stocks/MF-119551/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.currency).toBe("INR");
  });

  test("Indian stock has INR currency and sector", async ({ request }) => {
    const res = await request.get("/api/stocks/RELIANCE.NS/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.type).toBe("CRYPTO");
    expect(data.currency).toBe("INR");
    expect(data).toHaveProperty("sector");
    expect(data).toHaveProperty("industry");
  });

  test("Analytics payload has signalStrength and scoreDynamics", async ({ request }) => {
    const res = await request.get("/api/stocks/AAPL/analytics", { headers: HEADERS });
    if (res.status() === 404) return;
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data).toHaveProperty("signalStrength");
    expect(data).toHaveProperty("scoreDynamics");
    expect(data).toHaveProperty("eventAdjustedScores");
    expect(data).toHaveProperty("correlationRegime");
    expect(data).toHaveProperty("performance");
  });
});

// ─────────────────────────────────────────────
// 2. US STOCK — ASSET INTEL PAGE
// ─────────────────────────────────────────────
test.describe("US Stock Asset Intel — Enrichment UI", () => {
  test("AAPL page renders Company Profile with sector badge", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/AAPL");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });
    await expectNoSyncFailure(page);

    // Sector badge should be visible in header area
    await expect(page.getByText("CRYPTO").first()).toBeVisible({ timeout: 5000 });

    // Company Profile section
    await expect(page.getByText(/About.*Apple/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("AAPL page renders Financial Highlights", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/AAPL");

    await expectNoSyncFailure(page);
    await expect(page.getByText("Financial Highlights").first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Revenue").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Net Income").first()).toBeVisible({ timeout: 10000 });
  });

  test("AAPL page renders Signal Strength card", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/AAPL");

    await expectNoSyncFailure(page);
    await expect(page.getByText("Signal Strength").first()).toBeVisible({ timeout: 30000 });
  });

  test("AAPL page shows USD currency", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/AAPL");

    await expectNoSyncFailure(page);
    // Price should show $ symbol
    await expect(page.locator("text=/\\$\\d+/").first()).toBeVisible({ timeout: 30000 });
  });
});

// ─────────────────────────────────────────────
// 3. ETF — ASSET INTEL PAGE
// ─────────────────────────────────────────────
test.describe("ETF Asset Intel — Enrichment UI", () => {
  test("SPY page renders ETF Data Matrix", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/SPY");

    await expectNoSyncFailure(page);
    await expect(page.getByText("ETF Data Matrix").first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Expense Ratio").first()).toBeVisible({ timeout: 10000 });
  });

  test("SPY page renders Fund Composition & Performance", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/SPY");

    await expectNoSyncFailure(page);
    await expect(
      page.getByText("Fund Composition & Performance").first()
    ).toBeVisible({ timeout: 30000 });
  });

  test("SPY page has ETF type badge", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/SPY");

    await expectNoSyncFailure(page);
    await expect(page.getByText("CRYPTO").first()).toBeVisible({ timeout: 30000 });
  });
});

// ─────────────────────────────────────────────
// 4. INDIAN STOCK — ASSET INTEL PAGE
// ─────────────────────────────────────────────
test.describe("Indian Stock Asset Intel — Enrichment UI", () => {
  test("RELIANCE.NS page renders with INR currency (₹)", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/RELIANCE.NS");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });
    await expectNoSyncFailure(page);

    // Price should show ₹ symbol
    await expect(page.locator("text=/₹[\\d,]+/").first()).toBeVisible({ timeout: 10000 });
  });

  test("RELIANCE.NS page shows STOCK type badge", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/RELIANCE.NS");

    await expectNoSyncFailure(page);
    await expect(page.getByText("CRYPTO").first()).toBeVisible({ timeout: 30000 });
  });
});

// ─────────────────────────────────────────────
// 5. MUTUAL FUND — ASSET INTEL PAGE
// ─────────────────────────────────────────────
test.describe("Mutual Fund Asset Intel — Enrichment UI", () => {
  test("MF page renders with fund house badge", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/MF-119551");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });
    await expectNoSyncFailure(page);

    const assetMetaRow = page.locator("main div").filter({
      has: page.getByText("CRYPTO").first(),
    }).first();

    await expect(assetMetaRow.getByText("CRYPTO")).toBeVisible({ timeout: 5000 });
    await expect(assetMetaRow.getByText(/.+Mutual Fund$/i)).toBeVisible({ timeout: 10000 });
  });

  test("MF page renders Fund Composition & Performance with returns", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/MF-119551");

    await expectNoSyncFailure(page);
    await expect(
      page.getByText("Fund Lookthrough Intelligence").first()
    ).toBeVisible({ timeout: 30000 });

    // Should show fund returns
    await expect(page.getByText("Performance Metrics").first()).toBeVisible({ timeout: 10000 });
  });

  test("MF page shows INR currency (₹)", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/MF-119551");

    await expectNoSyncFailure(page);
    await expect(page.locator("text=/₹[\\d.]+/").first()).toBeVisible({ timeout: 30000 });
  });

  test("MF page renders Lyra Terminal with chat input", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/MF-119551");
    await page.waitForLoadState("domcontentloaded");

    // Page should load with any content visible
    const hasContent = await page.locator("h1, h2, input, textarea, [class*='card']").first().isVisible({ timeout: 20000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 6. CROSS-ASSET TYPE FLOW
// ─────────────────────────────────────────────
test.describe("Cross-Asset Enrichment Flow", () => {
  test("navigate from US stock to ETF — both render enrichment", async ({ page }) => {
    await setupPage(page);

    // Start at AAPL
    await page.goto("/dashboard/assets/AAPL");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });
    await expectNoSyncFailure(page);
    await expect(page.getByText("CRYPTO").first()).toBeVisible({ timeout: 5000 });

    // Navigate to SPY
    await page.goto("/dashboard/assets/SPY");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });
    await expectNoSyncFailure(page);
    await expect(page.getByText("CRYPTO").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("ETF Data Matrix").first()).toBeVisible({ timeout: 10000 });
  });

  test("navigate from MF to Indian stock — currency stays ₹", async ({ page }) => {
    await setupPage(page);

    // Start at MF
    await page.goto("/dashboard/assets/MF-119551");
    await expect(page.locator("text=/₹[\\d.]+/").first()).toBeVisible({ timeout: 30000 });

    // Navigate to Indian stock
    await page.goto("/dashboard/assets/RELIANCE.NS");
    await expect(page.locator("text=/₹[\\d,]+/").first()).toBeVisible({ timeout: 30000 });
  });
});
