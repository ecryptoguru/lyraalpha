import "./.sst/platform/config.d.ts";

export default $config({
  app(input) {
    return {
      name: "lyraalpha",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        // ap-south-1 (Mumbai) — matches existing Supabase region, low latency for India users
        aws: { region: "ap-south-1" },
      },
    };
  },
  async run() {
    const isProd = $app.stage === "production";

    // ── Secrets (set via: npx sst secret set <Name> <value> --stage production)
    const databaseUrl         = new sst.Secret("DatabaseUrl");
    const directUrl           = new sst.Secret("DirectUrl");
    const clerkSecretKey      = new sst.Secret("ClerkSecretKey");
    const clerkWebhookSecret  = new sst.Secret("ClerkWebhookSecret");
    const stripeSecretKey     = new sst.Secret("StripeSecretKey");
    const stripeWebhookSecret = new sst.Secret("StripeWebhookSecret");
    const stripeProPriceId    = new sst.Secret("StripeProPriceId");
    const stripeElitePriceId  = new sst.Secret("StripeElitePriceId");
    const azureOpenaiKey      = new sst.Secret("AzureOpenaiKey");
    const azureOpenaiEndpoint = new sst.Secret("AzureOpenaiEndpoint");
    const upstashRedisUrl     = new sst.Secret("UpstashRedisRestUrl");
    const upstashRedisToken   = new sst.Secret("UpstashRedisRestToken");
    const cronSecret          = new sst.Secret("CronSecret");
    const tavilyApiKey        = new sst.Secret("TavilyApiKey");
    const coingeckoApiKey     = new sst.Secret("CoingeckoApiKey");
    const brevoApiKey         = new sst.Secret("BrevoApiKey");
    const vapidPrivateKey     = new sst.Secret("VapidPrivateKey");
    const voiceSessionSecret  = new sst.Secret("VoiceSessionSecret");

    new sst.aws.Nextjs("LyraAlpha", {
      // ── Secrets injected as env vars ──────────────────────────────────────
      link: [
        databaseUrl,
        directUrl,
        clerkSecretKey,
        clerkWebhookSecret,
        stripeSecretKey,
        stripeWebhookSecret,
        stripeProPriceId,
        stripeElitePriceId,
        azureOpenaiKey,
        azureOpenaiEndpoint,
        upstashRedisUrl,
        upstashRedisToken,
        cronSecret,
        tavilyApiKey,
        coingeckoApiKey,
        brevoApiKey,
        vapidPrivateKey,
        voiceSessionSecret,
      ],

      // ── Public env vars (safe to embed in browser bundle) ─────────────────
      environment: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:            process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
        NEXT_PUBLIC_CLERK_SIGN_IN_URL:                "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL:                "/sign-up",
        NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: "/sign-in",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        NEXT_PUBLIC_APP_URL:                          process.env.NEXT_PUBLIC_APP_URL!,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY:                 process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        NODE_ENV:                                     "production",

        // ── Feature flags ──────────────────────────────────────────────────
        SKIP_AUTH:                              "false",
        SKIP_RATE_LIMIT:                        "false",
        PLAN_CACHE_ENABLED:                     "true",
        REDIS_TIMING_ENABLED:                   "true",
        CACHE_STATS_SAMPLE_RATE:                "0",
        ENABLE_LEGACY_YAHOO_INTELLIGENCE:       "false",
        ENABLE_EDU_CACHE:                       "true",
        ENABLE_TRENDING_FALLBACK:               "false",

        // ── DB connection pool — RDS handles more than Supabase pooler ─────
        // 5 per Lambda instance. At 50 concurrent Lambdas = 250 connections
        // (well under RDS t3.small max of 170 with PgBouncer, or use t3.medium if needed)
        PRISMA_POOL_MAX:        "5",
        PRISMA_DIRECT_POOL_MAX: "3",

        // ── Azure OpenAI deployment names (not secret) ─────────────────────
        AZURE_OPENAI_CHAT_DEPLOYMENT:        "gpt-5.4",
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT:   "text-embedding-3-small",
        AZURE_OPENAI_DEPLOYMENT_LYRA_FULL:   "gpt-5.4",
        AZURE_OPENAI_DEPLOYMENT_LYRA_MINI:   "gpt-5.4-mini",
        AZURE_OPENAI_DEPLOYMENT_LYRA_NANO:   "gpt-5.4-nano",
        AZURE_OPENAI_DEPLOYMENT_MYRA:        "gpt-5.4-nano",

        // ── Email (not secret) ─────────────────────────────────────────────
        BREVO_SENDER_EMAIL:       "support@fusionwaveai.com",
        BREVO_SENDER_NAME:        "Support Agent",
        BREVO_ONBOARDING_LIST_ID: "4",
        BREVO_BLOG_LIST_ID:       "5",
      },

      // ── Lambda server settings ────────────────────────────────────────────
      // All routes share a single Lambda. Settings sized for the heaviest
      // workload (Lyra AI streaming: up to 120s, 1 GB context + SDK buffers).
      server: {
        // arm64 (Graviton2): 20% cheaper per GB-s than x86_64, equal or
        // better performance for Node.js. No code changes needed.
        architecture: "arm64",

        // Lyra AI routes declare maxDuration=120, voice session up to 60s.
        // Lambda at 300s for headroom + cron jobs (maxDuration=300).
        // NOTE: CloudFront default timeout is 60s (can increase to 180s via
        // AWS Support). Streaming routes are fine (TTFT <5s, continuous tokens).
        // Cron jobs >60s should use Lambda Function URL directly from EventBridge.
        timeout: "300 seconds",

        // 1 GB RAM:
        // - Lyra context builder loads large JSON correlation/factor data
        // - RAG searches over KnowledgeDoc vector embeddings
        // - Azure OpenAI SDK keeps response buffers in memory during streaming
        memory: "1024 MB",
      },

      // ── Warm instances (cold start elimination) ────────────────────────────
      // SST's warm prop uses a free cron-based warmer (every 5 min) instead of
      // AWS Provisioned Concurrency ($10.80/mo for 1 GB × 24/7).
      // Keeps 1 Lambda instance initialized — eliminates 2-4s cold starts.
      // Per SST docs: https://sst.dev/docs/component/aws/nextjs/#warm
      warm: isProd ? 1 : 0,

      // ── Transform (X-Ray tracing) ──────────────────────────────────────────
      transform: {
        server: {
          // X-Ray traces every request end-to-end:
          // CloudFront → Lambda → RDS → Upstash Redis → Azure OpenAI
          // Cost: ~$0.75/mo at 5% sampling. Essential for post-migration debugging.
          tracing: "active",
        },
      },

      // ── CloudFront cache behaviour ─────────────────────────────────────────
      // SST/OpenNext automatically:
      //   - Caches /_next/static/* at edge (immutable, 1yr)
      //   - Passes Cache-Control from Next.js response headers for API routes
      // Market data routes (/api/market/*) already set s-maxage=3600,
      // so CloudFront caches them at edge automatically.
      //
      // IMPORTANT: CloudFront default origin response timeout = 60s.
      // For Lyra streaming this is fine (first token <5s, then continuous).
      // For cron jobs >60s, EventBridge should target the Lambda Function URL
      // directly (bypasses CloudFront). The URL is available after deploy at:
      //   $app.stage === "production" ? site.nodes.server.url : "dev-url"

      // ── Custom domain ──────────────────────────────────────────────────────
      // Uncomment and fill in your domain before deploying to production.
      // SST provisions ACM certificate + Route 53 records automatically.
      // domain: {
      //   name: "app.yourdomain.com",
      //   dns: sst.aws.dns(),
      // },
    });
  },
});
