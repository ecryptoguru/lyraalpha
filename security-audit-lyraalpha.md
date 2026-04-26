# Security & Dependency Audit — lyraalpha

**Date:** 2026-04-26  
**Repo:** `ecryptoguru/lyraalpha`  
**Package:** `lyraalpha` (Next.js)  
**Audit Tools:** `npm audit`, `npm outdated`, `license-checker`, manual code review

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Critical Vulnerabilities** | 2 |
| **High Vulnerabilities** | 13 |
| **Moderate Vulnerabilities** | 15 |
| **Low Vulnerabilities** | 0 |
| **Total Vulnerabilities** | **30** |
| **Outdated Packages** | 48 |
| **License Issues** | 9 |
| **Total Dependencies** | ~1,168 |

---

## 1. CRITICAL Vulnerabilities (Fix Immediately)

### 1.1 Clerk SDK — Middleware Route Protection Bypass
- **Advisory:** [GHSA-vqx2-fgx2-5wq9](https://github.com/advisories/GHSA-vqx2-fgx2-5wq9)
- **Affected:** `@clerk/nextjs` (6.37.3), `@clerk/shared`
- **Severity:** CRITICAL
- **Impact:** Attackers can bypass middleware-based route protection, gaining unauthorized access to protected routes (dashboard, API endpoints).
- **Fix:** `npm audit fix` → updates to `@clerk/nextjs >=6.39.2`

> **This is the highest priority fix.** The app uses Clerk for authentication and this vulnerability allows complete auth bypass at the middleware layer.

---

## 2. HIGH Severity Vulnerabilities (Fix This Week)

### 2.1 Next.js — 6 Advisories
| Advisory | Issue |
|----------|-------|
| [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) | HTTP request smuggling in rewrites |
| [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) | Unbounded `next/image` disk cache growth |
| [GHSA-h27x-g6w4-24gq](https://github.com/advisories/GHSA-h27x-g6w4-24gq) | Unbounded postponed resume buffering DoS |
| [GHSA-mq59-m269-xvcx](https://github.com/advisories/GHSA-mq59-m269-xvcx) | Null origin bypasses Server Actions CSRF |
| [GHSA-jcc7-9wpm-mj36](https://github.com/advisories/GHSA-jcc7-9wpm-mj36) | Null origin bypasses dev HMR websocket CSRF |
| [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) | DoS with Server Components |

- **Current:** 16.1.6 → **Fix:** 16.2.4
- **Fix:** `npm audit fix --force` (outside stated range)

### 2.2 Hono — 14 Advisories (via Prisma)
- XSS, arbitrary file access, prototype pollution, cookie/SSE injection, path traversal, middleware bypass, IP spoofing
- **Transitive dep** via `prisma → @prisma/dev → hono`
- **Fix:** Update `prisma` to >=7.8.0

### 2.3 Vite — 3 Advisories
| Advisory | Issue |
|----------|-------|
| [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) | Path traversal in optimized deps .map handling |
| [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r) | `server.fs.deny` bypassed with queries |
| [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583) | Arbitrary file read via dev server WebSocket |

- **Fix:** `npm audit fix`

### 2.4 Lodash — Prototype Pollution + Code Injection
| Advisory | Issue |
|----------|-------|
| [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | Prototype pollution in `_.unset` and `_.omit` |
| [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | Code injection via `_.template` |
| [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | Prototype pollution via array path bypass |

- **Transitive dep** via `prisma → chevrotain → lodash`
- **Fix:** Update `prisma` to latest

### 2.5 Other HIGH Issues

| Package | Advisory | Issue | Fix |
|---------|----------|-------|-----|
| `defu` <=6.1.4 | [GHSA-737v-mqg7-c878](https://github.com/advisories/GHSA-737v-mqg7-c878) | Prototype pollution via `__proto__` | `npm audit fix` |
| `effect` <3.20.0 | [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) | AsyncLocalStorage context contamination | `npm audit fix` |
| `flatted` <=3.4.1 | [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | Prototype pollution via `parse()` | `npm audit fix` |
| `path-to-regexp` | [GHSA-37ch-88jc-xwx2](https://github.com/advisories/GHSA-37ch-88jc-xwx2) | Multiple ReDoS | `npm audit fix` |
| `picomatch` <=2.3.1 | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | Method injection + ReDoS | `npm audit fix` |
| `@hono/node-server` | [GHSA-wc8c-qw6v-h7f6](https://github.com/advisories/GHSA-wc8c-qw6v-h7f6) | Auth bypass via encoded slashes | `npm audit fix` |

---

## 3. MODERATE Vulnerabilities

| Package | Issue | Fix |
|---------|-------|-----|
| `dompurify` <=3.3.3 | 4 XSS/prototype pollution bypasses (ADD_TAGS bypass, SAFE_FOR_TEMPLATES bypass, Prototype Pollution to XSS) | `npm install dompurify@3.4.1` |
| `axios` 1.0-1.14 | SSRF via NO_PROXY bypass + cloud metadata exfiltration via header injection | `npm audit fix` |
| `brace-expansion` | DoS via zero-step sequence (process hang + memory exhaustion) | `npm audit fix` |
| `fast-xml-parser` <5.7.0 | XML comment/CDATA injection | `npm audit fix` |
| `follow-redirects` <=1.15.11 | Custom auth header leakage on cross-domain redirects | `npm audit fix` |
| `postcss` <8.5.10 | XSS via unescaped `</style>` in CSS stringify output | `npm audit fix --force` |
| `uuid` <14.0.0 | Missing buffer bounds check in v3/v5/v6 | `npm audit fix` |

---

## 4. Code-Level Security Findings

### 4.1 `dangerouslySetInnerHTML` Usage (11 instances) — SAFE
- JSON-LD structured data (`JSON.stringify(schema)`) — safe, controlled input
- One usage with `DOMPurify.sanitize()` — properly sanitized
- **Verdict:** No XSS risk

### 4.2 No Hardcoded Secrets
- No API keys, tokens, or credentials found in source code
- `.env*` files properly gitignored
- 224 `process.env.*` references — all using environment variables correctly

### 4.3 Security Headers — GOOD
- Content-Security-Policy (well-configured, `unsafe-eval` only in dev)
- Strict-Transport-Security (production only)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (camera, microphone, geolocation blocked)
- X-Permitted-Cross-Domain-Policies: none

### 4.4 Auth Bypass — Properly Gated
- Auth bypass (`x-skip-auth` header) is gated behind `isBypassRuntimeAllowed()` — non-production only
- **Rate limiting is applied** to auth bypass header attempts via `rateLimitAuthBypass()`
- CORS uses wildcard subdomain patterns (`.vercel.app`, `.lyraalpha.com`, `.lyraalpha.ai`) — properly validated

### 4.5 Redis `eval()` Usage — SAFE
- Used for Lua scripting in rate limiter — standard Redis pattern, not JavaScript `eval()`

---

## 5. Outdated Dependencies

### Major Version Bumps Needed

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@clerk/nextjs` | 6.37.3 | **7.2.7** | Major — plan migration |
| `@google/genai` | 0.8.0 | **1.50.1** | Major — significant API changes likely |
| `stripe` | 20.3.1 | **22.1.0** | Major |
| `lucide-react` | 0.563.0 | **1.11.0** | Major |
| `typescript` | 5.9.3 | **6.0.3** | Major |
| `vitest` | 3.2.4 | **4.1.5** | Major |
| `@vitejs/plugin-react` | 5.1.3 | **6.0.1** | Major |
| `jsdom` | 27.0.1 | **28.1.0** | Major |

### Security-Critical Updates (semver-compatible — safe now)

| Package | Current | Wanted | Why |
|---------|---------|--------|-----|
| `dompurify` | 3.3.3 | **3.4.1** | 4 XSS bypasses |
| `prisma` | 7.5.0 | **7.8.0** | Fixes hono/lodash chain |
| `@prisma/client` | 7.3.0 | **7.8.0** | Must match prisma |
| `next` | 16.1.6 | **16.2.4** | 6 high-severity fixes |
| `ai` | 6.0.77 | **6.0.168** | Bug fixes |
| `@ai-sdk/openai` | 3.0.26 | **3.0.53** | Bug fixes |
| `@openrouter/ai-sdk-provider` | 2.2.3 | **2.8.1** | Bug fixes |
| `svix` | 1.84.1 | **1.92.2** | uuid fix chain |

### All 48 Outdated Packages

| Package | Current | Wanted | Latest |
|---------|---------|--------|--------|
| @ai-sdk/openai | 3.0.26 | 3.0.53 | 3.0.53 |
| @aws-sdk/client-scheduler | 3.1021.0 | 3.1037.0 | 3.1037.0 |
| @clerk/nextjs | 6.37.3 | 6.39.3 | 7.2.7 |
| @google/genai | 0.8.0 | 0.8.0 | 1.50.1 |
| @openai/agents | 0.8.2 | 0.8.5 | 0.8.5 |
| @openrouter/ai-sdk-provider | 2.2.3 | 2.8.1 | 2.8.1 |
| @playwright/test | 1.58.2 | 1.59.1 | 1.59.1 |
| @prisma/adapter-pg | 7.3.0 | 7.8.0 | 7.8.0 |
| @prisma/client | 7.3.0 | 7.8.0 | 7.8.0 |
| @react-three/fiber | 9.5.0 | 9.6.0 | 9.6.0 |
| @serwist/next | 9.5.6 | 9.5.7 | 9.5.7 |
| @supabase/supabase-js | 2.97.0 | 2.104.1 | 2.104.1 |
| @tailwindcss/postcss | 4.1.18 | 4.2.4 | 4.2.4 |
| @types/node | 20.19.33 | 20.19.39 | 25.6.0 |
| @types/pg | 8.16.0 | 8.20.0 | 8.20.0 |
| @types/react | 19.2.10 | 19.2.14 | 19.2.14 |
| @types/three | 0.183.1 | 0.183.1 | 0.184.0 |
| @upstash/qstash | 2.9.0 | 2.10.1 | 2.10.1 |
| @upstash/redis | 1.36.2 | 1.37.0 | 1.37.0 |
| @vitejs/plugin-react | 5.1.3 | 5.2.0 | 6.0.1 |
| ai | 6.0.77 | 6.0.168 | 6.0.168 |
| dompurify | 3.3.3 | 3.4.1 | 3.4.1 |
| dotenv | 17.2.4 | 17.4.2 | 17.4.2 |
| eslint | 9.39.2 | 9.39.4 | 9.39.4 |
| eslint-config-next | 16.1.6 | 16.1.6 | 16.2.4 |
| framer-motion | 12.34.3 | 12.38.0 | 12.38.0 |
| jsdom | 27.0.1 | 27.4.0 | 28.1.0 |
| lightweight-charts | 5.1.0 | 5.2.0 | 5.2.0 |
| lucide-react | 0.563.0 | 0.563.0 | 1.11.0 |
| next | 16.1.6 | 16.1.6 | 16.2.4 |
| openai | 6.33.0 | 6.34.0 | 6.34.0 |
| pg | 8.18.0 | 8.20.0 | 8.20.0 |
| pino | 10.3.0 | 10.3.1 | 10.3.1 |
| playwright | 1.58.2 | 1.59.1 | 1.59.1 |
| prisma | 7.5.0 | 7.8.0 | 7.8.0 |
| react | 19.2.3 | 19.2.3 | 19.2.5 |
| react-dom | 19.2.3 | 19.2.3 | 19.2.5 |
| recharts | 3.7.0 | 3.8.1 | 3.8.1 |
| serwist | 9.5.6 | 9.5.7 | 9.5.7 |
| stripe | 20.3.1 | 20.4.1 | 22.1.0 |
| svix | 1.84.1 | 1.92.2 | 1.92.2 |
| swr | 2.4.0 | 2.4.1 | 2.4.1 |
| tailwind-merge | 3.4.0 | 3.5.0 | 3.5.0 |
| tailwindcss | 4.1.18 | 4.2.4 | 4.2.4 |
| three | 0.183.2 | 0.183.2 | 0.184.0 |
| typescript | 5.9.3 | 5.9.3 | 6.0.3 |
| vitest | 3.2.4 | 3.2.4 | 4.1.5 |
| yahoo-finance2 | 3.13.0 | 3.14.0 | 3.14.0 |

---

## 6. License Issues

### 6.1 Action Required

| Package | License | Risk |
|---------|---------|------|
| `@spoons-and-mirrors/subtask2` | **PolyForm-Noncommercial-1.0.0** | **Prohibits commercial use** — must replace or obtain commercial license |

### 6.2 Review Recommended

| License | Packages | Risk Level |
|---------|----------|------------|
| LGPL-3.0-or-later | `@img/sharp-libvips-linux-x64`, `@img/sharp-libvips-linuxmusl-x64` | Low — dynamic linking, server-side |
| MPL-2.0 | `axe-core`, `lightningcss` (3 variants), `web-push` | Low — file-level copyleft |
| UNLICENSED | `lyraalpha@0.1.0` (root package) | Set a license in `package.json` |

### 6.3 License Distribution

| License | Count |
|---------|-------|
| MIT | 915 |
| Apache-2.0 | 141 |
| ISC | 53 |
| BSD-2-Clause | 15 |
| BSD-3-Clause | 14 |
| BlueOak-1.0.0 | 6 |
| MPL-2.0 | 5 |
| MIT* | 3 |
| MIT-0 | 2 |
| LGPL-3.0-or-later | 2 |
| Unlicense | 2 |
| CC0-1.0 | 2 |
| PolyForm-Noncommercial-1.0.0 | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| Other | 4 |

---

## 7. Recommended Action Plan

### Immediate (Today)
```bash
# Fix critical Clerk vulnerability + most moderate issues
npm audit fix

# Update dompurify (4 XSS bypass fixes)
npm install dompurify@3.4.1
```

### This Week
```bash
# Update Next.js to fix 6 high-severity issues
npm install next@16.2.4

# Update Prisma to fix hono/lodash/effect chain
npm install prisma@7.8.0 @prisma/client@7.8.0 @prisma/adapter-pg@7.8.0
```

### This Sprint
- Run `npm update` for all semver-compatible updates
- Review `@spoons-and-mirrors/subtask2` license for commercial use
- Set up automated dependency scanning in CI

### Next Quarter
- Plan major version upgrades: `@clerk/nextjs@7`, `stripe@22`, `typescript@6`, `vitest@4`

---

## Audit Session

| Session | URL |
|---------|-----|
| lyraalpha root audit | [View](https://app.devin.ai/sessions/fdcaf7b1e7d14fa1afb5973ca3d63a72) |
