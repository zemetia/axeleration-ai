# Blueprint Index

Cross-linked reference for AI agents. Every path is a backlink. Read this file first; navigate to specific docs via the table below.

---

## Document Map

| File | Coverage | Use When |
|---|---|---|
| [STRUCTURE.md](./STRUCTURE.md) | Every file/folder, env vars, barrel exports | Finding where something lives |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Request lifecycle, provider tree, proxy, integration wiring | Debugging system-level issues, adding integrations |
| [COMPONENTS.md](./COMPONENTS.md) | CVA pattern, four-file rule, shadcn, Storybook, tests | Building or modifying UI |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | `@theme {}` tokens, oklch palette, typography, radius | Applying styles, adding tokens |
| [BEST_PRACTICE.md](./BEST_PRACTICE.md) | TypeScript constraints, ESLint rules, naming, anti-patterns | All code changes |
| [I18N.md](./I18N.md) | next-intl routing, translations, navigation, static gen | Any page or text work |
| [SERVICES.md](./SERVICES.md) | ApiClient, interceptors, domain services, Zod schemas | API calls, validation, error handling |
| [STATE.md](./STATE.md) | Zustand stores, cookie persistence, storage decision tree | Global state, persistence |
| [SEO_GEO_LLM.md](./SEO_GEO_LLM.md) | SEO metadata, GEO structured data, sitemap, robots, LLMs.txt | Any public page — read before writing metadata or content |
| [DATABASE.md](./DATABASE.md) | Prisma modular schema, NextAuth v5, JWT sessions, `db:*` scripts | Any DB model, auth, or password work |
| [KNOWLEDGE.md](./KNOWLEDGE.md) | Rules for THIS.md + LEARN.md — the learning system | Before every task; after every correction or new insight |

---

## Stack Reference

| Package | Version | Config / Entry |
|---|---|---|
| next | 16.2.7 | [next.config.ts](../../next.config.ts) |
| react | 19.2.7 | Server Components default |
| typescript | 6.0.3 | [tsconfig.json](../../tsconfig.json) |
| tailwindcss | v4 | [src/app/globals.css](../../src/app/globals.css) `@theme {}` |
| next-intl | 4.13.0 | [src/i18n/routing.ts](../../src/i18n/routing.ts) |
| zustand | 5.0.14 | [src/stores/](../../src/stores/) |
| sonner | 2.0.7 | [src/components/ui/Sonner/](../../src/components/ui/Sonner/) |
| @shadcn/ui | CLI only | [components.json](../../components.json) |
| zod | 4.4.3 | [src/lib/validations/](../../src/lib/validations/) |
| @sentry/nextjs | 10.56.0 | [sentry.client.config.ts](../../sentry.client.config.ts) |
| posthog-js | 1.381.0 | [src/providers/PostHogProvider.tsx](../../src/providers/PostHogProvider.tsx) |
| lucide-react | 1.17.0 | paired with shadcn |
| storybook | 10.4.2 | [.storybook/](../../.storybook/) |
| vitest | 4.1.8 | [vitest.config.ts](../../vitest.config.ts) |
| eslint | 9.39.4 | [eslint.config.mjs](../../eslint.config.mjs) |
| class-variance-authority | latest | component variants |
| tailwind-merge | 3.6.0 | [src/lib/cn.ts](../../src/lib/cn.ts) |
| clsx | latest | [src/lib/cn.ts](../../src/lib/cn.ts) |
| prisma | 7.x | [prisma/schema/](../../prisma/schema/) — modular `.prisma` files |
| @prisma/client | 7.x | generated; singleton at [src/lib/prisma.ts](../../src/lib/prisma.ts) |
| next-auth | 5 beta | [src/auth.ts](../../src/auth.ts) — JWT sessions + Credentials |
| @auth/prisma-adapter | 2.x | wired in [src/auth.ts](../../src/auth.ts) |
| bcryptjs | 3.x | password hashing — used in [src/auth.ts](../../src/auth.ts) |

---

## Canonical Import Paths

```ts
// Utilities
import { cn }                          from '@/lib/cn';
import { formatDate, truncate, assertNever } from '@/lib/utils';
import { captureError, captureMessage } from '@/lib/sentry';
import { getCookie, setCookie }         from '@/lib/cookies';

// Validation (Zod v4)
import { emailSchema, passwordSchema, paginationSchema } from '@/lib/validations';

// State
import { useAppStore }                 from '@/stores';
import { createCookieStorage }         from '@/stores';

// Hooks
import { useToast, useBreakpoint, useIsMobile, useLocalStorage } from '@/hooks';
import { toast }                       from '@/hooks';   // direct sonner fn

// Services
import { apiClient, ApiError }         from '@/services';
import { healthService }               from '@/services';

// Types — DTOs (service layer only) + VOs (services + pages)
import type { AdminDTO, AdminListDTO } from '@/types/dtos';
import type { AdminVO, AdminListVO }   from '@/types/value-objects';

// i18n — NEVER import from 'next/navigation'
import { Link, useRouter, usePathname, redirect } from '@/i18n/navigation';
import { routing }                     from '@/i18n/routing';

// UI Components
import { Button, Input, Badge, Card, Typography, Toaster } from '@/components/ui';
import { Header, Footer, PageWrapper } from '@/components/layout';
import { LanguageSwitcher }            from '@/components/shared';

// Providers
import { PostHogProvider }             from '@/providers';

// Database
import { prisma }                      from '@/lib/prisma';

// Auth — server-side only
import { auth, signIn, signOut }       from '@/auth';
import { getSession, requireAuth, requireRole } from '@/lib/auth';

// Validation — auth schemas
import { loginSchema, registerSchema, changePasswordSchema } from '@/lib/validations';
```

