import { test, expect, Page } from "@playwright/test";

const HEADERS = {
  SKIP_AUTH: "true",
  "x-skip-auth": "true",
  SKIP_RATE_LIMIT: "true",
  "x-skip-rate-limit": "true",
};

async function setupAdminPage(page: Page) {
  await page.setExtraHTTPHeaders(HEADERS);
}

test.describe("admin analytics surface", () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminPage(page);
  });

  test("overview loads with grouped admin navigation and core KPI sections", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/admin$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    const main = page.locator("main");

    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible({ timeout: 15000 });
    await expect(main.getByText("Revenue").first()).toBeVisible();
    await expect(main.getByText("Users").first()).toBeVisible();
    await expect(main.getByText("AI Activity").first()).toBeVisible();
    await expect(main.getByText("Plan Distribution").first()).toBeVisible();
    await expect(main.getByText("Plan Mix").first()).toBeVisible();
    await expect(main.getByText("Platform Health Summary").first()).toBeVisible();
  });

  test("users-growth range controls drive the growth API and show scoped labels", async ({ page }) => {
    await page.goto("/admin/users-growth", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/admin\/users-growth$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("heading", { name: "Users & Growth" })).toBeVisible();
    await page.getByRole("button", { name: "Growth" }).click();
    await expect(page.getByText("Range-sensitive KPIs")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Weekly Signups (Fixed 12 weeks)")).toBeVisible();
    await expect(page.getByText("Monthly Signups (Fixed 12 months)")).toBeVisible();
    await expect(page.getByText("Onboarding Funnel (All Time)")).toBeVisible();

    const growthResponse = page.waitForResponse((response) => {
      return response.url().includes("/api/admin/growth?range=90d") && response.request().method() === "GET";
    });

    await page.getByRole("button", { name: "90D" }).click();
    const response = await growthResponse;
    expect(response.ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: /North-Star KPIs \(90d Cohort\)/i })).toBeVisible();
    await expect(page.getByText("Created in 90d", { exact: false })).toBeVisible();
  });

  test("legacy viral page redirects to users-growth", async ({ page }) => {
    await page.goto("/admin/viral", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/admin/users-growth");
    await expect(page).toHaveURL(/\/admin\/users-growth$/);
  });

  test("support inbox loads with filters and paginated inbox UI", async ({ page }) => {
    await page.goto("/admin/support", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Support Inbox" })).toBeVisible();
    await expect(page.getByRole("button", { name: /OPEN:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /PENDING:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /RESOLVED:/i })).toBeVisible();

    await expect(page.getByText("Select a conversation")).toBeVisible();
  });
});
