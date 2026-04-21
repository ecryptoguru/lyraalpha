/**
 * Environment variable validation schema using Zod.
 * Provides type-safe access to environment variables with validation at startup.
 */

import { z } from "zod";

/**
 * Database configuration
 */
const databaseSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid URL").optional(),
});

/**
 * Authentication configuration
 */
const authSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1, "NEXT_PUBLIC_CLERK_SIGN_IN_URL is required"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1, "NEXT_PUBLIC_CLERK_SIGN_UP_URL is required"),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().default("/dashboard/lyra"),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().default("/dashboard/lyra"),
  ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
});

/**
 * AI configuration
 */
const aiSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_ORGANIZATION_ID: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

/**
 * Redis configuration
 */
const redisSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL").optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, "UPSTASH_REDIS_REST_TOKEN is required if URL is provided").optional(),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL").optional(),
});

/**
 * Stripe configuration
 */
const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID_US: z.string().optional(),
  STRIPE_ELITE_PRICE_ID: z.string().optional(),
  STRIPE_ELITE_PRICE_ID_US: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1, "STRIPE_PUBLISHABLE_KEY is required"),
});

/**
 * Email configuration
 */
const emailSchema = z.object({
  BREVO_API_KEY: z.string().min(1, "BREVO_API_KEY is required"),
  BREVO_SENDER_EMAIL: z.string().email("BREVO_SENDER_EMAIL must be a valid email").optional(),
  BREVO_SENDER_NAME: z.string().optional(),
  BREVO_ONBOARDING_LIST_ID: z.string().optional(),
  BREVO_BLOG_LIST_ID: z.string().optional(),
});

/**
 * News API configuration
 */
const newsSchema = z.object({
  NEWSDATA_API_KEY: z.string().min(1, "NEWSDATA_API_KEY is required"),
});

/**
 * Application configuration
 */
const appSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1, "NEXT_PUBLIC_APP_NAME is required"),
  PORT: z.string().regex(/^\d+$/, "PORT must be a number").optional().default("3000"),
});

/**
 * QStash configuration
 */
const qstashSchema = z.object({
  QSTASH_TOKEN: z.string().min(1, "QSTASH_TOKEN is required"),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
});

/**
 * Supabase configuration (optional)
 */
const supabaseSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL").optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
});

/**
 * Market data configuration
 */
const marketDataSchema = z.object({
  COINGECKO_API_KEY: z.string().optional(),
  EXTRA_SYNC_SYMBOLS: z.string().optional(),
  CRYPTO_QUOTES_SLA_HOURS: z.string().regex(/^\d+$/, "CRYPTO_QUOTES_SLA_HOURS must be a number").optional().default("6"),
  LIQUIDITY_SLA_HOURS: z.string().regex(/^\d+$/, "LIQUIDITY_SLA_HOURS must be a number").optional().default("72"),
  CRYPTO_DEX_SLA_HOURS: z.string().regex(/^\d+$/, "CRYPTO_DEX_SLA_HOURS must be a number").optional().default("24"),
});

/**
 * Enterprise configuration (optional)
 */
const enterpriseSchema = z.object({
  ENTERPRISE_DAILY_TOKEN_CAP: z.string().regex(/^\d+$/, "ENTERPRISE_DAILY_TOKEN_CAP must be a number").optional(),
});

/**
 * Cache configuration
 */
const cacheSchema = z.object({
  CACHE_LOG: z.enum(["true", "false"]).optional(),
  CACHE_LOG_SAMPLE: z.string().regex(/^\d+(\.\d+)?$/, "CACHE_LOG_SAMPLE must be a number").optional(),
});

/**
 * Complete environment schema
 */
const envSchema = databaseSchema
  .merge(authSchema)
  .merge(aiSchema)
  .merge(redisSchema)
  .merge(stripeSchema)
  .merge(emailSchema)
  .merge(newsSchema)
  .merge(appSchema)
  .merge(qstashSchema)
  .merge(supabaseSchema)
  .merge(marketDataSchema)
  .merge(enterpriseSchema)
  .merge(cacheSchema);

/**
 * Type-safe environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Throws an error if validation fails
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      return `${issue.path.join(".")}: ${issue.message}`;
    });

    console.error("❌ Environment variable validation failed:");
    console.error(errors.join("\n"));
    console.error("\nPlease check your .env file and ensure all required variables are set.");

    throw new Error(`Environment validation failed:\n${errors.join("\n")}`);
  }

  return result.data;
}

/**
 * Get validated environment variables
 * This should be called after validateEnv() at application startup
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * Export individual environment variable accessors
 * These provide type-safe access to commonly used variables
 */
