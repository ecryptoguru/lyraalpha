import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3001";
const OUTPUT_DIR = path.resolve(process.cwd(), process.env.DEMO_OUTPUT_DIR ?? "demo-output");
const AUTH_STATE_PATH = path.resolve(process.cwd(), process.env.DEMO_STORAGE_STATE ?? "demo-output/auth-state.json");
const VIEWPORT = {
  width: Number(process.env.DEMO_VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.DEMO_VIEWPORT_HEIGHT ?? 900),
};
const VIDEO_SIZE = {
  width: Number(process.env.DEMO_VIDEO_WIDTH ?? VIEWPORT.width),
  height: Number(process.env.DEMO_VIDEO_HEIGHT ?? VIEWPORT.height),
};
const PAGE_ZOOM = process.env.DEMO_PAGE_ZOOM ?? "1";
const BROWSER_CHANNEL = process.env.DEMO_BROWSER_CHANNEL ?? "chrome";
const USE_REAL_AUTH = process.env.DEMO_REAL_AUTH === "true";
const HEADERS = USE_REAL_AUTH
  ? {}
  : {
      SKIP_AUTH: "true",
      "x-skip-auth": "true",
      SKIP_RATE_LIMIT: "true",
    };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LYRA_TRENDING_QUESTION = process.env.DEMO_LYRA_TRENDING_QUESTION ?? "What could surprise markets most from this week";
const DEFAULT_TRANSITION_MS = 350;
const DEMO_PLAN = {
  plan: "ELITE",
  trialEndsAt: null,
  credits: 2840,
};
const DEMO_POINTS = {
  points: {
    credits: 2840,
    xp: 340,
    level: 3,
    tierName: "Beginner",
    tierEmoji: "🌱",
    multiplier: 2,
    progressPercent: 85,
    xpInCurrentLevel: 340,
    xpNeededForNext: 400,
    isMaxLevel: false,
    totalCreditsEarned: 1680,
    referralCreditsEarned: 120,
    weeklyXp: 128,
    streak: 9,
    redemptions: [],
  },
  history: [],
  redemptionOptions: [],
};

