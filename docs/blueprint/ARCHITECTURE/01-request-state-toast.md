# Architecture — 01: Request, Providers, i18n, State, Toast

← [ARCHITECTURE.md](../ARCHITECTURE.md) | [Blueprint INDEX](../INDEX.md) | [02 — ApiClient, Sentry, PostHog →](./02-apiclient-sentry-posthog.md) | [04 — Proxy →](./04-proxy.md)

---

## Request Lifecycle

```
Browser Request
    │
    ▼
proxy.ts  (Next.js 16 — replaces middleware.ts)
    ├── applyRateLimit     → 429 if /api/* exceeds 60 req/min per IP
    ├── /api/* routes      → applySecurityHeaders → Route Handler
    └── page routes        → intlMiddleware (next-intl) → applySecurityHeaders
            next-intl: reads Accept-Language, sets locale cookie,
                       redirects /path → /id/path
    │
    ▼
src/app/[locale]/layout.tsx  ← RSC
    ├── validates locale param
    ├── loads Outfit + JetBrains Mono via next/font
    ├── calls getTranslations() for generateMetadata
    ├── calls getRequestConfig() → loads messages JSON
    └── renders provider tree:
        <html lang={locale}>
          <NextIntlClientProvider messages={messages}>
            <PostHogProvider>
              {children}         ← pages (RSC by default)
            </PostHogProvider>
            <Toaster />          ← Sonner portal, ONE instance only
          </NextIntlClientProvider>
        </html>
    │
    ▼
src/app/[locale]/page.tsx  ← Server Component
    └── no 'use client', no hooks, no event handlers
```

---

## Provider Tree

| Provider | File | Purpose |
|---|---|---|
| `NextIntlClientProvider` | next-intl (external) | i18n messages to client tree |
| `PostHogProvider` | [src/providers/PostHogProvider.tsx](../../../src/providers/PostHogProvider.tsx) | posthog-js init + pageview tracking |
| `<Suspense>` | inside PostHogProvider | Required: `useSearchParams` triggers Suspense |
| `PostHogPageView` | [src/providers/PostHogProvider.tsx](../../../src/providers/PostHogProvider.tsx) | captures `$pageview` on route change |
| `<Toaster />` | [src/components/ui/Sonner/Sonner.tsx](../../../src/components/ui/Sonner/Sonner.tsx) | Sonner portal outside PostHog, inside intl |

`<Toaster />` placement: outside `PostHogProvider` — toasts are global, need no analytics context.

---

## i18n (next-intl v4)

```
src/i18n/routing.ts
    defineRouting({
      locales: ['en', 'id'],
      defaultLocale: 'en',
      localePrefix: 'as-needed'   // /about (en), /id/about (id)
    })
        │
        ├── proxy.ts
        │       createMiddleware(routing) + rate limit + security headers
        │       matcher: excludes _next/*, static assets (includes /api)
        │
        ├── src/i18n/request.ts
        │       getRequestConfig() → loads messages per locale per RSC render
        │
        └── src/i18n/navigation.ts
                createNavigation(routing)
                exports: Link, redirect, usePathname, useRouter, getPathname
```

**Critical:** Import navigation ONLY from `src/i18n/navigation.ts`. `next/navigation` has no locale context.

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
        mounted in src/app/[locale]/layout.tsx — ONE mount

src/hooks/useToast.ts
    useToast() → { toast, success, error, warning, info, loading, promise, dismiss, custom }
    re-exported from src/hooks/index.ts as useToast + { toast }

sonner direct fn:
    import { toast } from '@/hooks'   // outside component tree (interceptors, etc.)
```

---

← [ARCHITECTURE.md](../ARCHITECTURE.md) | → [02 — ApiClient, Sentry, PostHog](./02-apiclient-sentry-posthog.md)
