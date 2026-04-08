# Production Deployment Checklist

## Required preflight
- Confirm `npm run lint` passes.
- Confirm `npm run typecheck` passes.
- Confirm `npm test` passes.
- Confirm `npm run build` passes.
- Confirm `python .windsurf/scripts/checklist.py . --skip-performance` passes for required checks.
- Review advisory output from `UX Audit` and `SEO Check` separately before launch.

## Runtime hardening completed locally
- Auth bypass is restricted to local development and explicit E2E runs.
- Rate-limit bypass is restricted to local development and explicit E2E runs.
- Stripe routes and Stripe webhooks use lazy initialization and explicit missing-secret errors instead of module-load crashes.
- Stripe success, cancel, and portal return URLs resolve from `NEXT_PUBLIC_APP_URL` or the incoming request origin.
- Supabase realtime degrades safely when public realtime env vars are missing.
- Push notification subscription degrades safely when the public VAPID key is missing.
- Upstash Redis credentials are trimmed before initialization and malformed hosted values now fail open to the noop cache client instead of crashing route-module evaluation.
- Local env inventory was cleaned to remove clearly-unused entries.
- Validation scripts were repaired to use `.windsurf/...` paths and to avoid generated artifact noise.
- `.vercel-env-push.sh` is now newline-safe for secret syncs and supports explicit `production|preview|development` scope selection.

## Required environment variables

### Vercel / Next.js
- `NEXT_PUBLIC_APP_URL`
- `SKIP_AUTH=false`
- `SKIP_RATE_LIMIT=false`
- `E2E_BYPASS` unset in production

### Clerk
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `ADMIN_EMAIL_ALLOWLIST`

### Supabase / Prisma
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Upstash Redis / QStash
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `CRON_SECRET`
- `QSTASH_TOKEN` only for local schedule setup
- `DEPLOYMENT_URL` only for local schedule setup

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ELITE_PRICE_ID`
- Region-specific Stripe price IDs if used

### AMI 2.0 Marketing Agent Bridge
- `AMI_WEBHOOK_SECRET` — shared HMAC-SHA256 secret between InsightAlpha and AMI 2.0; must match the value set in Convex env vars

### Notifications / Email
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BREVO_ONBOARDING_LIST_ID`
- `BREVO_BLOG_LIST_ID`
- `BREVO_WAITLIST_LIST_ID` if waitlist sync is expected

### Data / AI providers

**Lyra (required — GPT-5.4 via Azure OpenAI Responses API):**
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_CHAT_DEPLOYMENT`
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`

**Market data (required):**
- `WEBSEARCHAPI_KEY`
- `FINNHUB_API_KEY`
- `COINGECKO_API_KEY`
- `CRYPTOPANIC_API_KEY`
- `METALS_DEV_API_KEY`

**Myra support provider stack (optional — only required if Myra uses Gemini/OpenRouter fallbacks):**
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`

## Pre-deploy checks in Vercel
- Verify all production env vars exist in the Vercel project.
- Verify preview and production environments do not define bypass flags.
- Verify `NEXT_PUBLIC_APP_URL` points to the production origin.
- Verify Clerk webhook target and secret match the deployed app.
- Verify Stripe webhook target and secret match the deployed app.
- Verify Supabase database URLs are production URLs, not local/test values.
- Verify Upstash signing keys and Redis REST credentials are production credentials.
- If production envs were synced from `.vercel-env-push.sh`, re-push after any script fix that changes piping/escaping behavior so Vercel no longer stores newline-corrupted values.

## Post-deploy checks
- Open the marketing homepage and confirm metadata, OG image, and manifest load.
- Sign in and confirm dashboard load with auth enforced.
- Exercise one Stripe checkout flow in test mode.
- Exercise one Stripe portal flow in test mode.
- Verify one Clerk webhook event reaches the app.
- Verify one cron route can be invoked with the expected auth method.
- Verify live support chat still works when Supabase realtime env vars are present.
- Verify push subscription flow only appears when VAPID public key is configured.
- After any schedule change, re-run: `QSTASH_TOKEN=xxx DEPLOYMENT_URL=https://insightalpha.ai npx tsx scripts/setup-qstash-schedules.ts`
- Verify `AMI_WEBHOOK_SECRET` is set in both InsightAlpha Vercel env vars AND AMI 2.0 Convex env vars with the same value.

## Advisory follow-up
- `UX Audit` and `SEO Check` now pass in the master checklist after source-level and audit-script follow-up.
- The current verified local pre-deploy path is: `npm run lint`, `npm run typecheck`, `npm test`, `VERCEL_ENV=production npm run build`, `npx vercel build`, and `python .windsurf/scripts/checklist.py . --skip-performance`.
- `security_scan.py` is significantly less noisy, but any remaining findings should still be treated as triage input and reviewed in code context before being treated as confirmed vulnerabilities.
- If any local secrets were ever committed, copied into logs, shared in screenshots, or exposed outside approved secret stores, rotate them before production launch.
- Minimum rotation scope before launch if exposure is suspected: Clerk, Stripe, Supabase, Upstash Redis/QStash, Brevo, Azure OpenAI, OpenRouter, Gemini, and all market-data provider keys.