const scenes = [
  {
    name: "intro",
    path: "/",
    waitFor: { text: /LyraAlpha AI/i },
    holdMs: 1600,
    action: async (page) => {
      await smoothMouse(page, 220, 190);
      await pause(page, 180);
      await smoothMouse(page, 500, 230);
      await pause(page, 220);
      await smoothScrollToBottom(page, 1800);
      await pause(page, 400);
    },
  },
  {
    name: "overview",
    path: "/dashboard",
    waitFor: { text: /What changed today|Daily Intelligence Feed/i },
    holdMs: 3200,
    action: async (page) => {
      await pause(page, 700);
      await smoothScrollToBottom(page, 1800);
      await pause(page, 500);
    },
  },
  {
    name: "lyra",
    path: "/dashboard/lyra",
    waitFor: { label: "Chat input" },
    holdMs: 5200,
    action: async (page) => {
      await page.addStyleTag({
        content: `
          .animate-marquee,
          .animate-marquee-desktop,
          [class*="animate-marquee"] {
            animation: none !important;
            transform: none !important;
          }
        `,
      }).catch(() => {});

      const firstQuestion = page.getByRole("button", { name: /^>\s+/ }).first();
      await firstQuestion.waitFor({ state: "visible", timeout: 20000 }).catch(() => null);
      await smoothMouse(page, 430, 745);
      await pause(page, 180);
      await firstQuestion.click({ force: true }).catch(async () => {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const target = buttons.find((button) => /^>\s+/.test((button.textContent || "").trim()));
          if (target instanceof HTMLButtonElement) {
            target.click();
          }
        }).catch(() => null);
      });

      await page.getByRole("button", { name: /New Chat/i }).first().waitFor({ timeout: 20000 }).catch(() => null);
      await page.getByRole("tabpanel").first().waitFor({ timeout: 30000 }).catch(() => null);
      await page.getByLabel("Chat input").waitFor({ state: "visible", timeout: 20000 }).catch(() => null);
      await page.waitForFunction(() => {
        const input = document.querySelector('input[aria-label="Chat input"]');
        return Boolean(input && !input.hasAttribute("disabled"));
      }, { timeout: 70000 }).catch(() => null);
      await pause(page, 900);

      const chatScroller = page.locator('.glass-scrollbar').first();
      if (await chatScroller.isVisible().catch(() => false)) {
        await chatScroller.evaluate(async (element) => {
          const step = 220;
          const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
          let currentTop = element.scrollTop;
          while (currentTop < maxTop) {
            currentTop = Math.min(maxTop, currentTop + step);
            element.scrollTop = currentTop;
            await new Promise((resolve) => setTimeout(resolve, 220));
          }
        }).catch(() => {});
      } else {
        await smoothScrollToBottom(page, 2600);
      }

      await pause(page, 500);
      await smoothMouse(page, 860, 390);
      await pause(page, 450);
    },
  },
  {
    name: "learning",
    path: "/dashboard/learning",
    waitFor: { heading: /Learning|Learn/i },
    holdMs: 2200,
    action: async (page) => {
      await pause(page, 600);
      await smoothScrollToBottom(page, 1800);
      await pause(page, 700);
    },
  },
  {
    name: "narratives",
    path: "/dashboard/narratives",
    waitFor: { heading: /Narrative|Market/i },
    holdMs: 2400,
    action: async (page) => {
      await pause(page, 650);
      await smoothScrollTo(page, 560, 1500);
      await page.getByText(/Where headlines and engine signals disagree/i).first().waitFor({ timeout: 12000 }).catch(() => null);
      await smoothMouse(page, 760, 470);
      await pause(page, 700);
      await smoothScrollTo(page, 980, 1400);
      await pause(page, 650);
    },
  },
  {
    name: "discovery",
    path: "/dashboard/discovery",
    waitFor: { heading: /Multibagger Radar|Opportunity/i },
    holdMs: 1900,
    action: async (page) => {
      await pause(page, 600);
      await smoothScrollToBottom(page, 2100);
      await pause(page, 650);
    },
  },
  {
    name: "assets",
    path: "/dashboard/assets",
    waitFor: { heading: /Market Intel|All Assets/i },
    holdMs: 2600,
    action: async (page) => {
      const inTab = page.getByRole("tab", { name: /🇮🇳\s*IN/i }).first();
      await inTab.waitFor({ timeout: 15000 });
      await smoothMouse(page, 1270, 86);
      await pause(page, 220);
      await inTab.click();
      await page.getByPlaceholder(/Search REL, Reliance, Gold/i).waitFor({ timeout: 15000 }).catch(() => null);
      await pause(page, 1100);
      await smoothScrollToBottom(page, 2500);
      await pause(page, 1000);
      await smoothMouse(page, 980, 720);
      await pause(page, 350);
    },
  },
  {
    name: "asset-intel",
    path: "/dashboard/assets/NVDA",
    waitFor: { text: /NVDA|NVIDIA|About NVIDIA Corporation/i },
    holdMs: 3400,
    action: async (page) => {
      await pause(page, 800);
      await smoothMouse(page, 760, 240);
      await pause(page, 320);
      await smoothScrollTo(page, 1320, 2600);
      await page.getByText(/Signal Strength/i).first().waitFor({ timeout: 15000 }).catch(() => null);
      await pause(page, 950);
      await smoothMouse(page, 930, 535);
      await pause(page, 650);
      await smoothMouse(page, 1080, 650);
      await pause(page, 900);
      await smoothScrollTo(page, 1780, 2200);
      await pause(page, 700);
    },
  },
  {
    name: "portfolio",
    path: "/dashboard/portfolio",
    waitFor: { heading: /Portfolio/i },
    holdMs: 2600,
    action: async (page) => {
      await pause(page, 650);
      const tryDemoButton = page.getByRole("button", { name: /Try Demo/i }).first();
      if (await tryDemoButton.isVisible().catch(() => false)) {
        await tryDemoButton.click();
        await pause(page, 1250);
      } else {
        await pause(page, 1250);
      }
      await smoothMouse(page, 450, 365);
      await pause(page, 420);
      await smoothScrollTo(page, 720, 1800);
      await pause(page, 850);
    },
  },
  {
    name: "watchlist",
    path: "/dashboard/watchlist",
    waitFor: { heading: /Watchlist/i },
    holdMs: 2200,
    action: async (page) => {
      await pause(page, 650);
      await smoothMouse(page, 455, 255);
      await pause(page, 350);
      await smoothScrollTo(page, 620, 1600);
      await pause(page, 850);
    },
  },
  {
    name: "compare",
    path: "/dashboard/compare",
    waitFor: { heading: /Comparative Intelligence|Compare/i },
    holdMs: 2600,
    action: async (page) => {
      const inTab = page.getByRole("tab", { name: /🇮🇳\s*IN/i }).first();
      await inTab.waitFor({ timeout: 15000 });
      await smoothMouse(page, 1270, 86);
      await pause(page, 180);
      await inTab.click();

      const compareInput = page.getByPlaceholder(/Search REL, Reliance, Gold/i).first();
      await compareInput.waitFor({ timeout: 15000 });
      await compareInput.fill("RELIANCE.NS");
      await compareInput.press("Enter");
      await pause(page, 500);
      await compareInput.fill("TCS.NS");
      await compareInput.press("Enter");

      const compareButton = page.getByRole("button", { name: /^Compare$/i }).first();
      await compareButton.waitFor({ timeout: 15000 }).catch(() => null);
      await page.waitForFunction(() => {
        const button = Array.from(document.querySelectorAll("button")).find((element) => /^Compare$/i.test((element.textContent || "").trim()));
        return Boolean(button && !(button instanceof HTMLButtonElement ? button.disabled : false));
      }, { timeout: 15000 }).catch(() => null);
      await smoothMouse(page, 565, 330);
      await pause(page, 220);
      await compareButton.click({ force: true }).catch(() => null);

      await page.getByText(/Reliance Industries/i).first().waitFor({ timeout: 30000 }).catch(() => null);
      await page.getByText(/Tata Consultancy Services/i).first().waitFor({ timeout: 30000 }).catch(() => null);
      await page.getByText(/Lyra Executive Brief|Ask Lyra for a focused executive brief/i).first().waitFor({ timeout: 30000 }).catch(() => null);

      await pause(page, 900);
      await smoothScrollToBottom(page, 2200);
      await pause(page, 700);
      await smoothMouse(page, 980, 760);
      await pause(page, 300);
    },
  },
  {
    name: "stress-test",
    path: "/dashboard/stress-test",
    waitFor: { heading: /Stress Test|Shock|Portfolio Stress Test/i },
    holdMs: 2600,
    action: async (page) => {
      await pause(page, 650);

      const techCrashButton = page.getByRole("button", { name: /Tech Bubble Crash/i }).first();
      if (await techCrashButton.isVisible().catch(() => false)) {
        await techCrashButton.click();
        await pause(page, 900);
      }

      const searchInput = page.getByPlaceholder(/Search REL, Reliance, Gold/i).first();
      await searchInput.waitFor({ timeout: 15000 });
      await searchInput.fill("ADANIENT.NS");
      await pause(page, 250);
      await searchInput.press("Enter");
      await page.getByText(/ADANIENT\.NS/i).first().waitFor({ timeout: 15000 }).catch(() => null);
      await pause(page, 500);

      const runButton = page.getByRole("button", { name: /Run Stress Test/i }).first();
      await runButton.waitFor({ timeout: 15000 });
      await runButton.click();

      await page.getByRole("heading", { name: /Scenario Overview/i }).waitFor({ timeout: 30000 }).catch(() => null);
      await page.getByRole("heading", { name: /Selected Asset Replay/i }).waitFor({ timeout: 30000 }).catch(() => null);
      await page.getByRole("heading", { name: /Lyra Hedging Analysis/i }).waitFor({ timeout: 30000 }).catch(() => null);

      await page.waitForFunction(async () => {
        const container = Array.from(document.querySelectorAll("div"))
          .find((element) => element.textContent?.includes("Lyra Hedging Analysis"));
        if (!container) return false;

        const readLength = () => (container.textContent || "").replace(/\s+/g, " ").trim().length;
        const initialLength = readLength();
        if (initialLength < 180) return false;

        await new Promise((resolve) => setTimeout(resolve, 1500));
        const settledLength = readLength();
        return settledLength >= 180 && settledLength === initialLength;
      }, { timeout: 45000 }).catch(() => null);

      await pause(page, 600);
      await smoothScrollToBottom(page, 2200);
      await pause(page, 700);
    },
  },
];

