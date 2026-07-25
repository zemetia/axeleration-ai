# Architecture — 02: ApiClient, Sentry, PostHog

← [01 — Request, state, toast](./01-request-state-toast.md) | [ARCHITECTURE.md](../ARCHITECTURE.md) | [03 — Zod, shadcn, build →](./03-zod-shadcn-build.md)

---

## ApiClient

```
src/services/client.ts
    ApiClientInstance {
      baseUrl: process.env['NEXT_PUBLIC_API_URL']
      timeout: 10_000ms
      interceptors: { request[], response[], error[] }
    }

Request pipeline:
    apiClient.get/post/put/patch/delete(path, body?, config?)
        │
        ├── requestInterceptors[].use(ctx)    mutate url/headers/body
        ├── AbortController                    timeout signal
        ├── AbortSignal.any([external, timeout])
        ├── fetch(url, { signal, cache, next: { revalidate, tags } })
        ├── !ok → throw ApiError(status, statusText, body)
        │           └── errorInterceptors[].use(err)
        ├── status 204 → return undefined
        └── responseInterceptors[].use(data, response)
```

### ApiError classification (src/services/types.ts)

| Method | Condition |
|---|---|
| `isNotFound()` | `status === 404` |
| `isUnauthorized()` | `status === 401` |
| `isForbidden()` | `status === 403` |
| `isServerError()` | `status >= 500` |
| `isNetworkError()` | `status === 0` (fetch threw, no HTTP response) |

### RequestConfig options

```ts
interface RequestConfig {
  headers?:         Record<string, string>;
  cache?:           RequestCache;          // 'no-store' | 'force-cache' | etc.
  revalidate?:      number | false;        // Next.js ISR seconds
  tags?:            string[];              // Next.js cache tags
  signal?:          AbortSignal;           // combined with internal timeout
  timeout?:         number;               // per-request override ms, 0 = disabled
  withCredentials?: boolean;
}
```

---

## Sentry (@sentry/nextjs v10)

```
Build time:
next.config.ts
    withSentryConfig(baseConfig, {
      org: SENTRY_ORG, project: SENTRY_PROJECT,
      widenClientFileUpload: true,
      reactComponentAnnotation: { enabled: true },
      tunnelRoute: '/monitoring',
      sourcemaps: { disable: NODE_ENV !== 'production' },
      disableLogger: true,
    })

Runtime init (per environment):
sentry.client.config.ts   → browser: Sentry.init() + replayIntegration()
sentry.server.config.ts   → Node.js: Sentry.init() (no replay)
sentry.edge.config.ts     → Edge: Sentry.init() (no replay)

Next.js instrumentation hook:
src/instrumentation.ts
    register()
        NEXT_RUNTIME === 'nodejs' → import sentry.server.config.ts
        NEXT_RUNTIME === 'edge'   → import sentry.edge.config.ts
    onRequestError(error, request, context)
        → captureRequestError()   captures RSC + Server Action errors

Application wrapper:
src/lib/sentry.ts
    captureError(err: unknown, ctx?: Record<string,unknown>): void
    captureMessage(msg: string, level?: SeverityLevel): void
```

**No-op condition:** `NEXT_PUBLIC_SENTRY_DSN` undefined → no events sent.

---

## PostHog (posthog-js v1)

```
src/providers/PostHogProvider.tsx
    useEffect → posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: false,     // manual below
      capture_pageleave: true,
      person_profiles: 'identified_only',
    })
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />    ← usePathname + useSearchParams → posthog.capture('$pageview')
      </Suspense>
      {children}
    </PHProvider>
```

### Usage API

```ts
import posthog from 'posthog-js';

posthog.identify(user.id, { email, name });       // after login
posthog.capture('event_name', { prop: value });   // custom events
posthog.reset();                                   // on logout
```

**No-op condition:** `NEXT_PUBLIC_POSTHOG_KEY` undefined → `posthog.init` not called.

---

← [01 — Request, state, toast](./01-request-state-toast.md) | [ARCHITECTURE.md](../ARCHITECTURE.md) | → [03 — Zod, shadcn, build](./03-zod-shadcn-build.md)
