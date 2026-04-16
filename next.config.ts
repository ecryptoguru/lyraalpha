import type { NextConfig } from "next";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOCAL_SERVER_ACTION_ORIGINS = [
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost:3001",
  "127.0.0.1:3001",
  "localhost:56500",
  "127.0.0.1:56500",
];

const LOCAL_SERVER_ACTION_ORIGIN_PATTERNS = [
  "127.0.0.*",
];

// ─── Security Headers ────────────────────────────────────────────────────────
// unsafe-eval removed — not needed in production; Turbopack only needs it in dev
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${IS_PRODUCTION ? "" : " 'unsafe-eval'"} https://*.clerk.accounts.dev https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://img.clerk.com https://images.clerk.dev https://www.gravatar.com https://*.clerk.accounts.dev;
  font-src 'self' data:;
  connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com wss://*.clerk.accounts.dev https://*.upstash.io https://api.openai.com wss://api.openai.com https://*.cognitiveservices.azure.com https://*.supabase.co wss://*.supabase.co;
  frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  worker-src 'self' blob:;
`
.replace(/\n/g, "").replace(/\s{2,}/g, " ").trim();

// Applied in all environments — HSTS only in production (must not be sent over HTTP in dev)
const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  ...(IS_PRODUCTION ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

// ─── Next.js Config ──────────────────────────────────────────────────────────
const nextConfig: NextConfig = {
  allowedDevOrigins: IS_PRODUCTION ? undefined : [
    "localhost",
    "127.0.0.1",
    "localhost:3000",
    "127.0.0.1:3000",
    "localhost:3001",
    "127.0.0.1:3001",
    "localhost:56500",
    "127.0.0.1:56500",
    "*.loca.lt",
    "*.ngrok.io",
    "*.ngrok-free.app",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  turbopack: {},
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "sonner",
      "swr",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-select",
      "@radix-ui/react-scroll-area",
    ],
    serverActions: {
      allowedOrigins: IS_PRODUCTION
        ? []
        : [
            ...LOCAL_SERVER_ACTION_ORIGINS,
            ...LOCAL_SERVER_ACTION_ORIGIN_PATTERNS,
          ],
    },
  },
  serverExternalPackages: [
    "pg",
    "pino",
    "pino-pretty",
    "openai",
    "stripe",
    "svix",
    "@prisma/client",
    "@prisma/adapter-pg",
    "yahoo-finance2",
    "stock-nse-india",
    "@tavily/core",
    "@upstash/ratelimit",
  ],
  async redirects() {
    return [
      {
        source: "/dashboard/screener",
        destination: "/dashboard/discovery",
        permanent: true,
      },
      {
        source: "/dashboard/events",
        destination: "/dashboard/timeline",
        permanent: true,
      },
      {
        source: "/dashboard/shock-simulator",
        destination: "/dashboard/stress-test",
        permanent: true,
      },
      {
        source: "/dashboard/stress-test",
        destination: "/dashboard/portfolio?tab=shock-test",
        permanent: false,
      },
      {
        source: "/dashboard/discovery-stocks",
        destination: "/dashboard/discovery?tab=sectors",
        permanent: false,
      },
    ];
  },
  async headers() {
    // ORDER MATTERS: Next.js applies every matching rule in array order and the
    // LAST rule to set a given header key wins. General rules must come FIRST
    // so that specific rules (e.g. cacheable share-card / market endpoints) can
    // override the default `no-store` later in the list.
    return [
      // 1. Site-wide security headers + safe CDN default.
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      // 2. Default for every `/api/*` handler: never cache user-scoped data.
      //    Specific `/api/...` rules below override this for cacheable endpoints.
      {
        source: "/api/(.*)",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      // 3. Dashboard SSR pages — force no-store (user-scoped HTML).
      {
        source: "/dashboard(.*)",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      // 4. Cacheable API endpoints — MUST appear after the `/api/(.*)` default.
      {
        source: "/api/share/card",
        headers: [
          { key: "Content-Type", value: "image/png" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "CDN-Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/api/market/:metric(breadth|correlation-stress|volatility-structure|regime-multi-horizon|factor-rotation)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=3600" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=3600" },
        ],
      },
      // Discovery search — query-string-cached 5 min. Safe to share across users because
      // the response only depends on `q`, `region`, `global` query params.
      {
        source: "/api/discovery/search",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
        ],
      },
      // NOTE: `/api/stocks/*` routes set their own `Cache-Control` per-response
      //       (e.g. `history` returns `private, no-store` on cached Redis hits).
      //       Not adding a blanket rule here so those route-level intents survive.
    ];
  },
  poweredByHeader: false,
};

export default async function getNextConfig(): Promise<NextConfig> {
  if (!IS_PRODUCTION) {
    return nextConfig;
  }

  const { default: withSerwistInit } = await import("@serwist/next");
  const withSerwist = withSerwistInit({
    swSrc: "src/sw.ts",
    swDest: "public/sw.js",
    disable: false,
  });

  return withSerwist(nextConfig);
}
