# Structure — 02: Module Directories

← [01 — App directories](./01-app-dirs.md) | [STRUCTURE.md](../STRUCTURE.md) | [Blueprint INDEX](../INDEX.md)

---

## prisma/schema/

| Path | Models | Notes |
|---|---|---|
| [`prisma/schema/base.prisma`](../../../prisma/schema/base.prisma) | `generator client`, `datasource db` | No `url` in datasource — Prisma 7 reads it from `prisma.config.ts` |
| [`prisma/schema/user.prisma`](../../../prisma/schema/user.prisma) | `User`, `UserRole` | Owns the user identity + role |
| [`prisma/schema/auth.prisma`](../../../prisma/schema/auth.prisma) | `Account`, `Session`, `VerificationToken` | Auth.js adapter models |

New domain models get their own file: `prisma/schema/<domain>.prisma`.

---

## src/proxy/

| Path | Export | Purpose |
|---|---|---|
| [`src/proxy/rate-limit.ts`](../../../src/proxy/rate-limit.ts) | `applyRateLimit` | `next-limitr` sliding window rate limiter for `/api/*`; returns `Promise<429 response \| null>` |
| [`src/proxy/security-headers.ts`](../../../src/proxy/security-headers.ts) | `applySecurityHeaders` | Attaches security headers to every `NextResponse` |

No barrel — these are consumed only by `proxy.ts`.

---

## src/hooks/

| Path | Signature | Notes |
|---|---|---|
| [src/hooks/useBreakpoint.ts](../../../src/hooks/useBreakpoint.ts) | `useBreakpoint(): Breakpoint` | `useSyncExternalStore`, no setState-in-effect |
| [src/hooks/useBreakpoint.ts](../../../src/hooks/useBreakpoint.ts) | `useIsMobile(): boolean` | Same file |
| [src/hooks/useLocalStorage.ts](../../../src/hooks/useLocalStorage.ts) | `useLocalStorage<T>(key, initial): [T, (v:T)=>void]` | SSR-safe |
| [src/hooks/useToast.ts](../../../src/hooks/useToast.ts) | `useToast(): ToastAPI` | Thin sonner wrapper |
| [src/hooks/index.ts](../../../src/hooks/index.ts) | barrel | re-exports hooks + `{ toast } from 'sonner'` |

### useToast API

```ts
import { useToast, toast } from '@/hooks';

const t = useToast();
t.success(msg, opts?)    t.error(msg, opts?)    t.warning(msg, opts?)
t.info(msg, opts?)       t.loading(msg, opts?)  t.promise(p, labels)
t.dismiss(id?)           t.custom(jsx, opts?)

toast.error('msg');      // direct sonner fn — outside components
```

---

## src/i18n/

| Path | Purpose |
|---|---|
| [src/i18n/routing.ts](../../../src/i18n/routing.ts) | `defineRouting` — locales `['en','id']`, `localePrefix: 'as-needed'` |
| [src/i18n/navigation.ts](../../../src/i18n/navigation.ts) | `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` |
| [src/i18n/request.ts](../../../src/i18n/request.ts) | `getRequestConfig` — loads message JSON per locale per RSC render |

---

## src/config/

| Path | Export | Purpose |
|---|---|---|
| [src/config/site.ts](../../../src/config/site.ts) | `siteConfig`, `SiteConfig`, `PageConfig` | Company brain — drives SEO, GEO, sitemap, LLMs.txt → [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) |

---

## src/lib/

| Path | Export | Signature |
|---|---|---|
| [src/lib/cn.ts](../../../src/lib/cn.ts) | `cn` | `cn(...inputs: ClassValue[]): string` — `twMerge(clsx(...))` |
| [src/lib/prisma.ts](../../../src/lib/prisma.ts) | `prisma` | `PrismaClient` singleton — one per process |
| [src/lib/auth.ts](../../../src/lib/auth.ts) | `getSession`, `requireAuth`, `requireRole` | Server-side session helpers — use in Server Components + Route Handlers |
| [src/lib/cookies.ts](../../../src/lib/cookies.ts) | `getCookie` / `setCookie` / `deleteCookie` / `getAllCookies` / `parseCookieHeader` | Cookie helpers |
| [src/lib/sentry.ts](../../../src/lib/sentry.ts) | `captureError` / `captureMessage` | Sentry wrappers |
| [src/lib/seo.ts](../../../src/lib/seo.ts) | `buildMetadata` | Builds full `Metadata` object for every public page → [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) |
| [src/lib/structured-data.ts](../../../src/lib/structured-data.ts) | `organizationSchema`, `webPageSchema`, `faqSchema`, `breadcrumbSchema`, `articleSchema`, `serializeSchema` | JSON-LD schema builders + serializer → [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) |
| [src/lib/utils.ts](../../../src/lib/utils.ts) | `formatDate` / `truncate` / `slugify` / `assertNever` | General utilities |
| [src/lib/validations/common.ts](../../../src/lib/validations/common.ts) | `emailSchema`, `passwordSchema`, `nameSchema`, `urlSchema`, `uuidSchema`, `paginationSchema` | Zod primitives |
| [src/lib/validations/auth.ts](../../../src/lib/validations/auth.ts) | `loginSchema`, `registerSchema`, `changePasswordSchema` + input types | Auth-specific Zod schemas |
| [src/lib/validations/index.ts](../../../src/lib/validations/index.ts) | barrel | re-exports `common.ts` + `auth.ts` |

