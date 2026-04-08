# LyraAlpha Environment Setup

This document lists the external APIs and services required to run the LyraAlpha fork, based on the original project’s `.env` file.

## What is production-critical?

These are the services you should plan to have in place before launching LyraAlpha in production.

### Core / production-critical

#### 1. Clerk Auth
Used for authentication, session management, and auth webhooks.

Required env vars:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL`

#### 2. Stripe Billing
Used for checkout, subscriptions, pricing, and billing webhooks.

Required env vars:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ELITE_PRICE_ID`

#### 3. OpenAI / Azure OpenAI
Used for Lyra, Myra, voice, chat, embeddings, and realtime audio.

Required env vars:
- `OPENAI_API_KEY`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_CHAT_DEPLOYMENT`
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- `AZURE_OPENAI_DEPLOYMENT_LYRA_FULL`
- `AZURE_OPENAI_DEPLOYMENT_LYRA_MINI`
- `AZURE_OPENAI_DEPLOYMENT_LYRA_NANO`
- `AZURE_OPENAI_DEPLOYMENT_MYRA`
- `AZURE_OPENAI_DEPLOYMENT_VOICE`

#### 4. PostgreSQL / Database
Used for the app database, user data, credits, subscriptions, and app state.

Required env vars:
- `DATABASE_URL`
- `DIRECT_URL`

#### 5. Supabase
Used for realtime/live chat and frontend access to Supabase services.

Required env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 6. Upstash Redis
Used for caching, rate limiting, and plan/cache statistics.

Required env vars:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PLAN_CACHE_ENABLED`
- `REDIS_TIMING_ENABLED`
- `REDIS_TIMING_SAMPLE`
- `CACHE_STATS_SAMPLE_RATE`

#### 7. Upstash QStash
Used for scheduled jobs and retryable background workflows.

Required env vars:
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`

#### 8. Voice session signing and realtime config
Used for Myra voice session security and media settings.

Required env vars:
- `VOICE_SESSION_SECRET`
- `VOICE_STT_MODEL`
- `VOICE_TTS_MODEL`
- `NEXT_PUBLIC_APP_URL`

## Feature-dependent / recommended services

These are not necessarily blocking for a local dev build, but the related features will not work without them.

### 9. Gemini / Google GenAI
Used for Gemini-based AI paths and fallback model routing.

Required env vars:
- `GEMINI_API_KEY`
- `ENABLE_GEMINI_FLASH_3`

### 10. OpenRouter
Used for model routing / alternate provider access.

Required env vars:
- `OPENROUTER_API_KEY`

### 11. Brevo Email
Used for onboarding emails and blog/newsletter distribution.

Required env vars:
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BREVO_ONBOARDING_LIST_ID`
- `BREVO_BLOG_LIST_ID`

### 12. Web Push Notifications (VAPID)
Used for browser push notifications.

Required env vars:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

### 13. CoinGecko
Used for crypto market data.

Required env vars:
- `COINGECKO_API_KEY`

### 14. Metals.dev
Used for metals and commodities pricing.

Required env vars:
- `METALS_DEV_API_KEY`

### 15. Finnhub
Used for stock and market data.

Required env vars:
- `FINNHUB_API_KEY`

### 16. CryptoPanic
Used for crypto news and sentiment.

Required env vars:
- `CRYPTOPANIC_API_KEY`

### 17. Tavily
Used for web search / research augmentation.

Required env vars:
- `TAVILY_API_KEY`

### 18. Deepgram
Used for speech-to-text fallback and voice transcription paths.

Required env vars:
- `DEEPGRAM_API_KEY`
- `DEEPGRAM_ALLOW_DIRECT_API_KEY_FALLBACK`

## Runtime flags and operational settings

These are not external services, but they should be reviewed during the fork setup.

- `SKIP_AUTH`
- `SKIP_RATE_LIMIT`
- `MYRA_AI_PROVIDER`
- `ENABLE_LEGACY_YAHOO_INTELLIGENCE`
- `ENABLE_EDU_CACHE`
- `ENABLE_TRENDING_FALLBACK`

## Fork-specific follow-up

For the new `lyraalpha` fork, replace all environment values with fresh project-specific values:

- Use new Clerk app keys and webhook secret.
- Use the new Stripe product / price IDs.
- Use fresh OpenAI, Azure OpenAI, Gemini, and OpenRouter keys.
- Recreate Redis and QStash credentials for the new deployment if needed.
- Update sender email domains and VAPID email to match the new brand.
- Point `NEXT_PUBLIC_APP_URL` to the new production or preview URL.
- Generate a new `.env` from `.env.example` and keep secrets out of Git.

## Security note

Do not commit real `.env` values to GitHub. If any values were copied from the original repository, rotate them before launch.
