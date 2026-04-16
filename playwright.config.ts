import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3001;
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
const isCI = Boolean(process.env.CI);
const defaultReporter = isCI ? "html" : "list";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.PLAYWRIGHT_REPORTER ?? defaultReporter,
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
    // LYRA_E2E_USER_PLAN=ELITE tells `src/lib/auth.ts` to seed the bypass userId with
    // a real ELITE user from the DB so plan-gated surfaces (compare, stress-test,
    // elite-gating) continue to work in E2E. Without this env, bypass falls back to
    // the `test-user-id` sentinel — safe default for non-Vercel deploys.
    command: `sh -c 'SKIP_AUTH=true SKIP_RATE_LIMIT=true E2E_BYPASS=true LYRA_E2E_USER_PLAN=ELITE npm run build && SKIP_AUTH=true SKIP_RATE_LIMIT=true E2E_BYPASS=true LYRA_E2E_USER_PLAN=ELITE npm run start -- -p ${E2E_PORT}'`,
    url: E2E_BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
    env: {
      SKIP_AUTH: "true",
      SKIP_RATE_LIMIT: "true",
      E2E_BYPASS: "true",
      LYRA_E2E_USER_PLAN: "ELITE",
    },
  },
});
