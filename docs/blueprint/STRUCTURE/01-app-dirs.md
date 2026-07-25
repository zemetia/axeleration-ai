# Structure — 01: App Directories

← [STRUCTURE.md](../STRUCTURE.md) | [Blueprint INDEX](../INDEX.md) | [02 — Modules →](./02-modules.md)

---

## Root

| Path | Type | Purpose |
|---|---|---|
| [src/](../../../src/) | dir | All application source |
| [messages/](../../../messages/) | dir | i18n JSON files → [I18N.md](../I18N.md) |
| [docs/blueprint/](../../../docs/blueprint/) | dir | AI reference docs (this dir) |
| [public/](../../../public/) | dir | Static assets |
| [.env.example](../../../.env.example) | file | Env var template → copy to `.env.local` |
| [components.json](../../../components.json) | file | shadcn/ui CLI config → [COMPONENTS.md](../COMPONENTS.md) |
| [proxy.ts](../../../proxy.ts) | file | Request intercept: rate limit + security headers + next-intl routing → [ARCHITECTURE/04-proxy.md](../ARCHITECTURE/04-proxy.md) |
| [prisma.config.ts](../../../prisma.config.ts) | file | Prisma 7 config — schema path + datasource URL for CLI → [DATABASE.md](../DATABASE.md) |
| [next.config.ts](../../../next.config.ts) | file | Next.js config + `withSentryConfig` wrapper |
| [sentry.client.config.ts](../../../sentry.client.config.ts) | file | Sentry browser init |
| [sentry.server.config.ts](../../../sentry.server.config.ts) | file | Sentry Node.js init |
| [sentry.edge.config.ts](../../../sentry.edge.config.ts) | file | Sentry Edge runtime init |
| [tsconfig.json](../../../tsconfig.json) | file | strict + extra flags → [BEST_PRACTICE.md](../BEST_PRACTICE.md) |
| [vitest.config.ts](../../../vitest.config.ts) | file | Vitest + jsdom + `@/` alias |
| [vitest.setup.ts](../../../vitest.setup.ts) | file | `@testing-library/jest-dom` matchers |
| [eslint.config.mjs](../../../eslint.config.mjs) | file | Flat config, 0-warning policy |
| [package.json](../../../package.json) | file | Scripts + dependencies |

---

## src/

| Path | Type | Purpose |
|---|---|---|
| [src/app/](../../../src/app/) | dir | App Router pages + API routes |
| [src/components/](../../../src/components/) | dir | All React components → [COMPONENTS.md](../COMPONENTS.md) |
| [src/hooks/](../../../src/hooks/) | dir | Client-side hooks |
| [src/i18n/](../../../src/i18n/) | dir | next-intl config → [I18N.md](../I18N.md) |
| [src/instrumentation.ts](../../../src/instrumentation.ts) | file | Next.js instrumentation — Sentry server/edge init |
| [src/auth.ts](../../../src/auth.ts) | file | NextAuth config — `handlers`, `auth`, `signIn`, `signOut` |
| [src/lib/](../../../src/lib/) | dir | Framework-agnostic utilities |
| [src/providers/](../../../src/providers/) | dir | React context providers |
| [src/services/](../../../src/services/) | dir | ApiClient + domain services → [SERVICES.md](../SERVICES.md) |
| [src/stores/](../../../src/stores/) | dir | Zustand global state → [STATE.md](../STATE.md) |
| [src/types/](../../../src/types/) | dir | Shared TypeScript types |

---

## src/app/

| Path | Type | Purpose |
|---|---|---|
| [src/app/globals.css](../../../src/app/globals.css) | file | Tailwind v4 `@theme {}` tokens + base → [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) |
| [src/app/layout.tsx](../../../src/app/layout.tsx) | file | Root layout — minimal HTML shell only |
| [src/app/[locale]/layout.tsx](../../../src/app/%5Blocale%5D/layout.tsx) | file | Locale layout: fonts, providers, `<Toaster />`, PostHog |
| [src/app/[locale]/page.tsx](../../../src/app/%5Blocale%5D/page.tsx) | file | Home page (Server Component) |
| [src/app/[locale]/about/page.tsx](../../../src/app/%5Blocale%5D/about/page.tsx) | file | About page (Server Component) |
| [src/app/api/health/route.ts](../../../src/app/api/health/route.ts) | file | Health check endpoint — Edge runtime |
| [src/app/api/auth/[...nextauth]/route.ts](../../../src/app/api/auth/%5B...nextauth%5D/route.ts) | file | NextAuth HTTP handler — do not edit, just re-exports `handlers` |
| [src/app/sitemap.ts](../../../src/app/sitemap.ts) | file | Auto-generated `/sitemap.xml` — driven by `siteConfig.pages` |
| [src/app/robots.ts](../../../src/app/robots.ts) | file | Auto-generated `/robots.txt` |
| [src/app/llms.txt/route.ts](../../../src/app/llms.txt/route.ts) | file | `/llms.txt` — LLM guidance file, generated from `siteConfig` |

### Provider tree in src/app/[locale]/layout.tsx

```tsx
<NextIntlClientProvider messages={messages}>
  <PostHogProvider>          // src/providers/PostHogProvider.tsx
    {children}
  </PostHogProvider>
  <Toaster />                // src/components/ui/Sonner/Sonner.tsx — ONE mount only
</NextIntlClientProvider>
```

---

## src/components/

| Path | Type | Purpose |
|---|---|---|
| [src/components/ui/](../../../src/components/ui/) | dir | Primitive building blocks — no domain logic |
| [src/components/ui/Badge/](../../../src/components/ui/Badge/) | dir | Badge component |
| [src/components/ui/Button/](../../../src/components/ui/Button/) | dir | Button with CVA variants |
| [src/components/ui/Card/](../../../src/components/ui/Card/) | dir | Card + sub-components |
| [src/components/ui/Input/](../../../src/components/ui/Input/) | dir | Input with label/error/addon |
| [src/components/ui/Sonner/](../../../src/components/ui/Sonner/) | dir | `<Toaster />` Sonner wrapper |
| [src/components/ui/Typography/](../../../src/components/ui/Typography/) | dir | Typed heading/text variants |
| [src/components/ui/index.ts](../../../src/components/ui/index.ts) | file | Barrel — re-exports all ui components |
| [src/components/shared/](../../../src/components/shared/) | dir | Cross-feature reusable — may use i18n |
| [src/components/shared/LanguageSwitcher/](../../../src/components/shared/LanguageSwitcher/) | dir | Locale toggle |
| [src/components/shared/index.ts](../../../src/components/shared/index.ts) | file | Barrel |
| [src/components/layout/](../../../src/components/layout/) | dir | Page scaffolding |
| [src/components/layout/Header/](../../../src/components/layout/Header/) | dir | Site header |
| [src/components/layout/Footer/](../../../src/components/layout/Footer/) | dir | Site footer |
| [src/components/layout/PageWrapper/](../../../src/components/layout/PageWrapper/) | dir | Page layout wrapper |
| [src/components/layout/index.ts](../../../src/components/layout/index.ts) | file | Barrel |

### Four-file rule

```
ComponentName/
├── ComponentName.tsx          # Implementation — only file with logic
├── ComponentName.stories.tsx  # Storybook — satisfies Meta<typeof Component>
├── ComponentName.test.tsx     # Vitest + RTL — behavior tests
└── index.ts                   # Barrel only — no logic ever
```

shadcn-generated components are the exception — flat file at `src/components/ui/<name>.tsx`.

---

← [STRUCTURE.md](../STRUCTURE.md) | → [02 — Modules](./02-modules.md)
