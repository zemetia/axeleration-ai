# Architecture — 04: Middleware (Proxy Layer)

← [03 — Zod, shadcn, build](./03-zod-shadcn-build.md) | [ARCHITECTURE.md](../ARCHITECTURE.md) | [Blueprint INDEX](../INDEX.md)

---

## Overview

`src/middleware.ts` is the Next.js server-side intercept layer that runs **before** any route is rendered. It sits at the network boundary in front of the app — handling rate limiting, security headers, and i18n locale routing.

**Runtime:** Node.js (stable). Exports a named `middleware` function.

> **Why `src/middleware.ts` not `proxy.ts`** — Next.js 16 introduced `proxy.ts` as a rename of `middleware.ts`, but it has confirmed production-mode bugs (does not execute in `next start`), Windows 11 failures, and Cloudflare breakage. `middleware.ts` is the stable, reliable choice. See GitHub issues [#85711](https://github.com/vercel/next.js/issues/85711), [#85243](https://github.com/vercel/next.js/issues/85243), [#86122](https://github.com/vercel/next.js/issues/86122).

> **Last-resort rule** — Use middleware only when no other API achieves the goal. Authentication checks **must also** be performed inside Server Functions / Route Handlers — middleware alone is not a sufficient auth boundary (see [Next.js Data Security guide](https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization)).

---

## Request Flow

```
Browser Request
    │
    ▼
src/middleware.ts  (Node.js — runs before route rendering)
    │
    ├── applyRateLimit(request)
    │       /api/* only — sliding window 60 req/min per IP
    │       → 429 Too Many Requests (early return)        if exceeded
    │       → null                                        if ok
    │
    ├── /api/* routes
    │       applySecurityHeaders(NextResponse.next())
    │       → continue to Route Handler
    │
    └── page routes
            intlMiddleware(request)   ← createMiddleware(routing) from next-intl
                reads Accept-Language, sets locale cookie,
                redirects /path → /id/path (non-default locale)
            applySecurityHeaders(intlResponse)
            → continue to src/app/[locale]/layout.tsx
```

---

## File Map

| File | Purpose |
|---|---|
| [`src/middleware.ts`](../../../src/middleware.ts) | Root entry — composes all intercept logic, exports `config.matcher` |
| [`src/proxy/rate-limit.ts`](../../../src/proxy/rate-limit.ts) | Sliding window rate limiter for `/api/*` routes |
| [`src/proxy/security-headers.ts`](../../../src/proxy/security-headers.ts) | Attaches security headers to every response |

---

## Modules

### Rate Limiter (`src/proxy/rate-limit.ts`)

```
applyRateLimit(request: NextRequest): Promise<NextResponse | null>
```

Powered by **[next-limitr](https://github.com/Pallepadehat/next-limitr)**.

`next-limitr` is a Route Handler HOF (`withRateLimit(config)(handler)`). In `middleware.ts` we adapt it by wrapping a noop handler — when the rate limit is hit, `next-limitr` fires our custom `handler` and returns 429 before the noop is ever called.

| Detail | Value |
|---|---|
| Library | `next-limitr` |
| Algorithm | `RateLimitStrategy.SLIDING_WINDOW` |
| Default limit | 60 requests / 60 s per IP |
| Key | `x-forwarded-for[0]` → `x-real-ip` → `'anonymous'` |
| Applies to | `/api/*` only |
| Response | `429` with `Retry-After`, `X-RateLimit-*` headers |
| Storage | In-memory (default) — swap to `RedisStorage` for multi-instance |

To change the limit, edit the constants at the top of `rate-limit.ts`:

```ts
const LIMIT = 60;        // max requests per window
const WINDOW_MS = 60_000; // window duration in ms
```

To switch to Redis for multi-instance deployments:

```ts
import { RedisStorage } from 'next-limitr';
import { Redis } from 'ioredis';

const redis = new Redis({ host: '...', port: 6379 });

const limitedNoop = withRateLimit({
  limit: LIMIT,
  windowMs: WINDOW_MS,
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  storage: 'redis',
  redisClient: redis,
  // ...rest unchanged
})(() => NextResponse.next());
```

### Security Headers (`src/proxy/security-headers.ts`)

```
applySecurityHeaders(response: NextResponse): NextResponse
```

| Header | Value |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `1; mode=block` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (production only) |

---

## Matcher

```ts
// src/middleware.ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};
```

Static assets (`_next/static`, `_next/image`, `favicon.ico`, images) are excluded. `/api` routes are **included** so rate limiting applies.

---

## Adding New Middleware Logic

1. Create `src/proxy/<concern>.ts`
2. Export a pure function: `apply<Concern>(request: NextRequest): Promise<NextResponse | null>` (async early-exit) or `apply<Concern>(response: NextResponse): NextResponse` (sync response mutation)
3. Call it in `src/middleware.ts` — before `intlMiddleware` if it may short-circuit (return early), after if it only mutates headers

```ts
// src/middleware.ts — example adding auth guard
import { applyAuthGuard } from './proxy/auth-guard';

export async function middleware(request: NextRequest) {
  const rateLimited = await applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const authBlocked = await applyAuthGuard(request);  // ← new early-exit handler
  if (authBlocked) return authBlocked;

  if (request.nextUrl.pathname.startsWith('/api')) {
    return applySecurityHeaders(NextResponse.next());
  }

  return applySecurityHeaders(intlMiddleware(request));
}
```

---

## Constraints

| # | Rule |
|---|---|
| 1 | Never import React, components, or `'use client'` modules in middleware/proxy files |
| 2 | Never call `apiClient` or `fetch` for slow data — middleware must be fast |
| 3 | Rate limiter is in-memory — not suitable for multi-instance without KV replacement |
| 4 | Auth logic in middleware is a first-line filter only — always re-verify inside Server Functions |
| 5 | Use `src/middleware.ts` — never root `proxy.ts` (known production/Windows bugs in Next.js 16) |

---

← [03 — Zod, shadcn, build](./03-zod-shadcn-build.md) | [ARCHITECTURE.md](../ARCHITECTURE.md) | [Blueprint INDEX](../INDEX.md)
