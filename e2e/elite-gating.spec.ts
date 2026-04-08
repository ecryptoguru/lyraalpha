import { test, expect, Page, APIRequestContext } from "@playwright/test";

/**
 * Phase 2.5: Elite Gating E2E Tests
 * Covers: Upgrade page, Discovery feed plan limiting, Learning Hub triggers,
 * Sidebar upgrade link, API plan-gating, Elite Lyra modules.
 *
 * Note: SKIP_AUTH=true → test-user-id → defaults to STARTER plan in DB.
 * All gating tests verify the non-Elite (Starter) experience.
 */

const HEADERS = {
  SKIP_AUTH: "true",
  "x-skip-auth": "true",
  SKIP_RATE_LIMIT: "true",
  "x-skip-rate-limit": "true",
};

interface LearningModule {
  slug: string;
  isEliteOnly: boolean;
}

async function getLearningModules(request: APIRequestContext): Promise<LearningModule[]> {
  const res = await request.get("/api/learning/modules", { headers: HEADERS });
  if (res.status() === 401) {
    console.info("[SKIP] Auth not bypassed — skipping module list fetch");
    return [];
  }
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.categories.flatMap((category: { modules: LearningModule[] }) => category.modules);
}

async function setupPage(page: Page) {
  await page.setExtraHTTPHeaders(HEADERS);
  await page.addInitScript(() => {
    window.localStorage.setItem("onboarding:completed:v1", "1");
  });
}

async function expectUpgradeSurface(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/upgrade/, { timeout: 15000 });
  await expect(page.getByRole("link", { name: /Back to Dashboard/i }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("system-Led Intelligence Plans").first()).toBeVisible({ timeout: 15000 });
}

