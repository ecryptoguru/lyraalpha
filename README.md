# LyraAlpha

LyraAlpha is a Next.js 16 financial intelligence platform for crypto assets, portfolio analysis, and AI-powered market research. It features a tiered subscription model, real-time market data pipelines, and an institutional-grade AI assistant (Lyra) backed by GPT-5.4 via Azure OpenAI.

## Architecture Overview

| Layer | Stack | Key Paths |
|-------|-------|-----------|
| Framework | Next.js 16 (App Router) | `src/app/**/page.tsx`, `src/app/api/**/route.ts` |
| Styling | Tailwind CSS v4 + shadcn/ui | `src/components/ui/`, `src/app/globals.css` |
| Database | PostgreSQL + Prisma ORM | `prisma/schema.prisma`, `src/generated/prisma` |
| Auth | Clerk | `src/proxy.ts`, `src/app/api/webhooks/clerk/route.ts` |
| Cache | Upstash Redis | `src/lib/redis.ts` |
| AI / LLM | Azure OpenAI (GPT-5.4) | `src/lib/ai/` |
| Payments | Stripe + Razorpay | `src/app/api/webhooks/stripe/route.ts` |
| Cron | QStash | `src/app/api/cron/**/route.ts` |
| Testing | Vitest + Playwright | `src/**/*.test.tsx`, `e2e/*.spec.ts` |

## Project Docs

- `CODEBASE.md` - Comprehensive AI agent reference for repository structure, architecture, and development rules
- `AGENTS.md` - High-signal, repo-specific guidance for AI coding agents
- `docs/ENV_SETUP.md` - Service-by-service environment setup guide
- `docs/Product.md` - Product roadmap and feature specifications

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or use Supabase/Neon)
- Redis (Upstash or local)
- Clerk account for auth
- Stripe account for payments (optional for core features)

### Environment Variables

Copy `.env` and fill in the required secrets:

```bash
cp .env .env.local
# Edit .env.local with your credentials
```

Key variables:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` - Auth
- `DATABASE_URL` - PostgreSQL connection
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Cache
- `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` - AI
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Payments

### Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Run migrations (production)
npm run db:migrate:deploy

# Seed data
npm run db:seed
```

### Running Locally

```bash
# Install dependencies
npm install

# Start dev server (Turbopack)
npm run dev

# Open http://localhost:3000
```

### Verification

Before committing, run the full verification pipeline:

```bash
npm run lint      # ESLint
npm run typecheck # TypeScript
npm test          # Vitest (unit)
```

For E2E tests:
```bash
npm run build     # Production build required first
npx playwright test
```

## Key Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start local dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript compiler (no emit) |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB (dev) |
| `npm run db:migrate:deploy` | Run migrations |
| `npm run db:seed` | Seed database |
| `npm run qstash:setup` | Configure QStash cron schedules |
| `npm run sync` | Run daily market sync script |
| `npm run sync:dry` | Dry-run market sync |

## Deployment

The repository is configured for Vercel. Key configuration:

- `next.config.ts` - Next.js config with CSP, redirects, cache headers
- `vercel.json` - Vercel-specific settings
- `sst.config.ts` - SST/AWS infrastructure (optional)

Deploy with Vercel CLI:
```bash
vercel --prod
```

## Directory Structure

```
src/
  app/           # Next.js App Router (pages + API routes)
  components/      # React components (ui/, dashboard/, lyra/, etc.)
  hooks/           # Custom React hooks
  lib/             # Business logic and utilities
    ai/            # Lyra AI pipeline (prompts, routing, RAG, guardrails)
    engines/       # Deterministic scoring engines
    middleware/    # Auth, plan gating, credit gating
    services/      # Business services (market sync, billing, etc.)
    blog/          # Blog system and content
    payments/      # Stripe/Razorpay integration
prisma/            # Prisma schema and migrations
e2e/               # Playwright E2E tests
scripts/           # Ops scripts and cron jobs
public/            # Static assets
```

## Contributing

- Follow the verification order: `lint → typecheck → test`
- Read `AGENTS.md` for critical danger zones and known issues
- All API routes should validate input with Zod
- Plan gating must be enforced server-side (`src/lib/middleware/plan-gate.ts`)
- Credit transactions are immutable — use `addCredits`/`consumeCredits` from `credit.service.ts`

## License

Proprietary — All rights reserved.
