# Next.js Template

## CRITICAL — Read Before Anything Else

> These two files are the most important context in this project. Read them at the start of every task, before touching any blueprint section or code.

| File | Purpose |
|---|---|
| [docs/knowledge/THIS.md](docs/knowledge/THIS.md) | Developer style, project identity, do's & don'ts, ongoing insights |
| [docs/knowledge/LEARN.md](docs/knowledge/LEARN.md) | Past mistakes and corrections — read to avoid repeating them |

**Writing rules:**
- After any task where a new insight or preference is discovered → append to `THIS.md`
- When the user corrects the AI, or the AI self-identifies a mistake → append to `LEARN.md` immediately using format: `[YYYY-MM-DD] - [problem] - [solution] - [lesson]`

---

> **AI agents — before planning any fix or feature:** identify which blueprint sections cover the affected area, read them first, then plan. Do not guess at patterns — the blueprint is the source of truth.

## Blueprint

| Section | File |
|---|---|
| Index + hard constraints + checklists | [docs/blueprint/INDEX.md](docs/blueprint/INDEX.md) |
| Project structure + file locations | [docs/blueprint/STRUCTURE.md](docs/blueprint/STRUCTURE.md) |
| Request lifecycle + integrations | [docs/blueprint/ARCHITECTURE.md](docs/blueprint/ARCHITECTURE.md) |
| **Middleware/rate limit/security headers** | [docs/blueprint/ARCHITECTURE/04-proxy.md](docs/blueprint/ARCHITECTURE/04-proxy.md) |
| Components + CVA + tests | [docs/blueprint/COMPONENTS.md](docs/blueprint/COMPONENTS.md) |
| Design tokens + Tailwind v4 | [docs/blueprint/DESIGN_SYSTEM.md](docs/blueprint/DESIGN_SYSTEM.md) |
| Services + API client + Zod | [docs/blueprint/SERVICES.md](docs/blueprint/SERVICES.md) |
| Zustand state + persistence | [docs/blueprint/STATE.md](docs/blueprint/STATE.md) |
| i18n + routing + translations | [docs/blueprint/I18N.md](docs/blueprint/I18N.md) |
| TypeScript + ESLint + anti-patterns | [docs/blueprint/BEST_PRACTICE.md](docs/blueprint/BEST_PRACTICE.md) |
| **SEO + GEO + LLMs.txt** | [docs/blueprint/SEO_GEO_LLM.md](docs/blueprint/SEO_GEO_LLM.md) |
| **Knowledge system rules** | [docs/blueprint/KNOWLEDGE.md](docs/blueprint/KNOWLEDGE.md) |

## Stack snapshot

Next.js 16 · TypeScript 6 (strict) · Tailwind v4 · next-intl v4 · TanStack Query v5 · Zustand v5 · Zod v4 · Sonner · Sentry · PostHog · Vitest

## Non-negotiables

- Navigation: always `@/i18n/navigation`, never `next/navigation`
- Server data: TanStack Query only — no `useState` for API responses
- Colors: design tokens only — no raw hex / oklch / Tailwind color utilities
- `npm run lint` must exit 0 (`--max-warnings 0`)
- `'use client'` only when required (hook / event / browser API)
- Services are plain objects — never call `fetch`/`apiClient` directly in components
- Request intercept logic goes in `src/middleware.ts` (export `middleware`); modules in `src/proxy/` — do NOT use root `proxy.ts` (known production/Windows bugs in Next.js 16)
- Every public page must call `buildMetadata()` in `generateMetadata()` and render `<StructuredData>` — see `docs/blueprint/SEO_GEO_LLM.md`
- All SEO/GEO/LLMs.txt content is driven by `src/config/site.ts` — edit that file, not the route handlers
