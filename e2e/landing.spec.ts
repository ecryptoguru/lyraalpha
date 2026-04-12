import { test, expect } from "@playwright/test";

test("root redirects to the dashboard entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/);

  await expect(page.getByText(/Where to go next/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Daily Briefing/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Crypto Intel/i).first()).toBeVisible({ timeout: 10000 });
});
