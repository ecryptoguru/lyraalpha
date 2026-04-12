import { test, expect } from "@playwright/test";

const ADMIN = "/admin";

// Helper: navigate and wait for page to hydrate
async function gotoAdmin(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${ADMIN}${path}`, { waitUntil: "networkidle", timeout: 30000 });
  // Wait for content to appear (not just loader)
  await page.waitForTimeout(2000);
}

test.describe("Admin Crypto Overhaul", () => {
  // ─── API Routes ──────────────────────────────────────────────────────────

  test("/api/admin/crypto-data returns valid JSON", async ({ request }) => {
    const res = await request.get("/api/admin/crypto-data");
    // May be 401 if not admin-auth'd; that's OK — route exists and doesn't 500
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("coingecko");
      expect(body).toHaveProperty("newsdata");
      expect(body).toHaveProperty("geckoTerminal");
      expect(body).toHaveProperty("defiLlama");
      expect(body).toHaveProperty("coinglass");
      expect(body).toHaveProperty("messari");
      expect(body).toHaveProperty("marketRegime");
      expect(body).toHaveProperty("priceFreshness");
      expect(body.coingecko).toHaveProperty("totalAssets");
      expect(body.coingecko).toHaveProperty("freshCount");
      expect(body.coingecko).toHaveProperty("staleCount");
      expect(body.newsdata).toHaveProperty("events24h");
      expect(body.newsdata).toHaveProperty("events7d");
      expect(body.marketRegime).toHaveProperty("cryptoBenchmarks");
    }
  });

  test("/api/admin/engines returns cryptoIntelligenceStats", async ({ request }) => {
    const res = await request.get("/api/admin/engines");
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("cryptoIntelligenceStats");
      // cryptoIntelligenceStats can be null if no data, but key must exist
      if (body.cryptoIntelligenceStats) {
        expect(body.cryptoIntelligenceStats).toHaveProperty("avgNetworkActivity");
        expect(body.cryptoIntelligenceStats).toHaveProperty("avgHolderStability");
        expect(body.cryptoIntelligenceStats).toHaveProperty("avgLiquidityRisk");
        expect(body.cryptoIntelligenceStats).toHaveProperty("avgEnhancedTrust");
        expect(body.cryptoIntelligenceStats).toHaveProperty("signalWeightBreakdown");
        expect(body.cryptoIntelligenceStats).toHaveProperty("assetsWithCryptoIntel");
        expect(body.cryptoIntelligenceStats).toHaveProperty("totalCryptoAssets");
      }
    }
  });

  test("/api/admin/infrastructure returns cryptoSyncHealth", async ({ request }) => {
    const res = await request.get("/api/admin/infrastructure");
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("cryptoSyncHealth");
      if (body.cryptoSyncHealth) {
        expect(body.cryptoSyncHealth).toHaveProperty("lastCoinGeckoSync");
        expect(body.cryptoSyncHealth).toHaveProperty("lastNewsDataSync");
        expect(body.cryptoSyncHealth).toHaveProperty("lastCoinGeckoSyncAgeH");
        expect(body.cryptoSyncHealth).toHaveProperty("lastNewsDataSyncAgeH");
        expect(body.cryptoSyncHealth).toHaveProperty("pctAssetsFresh");
        expect(body.cryptoSyncHealth).toHaveProperty("totalCryptoAssets");
        expect(body.cryptoSyncHealth).toHaveProperty("freshAssetCount");
        expect(body.cryptoSyncHealth).toHaveProperty("staleAssetCount");
      }
    }
  });

  // ─── UI: Navigation ──────────────────────────────────────────────────────

  test("Admin nav includes Crypto Data link", async ({ page }) => {
    await gotoAdmin(page, "");
    const navLinks = page.locator("nav a, aside a");
    const cryptoDataLink = navLinks.filter({ hasText: "Crypto Data" });
    await expect(cryptoDataLink).toBeVisible({ timeout: 10000 });
    const href = await cryptoDataLink.first().getAttribute("href");
    expect(href).toContain("/admin/crypto-data");
  });

  // ─── UI: Overview Page Labels ────────────────────────────────────────────

  test("Overview page shows 'Crypto Assets Tracked'", async ({ page }) => {
    await gotoAdmin(page, "");
    const label = page.locator("text=Crypto Assets Tracked").first();
    await expect(label).toBeVisible({ timeout: 10000 });
  });

  // ─── UI: Engines & Regime — Crypto Intel Tab ─────────────────────────────

  test("Engines & Regime page has Crypto Intel tab", async ({ page }) => {
    await gotoAdmin(page, "/engines-regime");
    const tabButton = page.locator("button", { hasText: "Crypto Intel" });
    await expect(tabButton).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Intel tab shows intelligence content when clicked", async ({ page }) => {
    await gotoAdmin(page, "/engines-regime");
    const tabButton = page.locator("button", { hasText: "Crypto Intel" });
    await tabButton.click();
    await page.waitForTimeout(1000);
    // Should show either the data cards or the empty state
    const content = page.locator("text=Crypto Intelligence Score Averages, text=No crypto intelligence data available yet").first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("Engines & Regime shows 'Volatility Score' label (not VIX Value)", async ({ page }) => {
    await gotoAdmin(page, "/engines-regime");
    // Switch to Regime tab
    const regimeTab = page.locator("button", { hasText: "Regime" });
    await regimeTab.click();
    await page.waitForTimeout(1000);
    const volLabel = page.locator("text=Volatility Score").first();
    await expect(volLabel).toBeVisible({ timeout: 10000 });
    // Old label should NOT be present
    const vixLabel = page.locator("text=VIX Value").first();
    await expect(vixLabel).not.toBeVisible();
  });

  test("Engines & Regime shows 'Cross-Asset Correlation' (not Cross-Sector)", async ({ page }) => {
    await gotoAdmin(page, "/engines-regime");
    const regimeTab = page.locator("button", { hasText: "Regime" });
    await regimeTab.click();
    await page.waitForTimeout(1000);
    const crossAsset = page.locator("text=Cross-Asset Correlation").first();
    await expect(crossAsset).toBeVisible({ timeout: 10000 });
    const crossSector = page.locator("text=Cross-Sector Correlation").first();
    await expect(crossSector).not.toBeVisible();
  });

  // ─── UI: Infrastructure — Crypto Sync Health ─────────────────────────────

  test("Infrastructure page shows Crypto Data Sync Health section", async ({ page }) => {
    await gotoAdmin(page, "/infrastructure");
    const section = page.locator("text=Crypto Data Sync Health").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("Infrastructure page shows CoinGecko Last Sync metric", async ({ page }) => {
    await gotoAdmin(page, "/infrastructure");
    const metric = page.locator("text=CoinGecko Last Sync").first();
    await expect(metric).toBeVisible({ timeout: 10000 });
  });

  test("Infrastructure page shows Freshness % metric", async ({ page }) => {
    await gotoAdmin(page, "/infrastructure");
    const metric = page.locator("text=Freshness %").first();
    await expect(metric).toBeVisible({ timeout: 10000 });
  });

  // ─── UI: Crypto Data Page ────────────────────────────────────────────────

  test("Crypto Data page renders and shows title", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const title = page.locator("text=Crypto Data Sources").first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows CoinGecko source card", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const card = page.locator("text=CoinGecko").first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows NewsData.io source card", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const card = page.locator("text=NewsData.io").first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows GeckoTerminal source card", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const card = page.locator("text=GeckoTerminal").first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows DefiLlama source card", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const card = page.locator("text=DefiLlama").first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows Coinglass source card", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const card = page.locator("text=Coinglass").first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows Messari source card", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const card = page.locator("text=Messari").first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows CoinGecko Coverage Breakdown", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const section = page.locator("text=CoinGecko Coverage Breakdown").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows Crypto News Feed Health", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const section = page.locator("text=Crypto News Feed Health").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows Market Regime Health", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const section = page.locator("text=Market Regime Health").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("Crypto Data page shows Price Freshness chart", async ({ page }) => {
    await gotoAdmin(page, "/crypto-data");
    const section = page.locator("text=Price History Freshness").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  // ─── UI: Usage Page Label ────────────────────────────────────────────────

  test("Usage page shows 'User Region Preference'", async ({ page }) => {
    await gotoAdmin(page, "/usage");
    const label = page.locator("text=User Region Preference").first();
    await expect(label).toBeVisible({ timeout: 10000 });
  });
});