---

## Hard Constraints

| # | Rule | Violation |
|---|---|---|
| 1 | `'use client'` only when hook/event/browser-API required | Unnecessary client bundle |
| 2 | Navigation ONLY via `@/i18n/navigation` | `next/navigation` breaks locale context |
| 3 | `npm run lint` must exit 0 (zero warnings) | ESLint `--max-warnings 0` |
| 4 | No `setState` inside `useEffect` | Use `useSyncExternalStore` |
| 5 | All colors via design tokens | No raw hex/oklch/Tailwind color utilities |
| 6 | `import type` for type-only imports | `@typescript-eslint/consistent-type-imports` |
| 7 | `array[n]` returns `T \| undefined` | `noUncheckedIndexedAccess` — guard with `?.` |
| 8 | One `<Toaster />` mount only | [src/app/[locale]/layout.tsx](../../src/app/%5Blocale%5D/layout.tsx) |
| 9 | `displayName` on every component | Required for Sentry + DevTools |
| 10 | Sentry/PostHog are no-ops without env vars | Safe to omit in dev |
| 11 | `middleware.ts` is deprecated — use `proxy.ts` only | Next.js 16 renamed this convention |
| 12 | Proxy logic lives in `src/proxy/` — compose in `proxy.ts` | No inline logic in proxy.ts beyond orchestration |
| 13 | `import { prisma } from '@/lib/prisma'` — never `new PrismaClient()` elsewhere | Multiple instances exhaust DB connections |
| 16 | Prisma 7: no `url` in `datasource` block — connection string is in `prisma.config.ts` + adapter | `P1012` schema validation error |
| 14 | All auth config lives in `src/auth.ts` only | Split config causes session/token mismatch |
| 15 | `requireAuth()` / `requireRole()` at the top of every protected Server Action/Route Handler | Auth bypass |

---

## File Creation Checklists

### New UI Component

- [ ] [src/components/ui/ComponentName/ComponentName.tsx](../../src/components/ui/) — impl + `displayName`
- [ ] [src/components/ui/ComponentName/ComponentName.stories.tsx](../../src/components/ui/) — `satisfies Meta<typeof C>`
- [ ] [src/components/ui/ComponentName/ComponentName.test.tsx](../../src/components/ui/) — RTL behavior tests
- [ ] [src/components/ui/ComponentName/index.ts](../../src/components/ui/) — barrel only
- [ ] Add `export * from './ComponentName'` to [src/components/ui/index.ts](../../src/components/ui/index.ts)

### New Domain Service

- [ ] [src/types/dtos/\<domain\>.dto.ts](../../src/types/dtos/) — raw API shape (snake_case, ISO strings)
- [ ] [src/types/value-objects/\<domain\>.vo.ts](../../src/types/value-objects/) — client-ready shape (camelCase, formatted, derived)
- [ ] Add both to their respective barrel `index.ts`
- [ ] [src/services/\<domain\>.service.ts](../../src/services/) — plain object; fetches DTO, returns VO
- [ ] Add to [src/services/index.ts](../../src/services/index.ts)
- [ ] See [ARCHITECTURE/05-dto-vo.md](./ARCHITECTURE/05-dto-vo.md) for the full transformation pattern

### New Zustand Store

- [ ] [src/stores/<domain>.store.ts](../../src/stores/) — `devtools` + optional `persist`
- [ ] Add to [src/stores/index.ts](../../src/stores/index.ts)

### New Page

- [ ] [src/app/[locale]/<path>/page.tsx](../../src/app/%5Blocale%5D/) — Server Component by default
- [ ] `generateStaticParams` if dynamic segments
- [ ] Translation keys in [messages/en/<ns>.json](../../messages/en/) and [messages/id/<ns>.json](../../messages/id/)
- [ ] Namespace in [src/i18n/request.ts](../../src/i18n/request.ts) if new namespace
- [ ] Add entry to `siteConfig.pages` in [src/config/site.ts](../../src/config/site.ts) — title + description as marketing copy
- [ ] `export async function generateMetadata()` calling `buildMetadata()` from `@/lib/seo`
- [ ] `<StructuredData id="webpage" schema={webPageSchema(...)} />` from `@/lib/structured-data`
- [ ] `<StructuredData id="breadcrumb" schema={breadcrumbSchema(...)} />` (all pages except home)

### New Locale

- [ ] Add to `routing.locales` in [src/i18n/routing.ts](../../src/i18n/routing.ts)
- [ ] Create [messages/<locale>/](../../messages/) with all namespace JSON files
- [ ] Middleware + `generateStaticParams` auto-handle the rest
