import { test, expect } from "@playwright/test";

const HEADERS = { SKIP_AUTH: "true", SKIP_RATE_LIMIT: "true" };

test.describe("Prompt Pipeline Optimizations - Smoke Tests", () => {
  
  test("PRO page loads with chat input", async ({ page, isMobile }) => {
    await page.setExtraHTTPHeaders(HEADERS);
    await page.goto("/dashboard/lyra?userPlan=PRO");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByPlaceholder("Ask about markets, assets, strategies...")).toBeVisible({ timeout: 10000 });
    // Button might have different text on mobile
    if (!isMobile) {
      await expect(page.getByRole("button", { name: "Ask Lyra" })).toBeVisible({ timeout: 5000 });
    }
  });

  test("STARTER page loads with chat input", async ({ page }) => {
    await page.setExtraHTTPHeaders(HEADERS);
    await page.goto("/dashboard/lyra?userPlan=STARTER");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByPlaceholder("Ask about markets, assets, strategies...")).toBeVisible({ timeout: 10000 });
  });

  test("ELITE page loads with chat input", async ({ page }) => {
    await page.setExtraHTTPHeaders(HEADERS);
    await page.goto("/dashboard/lyra?userPlan=ELITE");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByPlaceholder("Ask about markets, assets, strategies...")).toBeVisible({ timeout: 10000 });
  });

  test("ELITE page loads with chat input (second verify)", async ({ page }) => {
    await page.setExtraHTTPHeaders(HEADERS);
    await page.goto("/dashboard/lyra?userPlan=ELITE");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByPlaceholder("Ask about markets, assets, strategies...")).toBeVisible({ timeout: 10000 });
  });
});
