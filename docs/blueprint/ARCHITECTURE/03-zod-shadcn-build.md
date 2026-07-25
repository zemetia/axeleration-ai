# Architecture — 03: Zod, shadcn/ui, Build Pipeline

← [02 — ApiClient, Sentry, PostHog](./02-apiclient-sentry-posthog.md) | [ARCHITECTURE.md](../ARCHITECTURE.md) | [Blueprint INDEX](../INDEX.md)

---

## Zod v4 Validation

```
src/lib/validations/common.ts
    emailSchema      z.string().min(1).email()
    passwordSchema   z.string().min(8).max(100)
    nameSchema       z.string().min(1).max(100).trim()
    urlSchema        z.string().url().optional()
    uuidSchema       z.string().uuid()
    paginationSchema z.object({ page: z.coerce.number().int().positive().default(1),
                                limit: z.coerce.number().int().positive().max(100).default(20) })
src/lib/validations/index.ts
    barrel → export * from './common'
```

### Validation placement rules

| Context | Rule |
|---|---|
| Client form | `schema.safeParse(formValues)` before submit |
| Server Action | validate `FormData` at top of action |
| API route | validate `await req.json()` before processing |
| Service layer | never — services trust typed input |

---

## shadcn/ui Integration

```
components.json
    style:       "new-york"
    rsc:         true
    tsx:         true
    utils:       "@/lib/cn"          ← cn() from src/lib/cn.ts
    ui:          "@/components/ui"   ← generated flat files land here
    iconLibrary: "lucide"            ← lucide-react installed

src/app/globals.css @theme {}
    ├── design system tokens (--color-primary, --color-surface, etc.)
    └── shadcn aliases:
        --color-popover, --color-popover-foreground
        --color-secondary, --color-secondary-foreground
        --color-muted, --color-muted-foreground
        --color-accent, --color-accent-foreground
        --color-sidebar-*, ...
```

Add component: `npx shadcn@latest add <name>` → lands at `src/components/ui/<name>.tsx` (flat, not a subdirectory).

Token mapping → [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).

---

## Build Pipeline

| Command | What it runs |
|---|---|
| `npm run dev` | `next dev --turbopack` |
| `npm run build` | `next build` → `withSentryConfig` wraps webpack |
| `npm run lint` | `eslint src --max-warnings 0` |
| `npm run type-check` | `tsc --noEmit` |
| `npm run test:run` | `vitest run` |
| `npm run storybook` | `storybook dev -p 6006` |

All four checks (`lint`, `type-check`, `test:run`, `build`) must pass before merge.

---

← [02 — ApiClient, Sentry, PostHog](./02-apiclient-sentry-posthog.md) | [ARCHITECTURE.md](../ARCHITECTURE.md)
