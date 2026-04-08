import { expect, test, type Page } from "@playwright/test";

const HEADERS = {
  SKIP_AUTH: "true",
  "x-skip-auth": "true",
  SKIP_RATE_LIMIT: "true",
  "x-skip-rate-limit": "true",
};

async function setupPage(page: Page) {
  await page.setExtraHTTPHeaders(HEADERS);
  await page.addInitScript(() => {
    window.localStorage.setItem("onboarding:completed:v1", "1");
  });
}

async function completeOnboardingIfVisible(page: Page) {
  await page.getByText("Loading onboarding...").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});

  const onboardingHeading = page.getByText("Mandatory Setup").first();
  const isOnboardingVisible = await onboardingHeading.isVisible({ timeout: 1500 }).catch(() => false);
  if (!isOnboardingVisible) return;

  await page.request.patch("/api/user/onboarding", {
    headers: HEADERS,
    data: { skipped: true },
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.getByText("Mandatory Setup").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
}

async function openDashboardPage(page: Page, path: string) {
  await setupPage(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 15000 }).catch(() => {});
  await completeOnboardingIfVisible(page);
}

test.describe("Dashboard cleanup regressions", () => {
  test("discovery navigation uses Multibagger Radar everywhere", async ({ page, isMobile }) => {
    await openDashboardPage(page, "/dashboard/discovery");

    await expect(page.locator("h1").first()).toContainText(/Multibagger Radar/i, { timeout: 15000 });

    if (isMobile) return;

    await expect(page.getByRole("link", { name: /Multibagger Radar/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-slot="breadcrumb-page"]')).toContainText("Multibagger Radar", { timeout: 10000 });
  });

  test("asset surfaces no longer render beginner summary copy", async ({ page }) => {
    await openDashboardPage(page, "/dashboard/assets");
    await expect(page.getByText(/Beginner Summary/i)).toHaveCount(0);

    await openDashboardPage(page, "/dashboard/assets/AAPL");
    const hasSyncFailure = await page.getByText(/Intelligence Sync Failure|Asset data not found/i).isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSyncFailure) {
      await expect(page.getByText(/Quick explanation/i)).toHaveCount(0);
    }
  });

  test("portfolio and shock pages no longer render next actions sections", async ({ page }) => {
    await openDashboardPage(page, "/dashboard/portfolio");
    await expect(page.getByText(/Next actions/i)).toHaveCount(0);
    await expect(page.getByText(/Decide what to check after the portfolio summary/i)).toHaveCount(0);

    await openDashboardPage(page, "/dashboard/stress-test");
    await expect(page.getByText(/Next actions/i)).toHaveCount(0);
    await expect(page.getByText(/Decide what to test after the scenario setup/i)).toHaveCount(0);
  });

  test("guide bars removed from cleaned dashboard pages", async ({ page }) => {
    const pages = [
      "/dashboard/discovery",
      "/dashboard/assets",
      "/dashboard/compare",
      "/dashboard/stress-test",
      "/dashboard/learning",
      "/dashboard/timeline",
      "/dashboard/discovery-stocks",
    ];

    for (const path of pages) {
      await openDashboardPage(page, path);
      await expect(page.getByText(/How to use:?/i)).toHaveCount(0);
    }
  });

  test("settings page no longer shows configuration areas summary card", async ({ page }) => {
    await openDashboardPage(page, "/dashboard/settings");
    await expect(page.getByText(/Configuration areas/i)).toHaveCount(0);
    await expect(page.getByText(/Profile \+ access/i)).toHaveCount(0);
    await expect(page.getByText(/Behavior \+ alerts/i)).toHaveCount(0);
  });

  test("rewards page uses merged credits snapshot instead of old stat tiles", async ({ page }) => {
    await openDashboardPage(page, "/dashboard/rewards");
    await expect(page.getByText(/Credits snapshot/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Available balance/i)).toBeVisible();
    await expect(page.getByText(/Toward 1,500 credits earned/i)).toBeVisible();
    await expect(page.getByText(/Level Progress/i)).toBeVisible();

    await expect(page.getByText(/^available balance$/i)).toHaveCount(1);
    await expect(page.getByText(/^all-time earned$/i)).toHaveCount(0);
    await expect(page.getByText(/^lifetime$/i)).toHaveCount(0);
  });

  test("narratives header no longer shows old top stat cards", async ({ page }) => {
    await openDashboardPage(page, "/dashboard/narratives");
    await expect(page.getByText(/Narrative chain/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Market Narratives/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/The story behind the price action/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/^Main story$/i)).toHaveCount(0);
    await expect(page.getByText(/^Strengthening$/i)).toHaveCount(0);
  });

  test("dashboard home uses the current summary surface with insight feed and action tiles", async ({ page }) => {
    await openDashboardPage(page, "/dashboard");
    await expect(page.getByText(/Insight feed|Today.s feeds/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Where to go next|Ranked by what to act on/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("public tool pages expose a single Join Waitlist CTA", async ({ page }) => {
    const toolPages = [
      "/tools/ai-stock-analysis",
      "/tools/ai-portfolio-analyzer",
      "/tools/ai-investment-research",
      "/tools/market-narrative-tracker",
    ];

    for (const path of toolPages) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("link", { name: /Join Waitlist/i })).toHaveCount(1);
    }
  });
});