export const env = {
  get database() {
    return {
      url: getEnv().DATABASE_URL,
      directUrl: getEnv().DIRECT_URL,
    };
  },

  get auth() {
    return {
      clerkSecretKey: getEnv().CLERK_SECRET_KEY,
      clerkPublishableKey: getEnv().CLERK_PUBLISHABLE_KEY,
      signInUrl: getEnv().NEXT_PUBLIC_CLERK_SIGN_IN_URL,
      signUpUrl: getEnv().NEXT_PUBLIC_CLERK_SIGN_UP_URL,
      adminEmailAllowlist: getEnv().ADMIN_EMAIL_ALLOWLIST,
    };
  },

  get ai() {
    return {
      openaiApiKey: getEnv().OPENAI_API_KEY,
      openaiOrgId: getEnv().OPENAI_ORGANIZATION_ID,
      googleAiApiKey: getEnv().GOOGLE_AI_API_KEY,
      openrouterApiKey: getEnv().OPENROUTER_API_KEY,
      tavilyApiKey: getEnv().TAVILY_API_KEY,
      anthropicApiKey: getEnv().ANTHROPIC_API_KEY,
    };
  },

  get redis() {
    return {
      restUrl: getEnv().UPSTASH_REDIS_REST_URL,
      restToken: getEnv().UPSTASH_REDIS_REST_TOKEN,
      url: getEnv().REDIS_URL,
    };
  },

  get stripe() {
    return {
      secretKey: getEnv().STRIPE_SECRET_KEY,
      webhookSecret: getEnv().STRIPE_WEBHOOK_SECRET,
      proPriceId: getEnv().STRIPE_PRO_PRICE_ID_US || getEnv().STRIPE_PRO_PRICE_ID || undefined,
      elitePriceId: getEnv().STRIPE_ELITE_PRICE_ID_US || getEnv().STRIPE_ELITE_PRICE_ID || undefined,
      publishableKey: getEnv().STRIPE_PUBLISHABLE_KEY,
    };
  },

  get email() {
    return {
      brevoApiKey: getEnv().BREVO_API_KEY,
      senderEmail: getEnv().BREVO_SENDER_EMAIL,
      senderName: getEnv().BREVO_SENDER_NAME,
      onboardingListId: getEnv().BREVO_ONBOARDING_LIST_ID,
      blogListId: getEnv().BREVO_BLOG_LIST_ID,
    };
  },

  get news() {
    return {
      newsdataApiKey: getEnv().NEWSDATA_API_KEY,
    };
  },

  get app() {
    return {
      nodeEnv: getEnv().NODE_ENV,
      appUrl: getEnv().NEXT_PUBLIC_APP_URL,
      appName: getEnv().NEXT_PUBLIC_APP_NAME,
      port: parseInt(getEnv().PORT, 10),
    };
  },

  get qstash() {
    return {
      token: getEnv().QSTASH_TOKEN,
      currentSigningKey: getEnv().QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: getEnv().QSTASH_NEXT_SIGNING_KEY,
    };
  },

  get supabase() {
    return {
      url: getEnv().SUPABASE_URL,
      anonKey: getEnv().SUPABASE_ANON_KEY,
    };
  },

  get marketData() {
    return {
      coingeckoApiKey: getEnv().COINGECKO_API_KEY,
      extraSymbols: getEnv().EXTRA_SYNC_SYMBOLS,
      cryptoQuotesSlaHours: parseInt(getEnv().CRYPTO_QUOTES_SLA_HOURS, 10),
      liquiditySlaHours: parseInt(getEnv().LIQUIDITY_SLA_HOURS, 10),
      cryptoDexSlaHours: parseInt(getEnv().CRYPTO_DEX_SLA_HOURS, 10),
    };
  },

  get enterprise() {
    const cap = getEnv().ENTERPRISE_DAILY_TOKEN_CAP;
    return {
      dailyTokenCap: cap ? parseInt(cap, 10) : undefined,
    };
  },

  get cache() {
    const logSample = getEnv().CACHE_LOG_SAMPLE;
    return {
      logEnabled: getEnv().CACHE_LOG === "true",
      logSample: logSample ? parseFloat(logSample) : 0.01,
    };
  },
};