---

## src/providers/

| Path | Export | Purpose |
|---|---|---|
| [src/providers/PostHogProvider.tsx](../../../src/providers/PostHogProvider.tsx) | `PostHogProvider` | posthog-js init + `$pageview` tracking |
| [src/providers/index.tsx](../../../src/providers/index.tsx) | barrel | `export { PostHogProvider }` |

---

## src/services/

| Path | Export | Purpose |
|---|---|---|
| [src/services/types.ts](../../../src/services/types.ts) | `ApiError`, `RequestConfig`, interceptor types | All shared service types |
| [src/services/client.ts](../../../src/services/client.ts) | `apiClient` | Singleton `ApiClientInstance` |
| [src/services/health.service.ts](../../../src/services/health.service.ts) | `healthService` | Example domain service |
| [src/services/index.ts](../../../src/services/index.ts) | barrel | `apiClient`, `ApiError`, all services |

---

## src/stores/

| Path | Export | Purpose |
|---|---|---|
| [src/stores/app.store.ts](../../../src/stores/app.store.ts) | `useAppStore` | Global UI: `theme`, `sidebarOpen` |
| [src/stores/middleware/cookie-storage.ts](../../../src/stores/middleware/cookie-storage.ts) | `createCookieStorage` | Zustand persist adapter via `document.cookie` |
| [src/stores/index.ts](../../../src/stores/index.ts) | barrel | `useAppStore`, `createCookieStorage` |

---

## src/types/

| Path | Export |
|---|---|
| [src/types/common.ts](../../../src/types/common.ts) | `Nullable<T>`, `Maybe<T>`, `Prettify<T>`, `PaginatedResponse<T>`, `ApiResponse<T>` |
| [src/types/index.ts](../../../src/types/index.ts) | barrel — re-exports `common.ts` only |

### src/types/dtos/

Raw API response shapes. Field names mirror the server JSON exactly (snake_case, ISO date strings, no derived data). Consumed only by services — never by pages or components.

| Path | Export |
|---|---|
| [src/types/dtos/admin.dto.ts](../../../src/types/dtos/admin.dto.ts) | `AdminDTO`, `AdminListDTO` |
| [src/types/dtos/index.ts](../../../src/types/dtos/index.ts) | barrel |

### src/types/value-objects/

Client-ready, display-optimized shapes. Produced by services after transforming DTOs — camelCase keys, formatted strings, derived booleans, no nullables. Consumed by services and pages/components.

| Path | Export |
|---|---|
| [src/types/value-objects/admin.vo.ts](../../../src/types/value-objects/admin.vo.ts) | `AdminVO`, `AdminListVO` |
| [src/types/value-objects/index.ts](../../../src/types/value-objects/index.ts) | barrel |

See [ARCHITECTURE/05-dto-vo.md](../ARCHITECTURE/05-dto-vo.md) for the full data-flow and transformation pattern.

---

## messages/

| Path | Namespace | Used by |
|---|---|---|
| [messages/en/common.json](../../../messages/en/common.json) | `common` | Shared labels, buttons, errors |
| [messages/en/navigation.json](../../../messages/en/navigation.json) | `navigation` | Nav labels |
| [messages/en/home.json](../../../messages/en/home.json) | `home` | Home page + meta |
| [messages/id/common.json](../../../messages/id/common.json) | `common` | Indonesian |
| [messages/id/navigation.json](../../../messages/id/navigation.json) | `navigation` | Indonesian |
| [messages/id/home.json](../../../messages/id/home.json) | `home` | Indonesian |

Namespace key = JSON filename without extension. Loaded in [src/i18n/request.ts](../../../src/i18n/request.ts).

---

## Environment Variables

Reference: [.env.example](../../../.env.example)

| Variable | Required | Runtime | Consumer |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | client+server | Metadata base URL |
| `NEXT_PUBLIC_API_URL` | Yes | client+server | `src/services/client.ts` `baseUrl` |
| `NEXT_PUBLIC_SENTRY_DSN` | Prod | client+server | Sentry configs |
| `SENTRY_ORG` | Prod/CI | build | `next.config.ts` `withSentryConfig` |
| `SENTRY_PROJECT` | Prod/CI | build | `next.config.ts` `withSentryConfig` |
| `SENTRY_AUTH_TOKEN` | CI | build | Source map upload |
| `NEXT_PUBLIC_POSTHOG_KEY` | Prod | client | `src/providers/PostHogProvider.tsx` |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | client | Defaults to `https://us.i.posthog.com` |
| `DATABASE_URL` | Yes | server | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | server | JWT signing key — `openssl rand -base64 32` |
| `AUTH_URL` | Prod | server | Canonical origin for NextAuth redirects |

Missing `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY` → integrations are silent no-ops.

---

← [01 — App directories](./01-app-dirs.md) | [STRUCTURE.md](../STRUCTURE.md)
