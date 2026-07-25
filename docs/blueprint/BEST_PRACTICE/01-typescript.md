# Best Practices — 01: TypeScript

← [BEST_PRACTICE.md](../BEST_PRACTICE.md) | [Blueprint INDEX](../INDEX.md) | [02 — React, ESLint, naming →](./02-react-eslint-naming.md)

Config: [tsconfig.json](../../../tsconfig.json)

---

## Strict Flags

| Flag | Effect |
|---|---|
| `"strict": true` | All strict checks enabled |
| `"noUncheckedIndexedAccess": true` | `array[n]` returns `T \| undefined` |
| `"noUnusedLocals": true` | Dead variables = compile error |
| `"noUnusedParameters": true` | Dead params = compile error |
| `"noImplicitReturns": true` | All code paths must return |
| `"noFallthroughCasesInSwitch": true` | Switch fallthrough = error |

---

## noUncheckedIndexedAccess

```ts
// ❌ type error
const name = items[0].name;

// ✅
const name = items[0]?.name;
if (items[0]) console.log(items[0].name);
```

---

## Exhaustive switch — use `assertNever` from src/lib/utils.ts

```ts
import { assertNever } from '@/lib/utils';

switch (variant) {
  case 'success': return '...';
  case 'error':   return '...';
  default: return assertNever(variant);  // compile error if a case is missing
}
```

---

## Type imports — enforced by ESLint `@typescript-eslint/consistent-type-imports`

```ts
// ✅
import type { ButtonProps } from './Button';
import { Button } from './Button';

// ❌ ESLint error
import { ButtonProps, Button } from './Button';
```

---

## unknown over any

```ts
function handle(err: unknown): void {
  if (err instanceof ApiError) { /* ... */ }
  if (err instanceof Error)    { /* ... */ }
}
```

---

## Env var access — bracket notation for noUncheckedIndexedAccess

```ts
// ✅
process.env['NEXT_PUBLIC_API_URL']

// ❌
process.env.NEXT_PUBLIC_API_URL
```

---

← [BEST_PRACTICE.md](../BEST_PRACTICE.md) | → [02 — React, ESLint, naming](./02-react-eslint-naming.md)
