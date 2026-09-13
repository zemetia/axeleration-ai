# Best Practices — 02: React, ESLint, Import Aliases, Naming

← [01 — TypeScript](./01-typescript.md) | [BEST_PRACTICE.md](../BEST_PRACTICE.md) | [03 — Anti-patterns, performance →](./03-antipatterns-perf.md)

---

## React Patterns

### Server vs Client Components

Default is **Server Component** (no directive). Add `'use client'` only when the component:

| Needs | Requires client |
|---|---|
| `useState`, `useEffect`, `useRef` | yes |
| `window`, `document`, browser API | yes |
| Event handlers (`onClick`, `onChange`) | yes |
| Client context consumer | yes |
| Async data fetch, no interactivity | no — stay Server |

### No setState in useEffect — ESLint rule `react-hooks/set-state-in-effect` enforced

```ts
// ❌ ESLint error
useEffect(() => { setMounted(true); }, []);

// ✅ useSyncExternalStore for SSR-safe browser detection
const isMounted = useSyncExternalStore(
  (_: () => void) => () => {},  // subscribe no-op (prefix _ for noUnusedParameters)
  () => true,                   // client snapshot
  () => false,                  // server snapshot
);
```

Used in: [src/hooks/useBreakpoint.ts](../../../src/hooks/useBreakpoint.ts)

### forwardRef

All interactive UI components (button, input, anchor) use `forwardRef`. Non-interactive do not.

### displayName

```ts
Button.displayName = 'Button';
```

Required by Sentry `reactComponentAnnotation`, React DevTools, and Storybook component naming.

---

## ESLint

Config: [eslint.config.mjs](../../../eslint.config.mjs) — `npm run lint` → `eslint src --max-warnings 0`

| Rule | Enforcement |
|---|---|
| `@typescript-eslint/consistent-type-imports` | Force `import type` for type-only |
| `@typescript-eslint/no-unused-vars` | No dead variables |
| `react-hooks/rules-of-hooks` | Hooks at component top level only |
| `react-hooks/set-state-in-effect` | No `setState` inside `useEffect` |
| `@next/next/no-html-link-for-pages` | Use `<Link>` from `next/link` |

Unused-but-required params: prefix with `_`:
```ts
const subscribe = (_: () => void) => () => {};
```

---

## Import Aliases

`@/` maps to `src/` — always use the alias.

```ts
// ✅
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks';

// ❌
import { cn } from '../../lib/cn';
```

**Import order (enforced):**
1. React / next
2. Third-party packages
3. `@/` aliases: `lib → hooks → stores → services → components`
4. Relative imports

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| React components | PascalCase | `UserProfile`, `ProjectCard` |
| Hooks | `use` prefix + camelCase | `useToast`, `useBreakpoint` |
| Zustand stores | `use` prefix + `Store` suffix | `useAppStore`, `useCartStore` |
| Services | camelCase + `Service` suffix | `healthService`, `userService` |
| Types / interfaces | PascalCase | `ButtonProps`, `ApiError` |
| Zod schemas | camelCase + `Schema` suffix | `loginSchema`, `emailSchema` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `BREAKPOINTS` |
| CSS classes | kebab-case (Tailwind) | `container-page`, `text-balance` |

---

## File and Folder Naming

| Item | Convention |
|---|---|
| Component directories/files | PascalCase — `Button/Button.tsx` |
| All other files | camelCase — `useToast.ts`, `health.service.ts` |
| Route segments | lowercase — App Router convention |

---

← [01 — TypeScript](./01-typescript.md) | [BEST_PRACTICE.md](../BEST_PRACTICE.md) | → [03 — Anti-patterns, performance](./03-antipatterns-perf.md)
