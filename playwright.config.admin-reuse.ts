import { defineConfig, devices } from "@playwright/test";

const E2E_BASE_URL = "http://127.0.0.1:3013";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    extraHTTPHeaders: {
      SKIP_AUTH: "true",
      "x-skip-auth": "true",
      SKIP_RATE_LIMIT: "true",
    },
  },
  timeout: 120 * 1000,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
