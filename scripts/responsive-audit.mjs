import { chromium } from "playwright";

const base = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3003";
// Excluding admin routes per user request
const routes = [
  "/", "/contact", "/privacy", "/terms", "/tools",
  "/dashboard", "/dashboard/portfolio", "/dashboard/narratives",
  "/dashboard/discovery", "/dashboard/assets", "/dashboard/timeline"
];

const viewports = [
  { name: "iphone13", width: 390, height: 844 },
  { name: "android", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-skip-auth": "true", "SKIP_AUTH": "true" }
  });
  const page = await context.newPage();
  
  const failures = [];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    
    for (const route of routes) {
      try {
        await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForTimeout(2000);
        
        const data = await page.evaluate(() => {
          const viewportWidth = window.innerWidth;
          const bodyScrollWidth = document.body.scrollWidth;
          const docScrollWidth = document.documentElement.scrollWidth;
          const actualWidth = Math.max(bodyScrollWidth, docScrollWidth);
          const horizontalOverflow = actualWidth - viewportWidth;
          
          let maxRight = 0;
          let minLeft = 0;
          const overflowNodes = [];
          const all = Array.from(document.querySelectorAll("body *"));
          
          for (const el of all) {
            if (!(el instanceof HTMLElement)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            
            if (rect.right > maxRight) maxRight = rect.right;
            if (rect.left < minLeft) minLeft = rect.left;
            
            if (rect.right - viewportWidth > 5 || rect.left < -5) {
              overflowNodes.push({
                tag: el.tagName.toLowerCase(),
                cls: el.className?.toString().slice(0, 80) ?? "",
                right: Math.round(rect.right),
                width: Math.round(rect.width)
              });
            }
          }

          // Small touch targets (Apple HIG suggests 44x44, we check for < 38)
          // Excluding internal sidebar rail as it's a specialized hit area
          const touchIssues = [];
          for (const el of document.querySelectorAll('button:not([data-sidebar="rail"]), a[href], [role="button"]:not([data-sidebar="rail"]), [role="tab"]')) {
            if (!(el instanceof HTMLElement)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && (rect.width < 38 || rect.height < 38)) {
              touchIssues.push({
                tag: el.tagName.toLowerCase(),
                cls: el.className?.toString().slice(0, 50) ?? "",
                text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              });
            }
          }
          
          return {
            horizontalOverflow: horizontalOverflow > 5 ? horizontalOverflow : 0,
            overflowNodes: overflowNodes.slice(0, 3),
            touchIssues: touchIssues.slice(0, 5)
          };
        });
        
        if (data.horizontalOverflow > 0 || data.touchIssues.length > 0) {
          failures.push({
            viewport: viewport.name,
            route,
            overflow: data.horizontalOverflow,
            issues: data.overflowNodes,
            touchIssues: data.touchIssues
          });
        }
        
      } catch (e) {
        console.error(`Error on ${route}:`, e.message);
      }
    }
  }
  
  await browser.close();
  console.log(JSON.stringify(failures, null, 2));
})();
