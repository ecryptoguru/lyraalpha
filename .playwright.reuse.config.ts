import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3001;
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

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
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    command: `sh -c 'SKIP_AUTH=true SKIP_RATE_LIMIT=true E2E_BYPASS=true npm run build && SKIP_AUTH=true SKIP_RATE_LIMIT=true E2E_BYPASS=true npm run start -- -p ${E2E_PORT}'`,
    url: E2E_BASE_URL,
    reuseExistingServer: true,
    timeout: 120 * 1000,
    env: {
      SKIP_AUTH: "true",
      SKIP_RATE_LIMIT: "true",
      E2E_BYPASS: "true",
    },
  },
});
