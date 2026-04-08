import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), process.env.DEMO_OUTPUT_DIR ?? "demo-output");
const AUTH_PROFILE_DIR = path.resolve(process.cwd(), process.env.DEMO_USER_DATA_DIR ?? "demo-output/auth-profile");
const VIEWPORT = { width: 1280, height: 800 };
const PAGE_ZOOM = process.env.DEMO_PAGE_ZOOM ?? "1.1";
const BROWSER_CHANNEL = process.env.DEMO_BROWSER_CHANNEL ?? "chrome";

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(AUTH_PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(AUTH_PROFILE_DIR, {
    channel: BROWSER_CHANNEL,
    headless: false,
    viewport: VIEWPORT,
    screen: VIEWPORT,
    colorScheme: "dark",
  });

  await context.addInitScript((zoom) => {
    window.localStorage.setItem("theme", "dark");
    document.documentElement.style.zoom = zoom;
  }, PAGE_ZOOM);

  const page = context.pages()[0] ?? await context.newPage();
  await page.setViewportSize(VIEWPORT);
  await page.goto(new URL("/dashboard/lyra", BASE_URL).toString(), { waitUntil: "domcontentloaded" });

  console.log("Admin login window opened.");
  console.log(`Profile directory: ${AUTH_PROFILE_DIR}`);
  console.log("Sign in manually in the visible browser window, then close the browser when finished.");

  await new Promise((resolve) => {
    context.on("close", resolve);
  });

  console.log("Login browser closed. Saved authenticated profile is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
