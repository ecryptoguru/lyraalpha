import { test, expect } from "@playwright/test";

test("landing page loads with workflow-led funnel content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/LyraAlpha AI/);

  await expect(page.getByRole("link", { name: /LyraAlpha AI/i }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /Join Waitlist/i }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("group", { name: /Theme preference/i }).first()).toBeVisible({ timeout: 10000 });

  await expect(page.getByText(/Priority path/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Join waitlist/i).first()).toBeVisible({ timeout: 10000 });

  const workflowHeading = page.getByRole("heading", { name: /Start from the tool that matches your question/i }).first();
  await workflowHeading.scrollIntoViewIfNeeded();
  await expect(workflowHeading).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("AI Portfolio Analyzer").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Market Narrative Tracker").first()).toBeVisible({ timeout: 10000 });
});
