import { test, expect, Page } from "@playwright/test";

/**
 * Integration/E2E Tests for Scenario Analysis Card Gating
 * Validates: Scenario card renders only for STOCK and eligible ETF assets
 */

const HEADERS = { SKIP_AUTH: "true", SKIP_RATE_LIMIT: "true" };

async function setupPage(page: Page) {
  await page.setExtraHTTPHeaders(HEADERS);
}

test.describe("Scenario Analysis Card — Asset Type Gating", () => {
  test("unsupported asset scenarios API returns typed not_ready payload", async ({ request }) => {
    const res = await request.get("/api/stocks/MF-119551/scenarios", { headers: HEADERS });
    expect(res.status()).toBe(200);

    const payload = await res.json();
    expect(payload.ready).toBe(false);
    expect(payload.status).toBe("not_ready");
    expect(payload.scenarios).toBeNull();
  });

  test("STOCK (AAPL) renders scenario card", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/AAPL");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });

    // Scenario Analysis card should be present (just verify the header exists)
    const scenarioCard = page.getByText("Scenario Analysis").first();
    await expect(scenarioCard).toBeVisible({ timeout: 10000 });

    // Verify the card container exists (it has the description text)
    const description = page.getByText(/Forward outcomes under regime shifts/i);
    await expect(description).toBeVisible({ timeout: 5000 });
  });

  test("ETF with equity exposure (SPY) renders scenario card", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/SPY");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });

    // Scenario Analysis card should be present for equity ETFs
    const scenarioCard = page.getByText("Scenario Analysis").first();
    await expect(scenarioCard).toBeVisible({ timeout: 10000 });
  });

  test("CRYPTO (BTC-USD) is gated for non-Elite plans", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/BTC-USD");

    // With STARTER plan, crypto analytics returns 403 → page shows error/gate screen.
    // Either the gating error message OR an upgrade gate is visible — no full asset page renders.
    const gatingSignal = page.getByText(/Intelligence Sync Failure|Upgrade to Elite|Elite/i).first();
    await expect(gatingSignal).toBeVisible({ timeout: 30000 });

    // Scenario Analysis card must NOT be present in this gated state
    const scenarioCard = page.getByText("Scenario Analysis");
    await expect(scenarioCard).toHaveCount(0);
  });

  test("MUTUAL_FUND does NOT render scenario card", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/MF-119551");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });

    // Scenario Analysis card should NOT be present
    const scenarioCard = page.getByText("Scenario Analysis");
    await expect(scenarioCard).toHaveCount(0);
  });

  test("COMMODITY does NOT render scenario card", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/GC=F");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });

    // Scenario Analysis card should NOT be present
    const scenarioCard = page.getByText("Scenario Analysis");
    await expect(scenarioCard).toHaveCount(0);
  });
});

test.describe("Scenario Analysis Card — Plan Gating (Visual Check)", () => {
  test("Scenario card renders a valid gating state for current plan", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/assets/AAPL");

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });

    const scenarioCard = page.getByText("Scenario Analysis").first();
    await expect(scenarioCard).toBeVisible({ timeout: 10000 });

    const unlockCount = await page.getByText("Unlock full scenario breakdown").count();
    const tailModelCount = await page.getByText("Tail model").count();

    // Exactly one valid state should be rendered:
    // STARTER -> unlock=0, tail=0
    // PRO     -> unlock=1, tail=0
    // ELITE+  -> unlock=0, tail=1
    const isStarterState = unlockCount === 0 && tailModelCount === 0;
    const isProState = unlockCount === 1 && tailModelCount === 0;
    const isEliteState = unlockCount === 0 && tailModelCount === 1;

    expect(isStarterState || isProState || isEliteState).toBe(true);

    // Core scenario controls and metrics should still be visible.
    await expect(page.getByLabel("Scenario horizon")).toBeVisible();
    await expect(page.getByLabel("Scenario confidence")).toBeVisible();
    await expect(page.getByText(/Value-at-Risk/i).first()).toBeVisible();
  });
});
