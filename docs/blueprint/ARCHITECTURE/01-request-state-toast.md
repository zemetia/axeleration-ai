# Architecture — 01: Request, Providers, State, Toast

← [ARCHITECTURE.md](../ARCHITECTURE.md) | [Blueprint INDEX](../INDEX.md) | [02 — ApiClient, Sentry, PostHog →](./02-apiclient-sentry-posthog.md) | [04 — Proxy →](./04-proxy.md)

---

## Request Lifecycle

```
Browser Request
    │
    ▼
src/middleware.ts
    ├── applyRateLimit     → 429 if /api/* exceeds 60 req/min per IP
    ├── /api/* routes      → applySecurityHeaders → Route Handler
    └── page routes        → applySecurityHeaders
    │
    ▼
src/app/layout.tsx  ← RSC
    ├── loads Outfit + JetBrains Mono via next/font
    ├── static `metadata` export (English copy)
    └── renders provider tree:
        <html lang="en">
          <QueryProvider>
            <PostHogProvider>
              {children}         ← pages (RSC by default)
            </PostHogProvider>
            <Toaster />          ← Sonner portal, ONE instance only
          </QueryProvider>
        </html>
    │
    ▼
src/app/page.tsx  ← Server Component
    └── no 'use client', no hooks, no event handlers
```

---

## Provider Tree

| Provider | File | Purpose |
|---|---|---|
| `QueryProvider` | [src/providers/](../../../src/providers/) | TanStack Query client for server data |
| `PostHogProvider` | [src/providers/PostHogProvider.tsx](../../../src/providers/PostHogProvider.tsx) | posthog-js init + pageview tracking |
| `<Suspense>` | inside PostHogProvider | Required: `useSearchParams` triggers Suspense |
| `PostHogPageView` | [src/providers/PostHogProvider.tsx](../../../src/providers/PostHogProvider.tsx) | captures `$pageview` on route change |
| `<Toaster />` | [src/components/ui/Sonner/Sonner.tsx](../../../src/components/ui/Sonner/Sonner.tsx) | Sonner portal outside PostHog |

`<Toaster />` placement: outside `PostHogProvider` — toasts are global, need no analytics context.

---

## State (Zustand v5)

```
src/stores/app.store.ts
    create<AppState & AppActions>()(
      devtools(               → Redux DevTools, name: 'AppStore'
        persist(              → persists { theme } only (partialize)
          ...,
          {
            name: 'app',                         → cookie key: zst_app
            storage: createCookieStorage()
          }
        )
      )
    )
        └── createCookieStorage
                └── src/lib/cookies.ts  (getCookie / setCookie)
```

Cookie key format: `zst_<store-name>`. Theme is SSR-readable via `cookies()` from `next/headers`.

---

## Toast System (Sonner v2)

```
src/components/ui/Sonner/Sonner.tsx
    <Toaster>  props: theme="dark", richColors, position="bottom-right"
    toastOptions.classNames: design-system tokens with ! suffix for Tailwind v4 important
        │
        mounted in src/app/layout.tsx — ONE mount

src/hooks/useToast.ts
    useToast() → { toast, success, error, warning, info, loading, promise, dismiss, custom }
    re-exported from src/hooks/index.ts as useToast + { toast }

sonner direct fn:
    import { toast } from '@/hooks'   // outside component tree (interceptors, etc.)
```

---

← [ARCHITECTURE.md](../ARCHITECTURE.md) | → [02 — ApiClient, Sentry, PostHog](./02-apiclient-sentry-posthog.md)
