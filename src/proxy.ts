import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { getConfiguredAppUrl, isAuthBypassEnabled, isAuthBypassHeaderEnabled } from "@/lib/runtime-env";
import { rateLimitAuthBypass } from "@/lib/rate-limit";

const isPublicApiRoute = createRouteMatcher([
  "/api/share(.*)",
  "/api/waitlist(.*)",
  "/api/clerk-js",
  "/clerk-js(.*)",
  "/api/support/public-chat",
  "/api/market/public-ticker",
]);

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/((?!cron|webhooks|newsletter|stripe-credits|market).*)",
  "/trpc(.*)",
]);

const isApiRoute = createRouteMatcher(["/api(.*)"]);

const REFERRAL_COOKIE_NAME = "referral_code";
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function setReferralCookie(res: NextResponse, refCode: string) {
  res.cookies.set(REFERRAL_COOKIE_NAME, refCode, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
  });
}

// Allowed origins for CORS — restrict in production
const configuredAppUrl = getConfiguredAppUrl();
const ALLOWED_ORIGINS = new Set(
  [
    ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:3001"]),
    ...(configuredAppUrl ? [configuredAppUrl] : []),
  ]
);

// Wildcard subdomain patterns for preview deploys
const ALLOWED_ORIGIN_PATTERNS = [
  /\.vercel\.app$/,
  /\.lyraalpha\.com$/,
  /\.lyraalpha\.ai$/,
];

/**
 * Check if origin matches allowed patterns (exact or wildcard subdomain)
 */
function isAllowedOrigin(origin: string): boolean {
  // Exact match first
  if (ALLOWED_ORIGINS.has(origin)) return true;
  
  // Check wildcard subdomain patterns
  try {
    const hostname = new URL(origin).hostname;
    return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(hostname));
  } catch {
    return false;
  }
}

function getNormalizedLocalDevUrl(req: NextRequest): URL | null {
  if (process.env.NODE_ENV === "production" || !configuredAppUrl) {
    return null;
  }

  const requestUrl = new URL(req.url);
  const appUrl = new URL(configuredAppUrl);
  const requestHost = requestUrl.hostname;
  const appHost = appUrl.hostname;
  const isLocalAliasPair =
    (requestHost === "127.0.0.1" && appHost === "localhost")
    || (requestHost === "localhost" && appHost === "127.0.0.1");

  if (!isLocalAliasPair || requestUrl.port !== appUrl.port) {
    return null;
  }

  requestUrl.protocol = appUrl.protocol;
  requestUrl.hostname = appUrl.hostname;
  requestUrl.port = appUrl.port;
  return requestUrl;
}

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

// Next.js 16 renamed `middleware.ts` → `proxy.ts` and recommends the
// exported function be named `proxy`, even when using a default export.
// See: https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy
export const proxy = clerkMiddleware(async (auth, req: NextRequest) => {
  const normalizedLocalDevUrl = getNormalizedLocalDevUrl(req);
  if (normalizedLocalDevUrl) {
    return NextResponse.redirect(normalizedLocalDevUrl);
  }

  if (req.nextUrl.pathname === "/") {
    const refCode = req.nextUrl.searchParams.get("ref");
    if (refCode) {
      const res = NextResponse.next();
      setReferralCookie(res, refCode);
      return res;
    }
  }

  // Handle CORS preflight for API routes
  if (req.method === "OPTIONS" && isApiRoute(req)) {
    const origin = req.headers.get("origin");
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
  }

  // Allow test bypass via env var (server-side) OR request header (Playwright extraHTTPHeaders).
  // In local E2E (next start → NODE_ENV=production) we still want bypass, so we gate it behind
  // E2E_BYPASS=true and NEVER allow it in Vercel production.
  const skipAuthViaEnv = isAuthBypassEnabled();
  const skipAuthViaHeader = isAuthBypassHeaderEnabled(
    req.headers.get("x-skip-auth") ?? req.headers.get("SKIP_AUTH"),
  );
  
  // Rate limit auth bypass attempts using IP address as identifier
  if (skipAuthViaHeader) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() 
      ?? req.headers.get("x-real-ip") 
      ?? "unknown";
    const rl = await rateLimitAuthBypass(ip);
    if (rl) return rl;
  }
  
  if (skipAuthViaEnv || skipAuthViaHeader) {
    const res = NextResponse.next();
    const refCode = req.nextUrl.searchParams.get("ref");
    if (refCode) {
      setReferralCookie(res, refCode);
    }
    return res;
  }

  if (isPublicApiRoute(req)) {
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // API routes: return 401 JSON (never rewrite to /404)
      if (isApiRoute(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Page routes: redirect to sign-in
      const signInUrl = new URL(
        process.env.CLERK_SIGN_IN_URL || "/sign-in",
        req.url,
      );
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  const refCode = req.nextUrl.searchParams.get("ref");
  if (refCode && !req.cookies.has(REFERRAL_COOKIE_NAME)) {
    const res = NextResponse.next();
    setReferralCookie(res, refCode);
    return res;
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