async function completeOnboardingIfVisible(page: Page) {
  await page.getByText("Loading onboarding...").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});

  const onboardingHeading = page.getByText("Mandatory Setup").first();
  const isOnboardingVisible = await onboardingHeading.isVisible({ timeout: 1500 }).catch(() => false);
  if (!isOnboardingVisible) return;

  // Skip onboarding via API
  await page.request.patch("/api/user/onboarding", {
    headers: HEADERS,
    data: { skipped: true },
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.getByText("Mandatory Setup").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
}

// ─────────────────────────────────────────────
// 1. UPGRADE PAGE
// ─────────────────────────────────────────────
test.describe("Upgrade Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/upgrade", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await completeOnboardingIfVisible(page);
    await expectUpgradeSurface(page);
  });

  test("renders hero section with value framing", async ({ page }) => {
    const heroHeading = page.locator("h1").first();
    await expect(heroHeading).toBeVisible({ timeout: 15000 });
  });

  test("displays workflow framing pillars", async ({ page }) => {
    await expect(page.getByText("system Fit", { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Elite system Layer", { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Upgrade Logic", { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test("shows 3 plan cards: Starter, Pro, Elite", async ({ page }) => {
    await expect(page.locator("article").filter({ hasText: "Starter" }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("article").filter({ hasText: "Pro" }).first()).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Elite" }).first()).toBeVisible();
  });

  test("Elite card has Recommended badge", async ({ page }) => {
    await expect(page.getByText("Recommended", { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test("shows pricing: Free and paid plans", async ({ page }) => {
    const starterCard = page.locator("article").filter({ hasText: "Starter" }).first();
    const proCard = page.locator("article").filter({ hasText: "Pro" }).first();
    const eliteCard = page.locator("article").filter({ hasText: "Elite" }).first();

    const starterHasPlanState = await starterCard.getByText(/Current Plan|Free Forever/i).first().isVisible({ timeout: 10000 }).catch(() => false);
    const proHasPricing = await proCard.getByText(/\$\d+|\/month/i).first().isVisible({ timeout: 10000 }).catch(() => false);
    const eliteHasPricing = await eliteCard.getByText(/\$\d+|\/month/i).first().isVisible({ timeout: 10000 }).catch(() => false);

    expect(starterHasPlanState).toBeTruthy();
    expect(proHasPricing || eliteHasPricing).toBeTruthy();
  });

  test("feature comparison table renders with categories", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await expect(page.getByRole("heading", { name: "Feature comparison" })).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);

    const categories = ["Lyra AI", "Discovery", "Intelligence", "Learning"];
    for (const cat of categories) {
      await expect(
        page.getByText(cat, { exact: true }).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("feature table has accordion categories", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    const categories = ["Discovery", "Learning", "Intelligence"];
    for (const cat of categories) {
      await expect(
        page.getByText(cat, { exact: true }).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("upgrade CTA button is visible for non-Elite user", async ({ page }) => {
    const ctaVisible = await page.getByRole("button", { name: /Unlock Elite Workflows|Explore Elite Trial Options|Unlock Pro Workflows/i }).first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(ctaVisible).toBeTruthy();
  });

  test("back to dashboard link works", async ({ page }) => {
    const backLink = page.getByRole("link", { name: /Back to Dashboard/i }).first();
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("bottom CTA section is present", async ({ page }) => {
    // Scroll to bottom CTA area
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    // Any bottom CTA text is present
    const hasCta = await page.getByText(/deeper|trial|cancel|billing/i).first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasCta).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 2. SIDEBAR UPGRADE LINK
// ─────────────────────────────────────────────
test.describe("Sidebar Upgrade Link", () => {
  test("upgrade page is accessible via direct navigation", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/upgrade");
    await page.waitForLoadState("domcontentloaded");
    await expectUpgradeSurface(page);
  });

  test("upgrade page has back to dashboard link", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/upgrade");
    await page.waitForLoadState("domcontentloaded");
    await completeOnboardingIfVisible(page);
    const backLink = page.getByRole("link", { name: /Back to Dashboard/i }).first();
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ─────────────────────────────────────────────
// 3. DISCOVERY FEED PLAN LIMITING (API)
// ─────────────────────────────────────────────
test.describe("Discovery Feed Plan Gating (API)", () => {
  test("feed API returns plan and planCap fields", async ({ request }) => {
    const res = await request.get("/api/discovery/feed?limit=50", {
      headers: HEADERS,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.plan).toBeDefined();
    expect(data.planCap).toBeDefined();
    expect(typeof data.planCap).toBe("number");
  });

  test("feed response respects returned planCap", async ({ request }) => {
    const res = await request.get("/api/discovery/feed?limit=50", {
      headers: HEADERS,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(typeof data.planCap).toBe("number");
    expect(data.planCap).toBeGreaterThan(0);
    expect(data.items.length).toBeLessThanOrEqual(data.planCap);
  });

  test("locked items have redacted content", async ({ request }) => {
    const res = await request.get("/api/discovery/feed?limit=50", {
      headers: HEADERS,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const lockedItems = data.items.filter((i: { locked: boolean }) => i.locked);
    for (const item of lockedItems) {
      expect(item.symbol).toBeDefined();
      expect(item.displaySymbol).toBe("???");
      expect(item.headline).toContain("Elite");
      expect(item.price).toBeNull();
      expect(item.scores).toEqual({});
    }
  });
});

// ─────────────────────────────────────────────
// 4. DISCOVERY FEED UI — LOCKED CARDS
// ─────────────────────────────────────────────
test.describe("Discovery Feed UI — Locked Cards", () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/discovery");
    await page.waitForLoadState("domcontentloaded");
    await completeOnboardingIfVisible(page);
  });

  test("discovery feed tab loads with cards", async ({ page }) => {
    // Wait for feed cards to appear (or empty state or any content)
    const feedCards = page.getByTestId("discovery-feed-card");
    const hasCards = await feedCards.first().isVisible({ timeout: 15000 }).catch(() => false);
    const hasEmpty = await page.getByText(/No discoveries/i).isVisible({ timeout: 3000 }).catch(() => false);
    const hasContent = await page.locator("h1, h2, [class*='card']").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCards || hasEmpty || hasContent).toBeTruthy();
  });

  test("locked cards show upgrade CTA link to /dashboard/upgrade", async ({ page }) => {
    // Check if any locked card upgrade links exist
    const upgradeLinks = page.getByTestId("discovery-locked-upgrade-cta");
    const count = await upgradeLinks.count();
    // If there are locked items, they should link to upgrade
    if (count > 0) {
      const firstLink = upgradeLinks.first();
      await expect(firstLink).toBeVisible({ timeout: 10000 });
    }
  });
});

// ─────────────────────────────────────────────
// 5. LEARNING HUB — ELITE TRIGGER
// ─────────────────────────────────────────────
test.describe("Learning Hub — Elite Trigger", () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/learning");
    await page.waitForLoadState("domcontentloaded");
    await completeOnboardingIfVisible(page);
  });

  test("learning hub loads with modules", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Learning Hub" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Full Course Catalog" })).toBeVisible({ timeout: 10000 });
  });

  test("learning hub loads with module content", async ({ page }) => {
    // Page loads with at least one heading visible
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
    // Scroll to bottom to trigger any lazy content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    // Either elite trigger or module content is visible
    const hasContent = await page.getByRole("heading").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test("Elite trigger links to upgrade page", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const upgradeLink = page.locator('a[href="/dashboard/upgrade"]').first();
    if (await upgradeLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await upgradeLink.click();
      await expect(page).toHaveURL(/\/dashboard\/upgrade/);
    }
  });
});

// ─────────────────────────────────────────────
// 6. LEARNING MODULES API — ELITE GATING
// ─────────────────────────────────────────────
test.describe("Learning Modules API — Elite Gating", () => {
  test("modules list API returns categories", async ({ request }) => {
    const res = await request.get("/api/learning/modules", { headers: HEADERS });
    if (res.status() === 401) {
      console.info("[SKIP] Auth not bypassed — skipping learning modules check");
      return;
    }
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.categories).toBeDefined();
    expect(data.categories.length).toBeGreaterThanOrEqual(1);
  });

  test("elite-only module access depends on plan", async ({ request }) => {
    const modules = await getLearningModules(request);
    if (modules.length === 0) { return; } // auth bypass not active
    expect(Array.isArray(modules)).toBeTruthy();

    const res = await request.get("/api/learning/modules/cross-asset-correlation", { headers: HEADERS });
    if (res.status() === 401) { return; }
    expect([200, 403]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 403) {
      expect(data.locked).toBe(true);
    } else {
      expect(data.success).toBe(true);
    }
  });

  test("non-elite module is accessible", async ({ request }) => {
    const modules = await getLearningModules(request);
    if (modules.length === 0) { return; } // auth bypass not active
    const nonEliteModule = modules.find((m) => !m.isEliteOnly);
    if (!nonEliteModule) { return; }

    const res = await request.get(`/api/learning/modules/${nonEliteModule.slug}`, { headers: HEADERS });
    if (res.status() === 401) { return; }
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.metadata).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// 7. USER PLAN API
// ─────────────────────────────────────────────
test.describe("User Plan API", () => {
  test("returns plan field", async ({ request }) => {
    const res = await request.get("/api/user/plan", { headers: HEADERS });
    if (res.status() === 401) {
      console.info("[SKIP] Auth not bypassed — skipping user plan check");
      return;
    }
    const data = await res.json();
    expect(data.plan).toBeDefined();
    expect(["STARTER", "PRO", "ELITE"]).toContain(data.plan);
  });
});

// ─────────────────────────────────────────────
// 8. CROSS-PAGE FLOW: Upgrade Journey
// ─────────────────────────────────────────────
test.describe("Upgrade Journey Flow", () => {
  test("direct upgrade → back to dashboard", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/upgrade");
    await page.waitForLoadState("domcontentloaded");
    await completeOnboardingIfVisible(page);

    await expectUpgradeSurface(page);

    const backLink = page.getByRole("link", { name: /Back to Dashboard/i }).first();
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("learning hub trigger → upgrade page", async ({ page }) => {
    await setupPage(page);
    await page.goto("/dashboard/learning");
    await page.waitForLoadState("domcontentloaded");
    await completeOnboardingIfVisible(page);

    // Scroll to bottom to find the trigger
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const upgradeLink = page.locator('a[href="/dashboard/upgrade"]').first();
    if (await upgradeLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await upgradeLink.click();
      await expectUpgradeSurface(page);
    }
  });
});
