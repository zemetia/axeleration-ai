# Best Practices — 03: Anti-Patterns, Zod Placement, Performance

← [02 — React, ESLint, naming](./02-react-eslint-naming.md) | [BEST_PRACTICE.md](../BEST_PRACTICE.md) | [Blueprint INDEX](../INDEX.md)

---

## Anti-Patterns

### next/navigation direct import
```ts
// ❌ breaks locale context
import { useRouter } from 'next/navigation';
// ✅
import { useRouter } from '@/i18n/navigation';
```

### Hard-coded colors
```tsx
// ❌
<div className="bg-blue-500 text-white">
// ✅
<div className="bg-primary text-primary-foreground">
```

### Multiple Toaster mounts
```tsx
// ❌ already mounted in layout.tsx
export default function Page() { return <><Toaster /><PageContent /></>; }
// ✅ one mount only in src/app/[locale]/layout.tsx
```

### Client fetch when server fetch is possible
```tsx
// ❌
'use client';
export function ProductList() {
  const [data, setData] = useState([]);
  useEffect(() => { fetch('/api/products').then(...) }, []);
}
// ✅ Server Component
export default async function ProductList() {
  const products = await productService.list();
  return products.map(p => <ProductCard key={p.id} product={p} />);
}
```

### Generic error handling (loses ApiError context)
```ts
// ❌
try { await apiClient.post('/user', data); }
catch { toast.error('Something went wrong'); }

// ✅
import { ApiError } from '@/services';
import { captureError } from '@/lib/sentry';
try { await apiClient.post('/user', data); }
catch (err) {
  if (err instanceof ApiError) {
    if (err.isUnauthorized()) { redirect('/login'); return; }
    if (err.isNetworkError()) { toast.error('No internet connection'); return; }
    if (err.isServerError()) { captureError(err); toast.error('Server error.'); return; }
    toast.error(err.message);
  }
}
```

### Logic in barrel files
```ts
// ❌
export const BUTTON_SIZES = ['sm', 'md', 'lg'];  // belongs in Button.tsx
// ✅
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

### Inline design token values
```tsx
// ❌
<div style={{ backgroundColor: 'oklch(0.623 0.214 259.8)' }}>
// ✅ CSS variable (when no utility class exists)
<div style={{ background: 'var(--color-primary)' }}>
// ✅✅ Tailwind utility (preferred)
<div className="bg-primary">
```

---

## Zod Validation Placement

| Context | Rule |
|---|---|
| Client form | `schema.safeParse(formValues)` before submit |
| Server Action | validate `FormData` at top of action |
| API route handler | validate `await req.json()` before processing |
| Service layer | never — services trust typed input |

```ts
// ✅ Server Action pattern
'use server';
import { loginSchema } from '@/lib/validations';

export async function loginAction(formData: FormData) {
  const result = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }
  return authService.login(result.data);
}
```

---

## Performance Checklist

| Item | How |
|---|---|
| Server Components for data-fetch paths | No `useEffect` + `fetch` |
| `generateStaticParams` on locale layouts | Already in `src/app/[locale]/layout.tsx` |
| Image formats | `image/avif` + `image/webp` in `next.config.ts` |
| Custom fonts via next/font | Never `<link>` to Google Fonts |
| `'use client'` at leaf nodes | Push boundary as deep as possible |
| Suspense around `useSearchParams` | Required — see `src/providers/PostHogProvider.tsx` |

---

← [02 — React, ESLint, naming](./02-react-eslint-naming.md) | [BEST_PRACTICE.md](../BEST_PRACTICE.md)
