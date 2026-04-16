import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Public Myra Widget on the landing page.
 * Verifies that the MYRA chat widget matches the dashboard experience.
 */

test.describe("Landing Page MYRA Widget", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the landing page
    await page.goto("/");
    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");
  });

  test("launcher button is visible and clickable", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await expect(launcher).toBeVisible();
    await expect(launcher).toBeEnabled();
  });

  test("clicking launcher opens the chat widget", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Verify the chat panel opens
    const panel = page.locator("[class*='rounded-4xl']").filter({ has: page.getByText("Myra") }).first();
    await expect(panel).toBeVisible();

    // Verify header elements
    await expect(page.getByText("Myra").first()).toBeVisible();
    await expect(page.getByText("AI").first()).toBeVisible();
    await expect(page.getByText(/online/i).first()).toBeVisible();
  });

  test("chat widget displays welcome message and quick replies", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Verify welcome content
    await expect(page.getByText(/Hi! I am Myra/i)).toBeVisible();
    await expect(page.getByText(/How may I help you today/i)).toBeVisible();

    // Verify quick replies are displayed
    await expect(page.getByText("What is LyraAlpha AI?")).toBeVisible();
    await expect(page.getByText("How does ELITE Beta work?")).toBeVisible();
    await expect(page.getByText("What are the 300 credits for?")).toBeVisible();
    await expect(page.getByText("What assets are covered?")).toBeVisible();
  });

  test("quick reply sends message and displays response", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Mock the API response
    await page.route("**/api/support/public-chat", async (route) => {
      const json = { content: "LyraAlpha AI is an advanced crypto analytics platform." };
      await route.fulfill({ 
        json,
        body: "LyraAlpha AI is an advanced crypto analytics platform."
      });
    });

    // Click a quick reply
    await page.getByText("What is LyraAlpha AI?").click();

    // Verify user message appears
    await expect(page.getByText("What is LyraAlpha AI?").locator("visible=true").first()).toBeVisible();

    // Verify typing indicator or response appears
    await expect(page.getByText(/Myra is typing|LyraAlpha AI is/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("user can type and send a message", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Mock the API response
    await page.route("**/api/support/public-chat", async (route) => {
      await route.fulfill({ 
        body: "Thanks for your message! Here's more info about ELITE access."
      });
    });

    // Type a message
    const input = page.getByPlaceholder(/ask about beta access/i);
    await expect(input).toBeVisible();
    await input.fill("Tell me about ELITE");
    await input.press("Enter");

    // Verify user message appears
    await expect(page.getByText("Tell me about ELITE")).toBeVisible();
  });

  test("minimize button collapses the widget", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Click minimize button (Minus icon)
    const minimizeButton = page.getByRole("button", { name: /minimise/i });
    await minimizeButton.click();

    // Widget should be minimized - launcher should be visible again
    await expect(launcher).toBeVisible();
  });

  test("close button closes the widget", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Click close button (X icon)
    const closeButton = page.getByRole("button", { name: /close/i });
    await closeButton.click();

    // Launcher should be visible again
    await expect(launcher).toBeVisible();
  });

  test("widget has correct visual styling matching dashboard", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Verify key UI elements exist with correct structure (amber brand scheme)
    await expect(page.locator("[class*='bg-amber-50']").first()).toBeVisible();
    await expect(page.locator("[class*='border-amber-300']").first()).toBeVisible();
    
    // Verify Sparkles icon is present
    await expect(page.locator("svg[class*='lucide-sparkles']").first()).toBeVisible();
  });

  test("status bar shows sign-up CTA", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Check for sign-up link in status bar
    const signUpLink = page.getByRole("link", { name: /sign up free/i });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute("href", "/sign-up");
  });

  test("widget footer shows credit info", async ({ page }) => {
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();

    // Check for credit info in footer
    await expect(page.getByText(/300 credits/i)).toBeVisible();
  });

  test("reopening widget preserves message history in session", async ({ page }) => {
    // Mock API response
    await page.route("**/api/support/public-chat", async (route) => {
      await route.fulfill({ body: "Here's info about our Beta program!" });
    });

    // Open widget and send message
    const launcher = page.getByRole("button", { name: /chat with myra/i });
    await launcher.click();
    
    await page.getByText("What is LyraAlpha AI?").click();
    
    // Wait for message to appear
    await expect(page.getByText("What is LyraAlpha AI?").first()).toBeVisible();

    // Minimize
    await page.getByRole("button", { name: /minimise/i }).click();

    // Reopen
    await launcher.click();

    // Previous message should still be visible
    await expect(page.getByText("What is LyraAlpha AI?").first()).toBeVisible();
  });
});
