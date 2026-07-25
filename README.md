# Zemetia Next.js Frontend Edition

> Ship professional, clean code with AI — from day one, on complex projects.

## The Problem

AI coding assistants produce inconsistent, unprofessional code when dropped cold into a codebase. Without knowing your conventions, patterns, and past mistakes, they invent their own — introducing technical debt at speed.

## The Solution

This template solves that with two systems:

**Blueprint** (`docs/blueprint/`) — a structured reference that tells the AI exactly how this codebase works: where files go, which patterns to use, what's banned and why. The AI reads the relevant section before writing any code, so it never guesses.

**Knowledge** (`docs/knowledge/`) — a living memory that grows with real collaboration:
- `THIS.md` — developer style, preferences, do's & don'ts
- `LEARN.md` — correction log: past mistakes and lessons (`[YYYY-MM-DD] - problem - solution - lesson`)

The AI contract file (`CLAUDE.md`) wires both together — it loads knowledge first, points to the blueprint, and enforces hard constraints that cannot be violated regardless of context.

**Result:** the AI behaves like a senior engineer who has read every architectural decision, knows every convention, and asks clarifying questions instead of making things up.

## Works with Any AI Tool

The AI contract is just a markdown file. Rename it to match your tool:

| Tool | File name |
|---|---|
| Claude Code | `CLAUDE.md` |
| Gemini | `GEMINI.md` |
| Cursor | `.cursorrules` or `cursor.md` |
| Windsurf | `.windsurfrules` |
| Any other agent | whatever the tool reads on startup |

Same blueprint, same knowledge system — different tool, same results.

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16 |
| Language | TypeScript strict | 6 |
| Styling | Tailwind CSS + design tokens | v4 |
| i18n | next-intl | v4 |
| Server state | TanStack Query | v5 |
| Global state | Zustand | v5 |
| Validation | Zod | v4 |
| Notifications | Sonner | v2 |
| Error monitoring | Sentry | v10 |
| Analytics | PostHog | latest |
| UI primitives | shadcn/ui + CVA | — |
| Icons | Lucide React | v1 |
| Testing | Vitest + RTL | v4 |
| Component explorer | Storybook | v10 |
| Linting | ESLint flat config | v9 |
| Formatting | Prettier + Tailwind plugin | v3 |

## What's Included

**Request & infrastructure**
- **Rate limiting** — sliding-window 60 req/min per IP on all `/api/*` routes, built into `proxy.ts` via `next-limitr`.
- **Security headers** — `HSTS`, `X-Frame-Options`, `CSP`, `Permissions-Policy` applied on every response.
- **Locale routing** — locale detection, cookie setting, and redirects handled in the proxy layer before any route renders.
- **Health check endpoint** — `/api/health` on Edge runtime, ready for uptime monitoring.

**Data & state**
- **TanStack Query v5** — all server data via queries and mutations. `useState` for API responses is banned.
- **Zustand v5** — global state with DevTools. Stores persist to cookies (not `localStorage`) so Server Components can read them via `next/headers` without a hydration flash.
- **Zod v4** — schema validation at all system boundaries. Canonical schemas in `src/lib/validations/`.

**API & services**
- **ApiClient pipeline** — typed `fetch` wrapper with request/response interceptors, `ApiError` classification, and Next.js cache integration. Components never call `fetch` directly.
- **Domain service pattern** — all API calls go through plain service objects in `src/services/`. No ad-hoc fetch calls anywhere.

**UI & styling**
- **Design token system** — all colors defined as `@theme {}` CSS custom properties. Raw hex and Tailwind color utilities are banned by convention and lint.
- **shadcn/ui + CVA** — accessible primitives (Button, Input, Badge, Card, Typography…) with `class-variance-authority` for type-safe variants.
- **Four-file component rule** — every UI component ships with: implementation, Storybook story, Vitest test, and barrel export.
- **Sonner v2** — toast notifications, single `<Toaster />` mount in the root layout.
- **Lucide React v1** — icon set paired with shadcn/ui.

**Internationalization**
- **next-intl v4** — EN + ID locales out of the box. `localePrefix: 'as-needed'` keeps `/about` clean in the default locale. All navigation via `@/i18n/navigation` — `next/navigation` is banned.

**Observability**
- **Sentry v10** — error monitoring. `displayName` required on every component for readable traces. No-op without `NEXT_PUBLIC_SENTRY_DSN`.
- **PostHog** — product analytics with page-view tracking. No-op without `NEXT_PUBLIC_POSTHOG_KEY`.

**SEO / GEO / LLMs.txt**
- `buildMetadata()` + `<StructuredData>` enforced on every public page.
- Sitemap, `robots.txt`, and `/llms.txt` route handlers — all driven by `src/config/site.ts`.
- JSON-LD schemas (WebPage, BreadcrumbList, FAQPage) for AI search overview citations (GEO).

**Quality**
- **ESLint v9 flat config** — zero warnings policy (`--max-warnings 0`).
- **Prettier v3** + Tailwind plugin — consistent formatting enforced in CI.
- **Vitest v4 + RTL** — unit and behavior tests per component.
- **Storybook v10** — component explorer with a story for every UI component.
- **TypeScript v6 strict** — `noUncheckedIndexedAccess`, `import type` enforced, no compromises.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
git clone <repository-url>
cd template-nextjs
npm install
cp .env.example .env.local
```

Minimum `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=MyApp
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Optional — no-ops without these keys
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

### Commands

```bash
# Development
npm run dev           # Turbopack dev server → http://localhost:3000
npm run storybook     # Component explorer  → http://localhost:6006

# Quality
npm run lint          # ESLint — must exit 0 (zero warnings)
npm run lint:fix
npm run type-check    # TypeScript — no emit
npm run format
npm run format:check  # CI

# Testing
npm run test          # Vitest watch
npm run test:run      # CI
npm run test:ui
npm run test:coverage

# Build
npm run build
npm run start
npm run build-storybook
```

## Project Structure

```
src/
├── app/[locale]/         # Pages — Server Components by default
├── components/
│   ├── ui/               # Primitives (Button, Input, Badge, Card…)
│   ├── layout/           # Header, Footer, PageWrapper
│   └── shared/           # Cross-feature components
├── hooks/                # Client-side hooks
├── i18n/                 # next-intl config + routing
├── lib/                  # cn, utils, Sentry, cookies
├── providers/            # PostHog provider
├── proxy/                # rate-limit, security-headers modules
├── services/             # ApiClient + domain services
├── stores/               # Zustand stores
└── types/                # Shared TypeScript types

messages/
├── en/                   # English translations
└── id/                   # Indonesian translations

proxy.ts                  # Request intercept entry (Next.js 16)
docs/blueprint/           # AI reference system
docs/knowledge/           # Living memory — style & correction log
```

---

Built by [Zemetia](https://zemetia.id) · MIT