function stamp() {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

async function pause(page, ms) {
  await page.waitForTimeout(ms);
}

async function smoothMouse(page, x, y, steps = 18) {
  await page.mouse.move(x, y, { steps });
}

async function smoothScrollTo(page, top, duration = 1200) {
  await page.evaluate(async ({ top, duration }) => {
    const scroller = document.querySelector("[data-scroll-root]") ?? document.querySelector("main") ?? document.scrollingElement ?? document.documentElement;
    const start = scroller.scrollTop;
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const target = Math.max(0, Math.min(top, maxTop));
    const distance = target - start;
    const startTime = performance.now();

    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    await new Promise((resolve) => {
      const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = easeInOutQuad(progress);
        scroller.scrollTop = start + distance * eased;
        if (progress < 1) {
          requestAnimationFrame(step);
          return;
        }
        resolve();
      };

      requestAnimationFrame(step);
    });
  }, { top, duration });
}

async function smoothScrollToBottom(page, duration = 1800) {
  const bottomTop = await page.evaluate(() => {
    const scroller = document.querySelector("[data-scroll-root]") ?? document.querySelector("main") ?? document.scrollingElement ?? document.documentElement;
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  });
  await smoothScrollTo(page, bottomTop, duration);
}

async function suppressDevOverlays(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-next-badge-root],
      [data-next-mark],
      #nextjs__container,
      [data-nextjs-dialog-overlay],
      [data-nextjs-toast],
      [data-nextjs-dev-tools-button],
      [data-nextjs-dev-tools-backdrop] {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `,
  }).catch(() => {});
}

async function installDemoApiMocks(context) {
  await context.route("**/api/user/plan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEMO_PLAN),
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  });

  await context.route("**/api/points", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEMO_POINTS),
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  });
}

async function waitForScene(page, scene) {
  if (scene.waitFor?.label) {
    await page.getByLabel(scene.waitFor.label).waitFor({ timeout: 15000 });
    return;
  }

  if (scene.waitFor?.heading) {
    await page.getByRole("heading").filter({ hasText: scene.waitFor.heading }).first().waitFor({ timeout: 15000 }).catch(async () => {
      await page.locator("h1").first().waitFor({ timeout: 10000 });
    });
    return;
  }

  if (scene.waitFor?.text) {
    await page.getByText(scene.waitFor.text).first().waitFor({ timeout: 15000 }).catch(async () => {
      await page.locator("main").waitFor({ timeout: 10000 });
    });
    return;
  }

  await page.locator("main").waitFor({ timeout: 10000 });
}

async function gotoScene(page, scene) {
  const url = new URL(scene.path, BASE_URL).toString();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await suppressDevOverlays(page);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await waitForScene(page, scene);
}

async function main() {
  const timestamp = stamp();
  const videoDir = path.join(OUTPUT_DIR, "videos", timestamp);
  const screenshotDir = path.join(OUTPUT_DIR, "stills", timestamp);

  await mkdir(videoDir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    channel: USE_REAL_AUTH ? BROWSER_CHANNEL : undefined,
    headless: process.env.DEMO_HEADLESS === "true",
    slowMo: Number(process.env.DEMO_SLOW_MO ?? 0),
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    screen: VIEWPORT,
    recordVideo: {
      dir: videoDir,
      size: VIDEO_SIZE,
    },
    colorScheme: "dark",
    extraHTTPHeaders: HEADERS,
    storageState: USE_REAL_AUTH ? AUTH_STATE_PATH : undefined,
  });

  if (!USE_REAL_AUTH) {
    await installDemoApiMocks(context);
  }

  await context.addInitScript((zoom) => {
    window.localStorage.setItem("onboarding:completed:v1", "1");
    window.localStorage.setItem("theme", "dark");
    window.localStorage.setItem("skip-auth-bypass", "true");
    document.documentElement.style.zoom = zoom;
  }, PAGE_ZOOM);

  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);

  for (const scene of scenes) {
    await gotoScene(page, scene);
    await scene.action(page);
    if (scene.holdMs) {
      await pause(page, scene.holdMs);
    }
    await pause(page, DEFAULT_TRANSITION_MS);
  }

  await pause(page, 500);
  await context.close();
  await browser.close();

  console.log(`Demo capture complete.`);
  console.log(`Video directory: ${videoDir}`);
  console.log(`Still frames: ${screenshotDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
