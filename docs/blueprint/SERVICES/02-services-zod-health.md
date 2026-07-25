# Services — 02: Domain Services, Zod, Health Endpoint

← [01 — ApiClient, errors, interceptors](./01-apiclient-error-interceptors.md) | [SERVICES.md](../SERVICES.md) | [Blueprint INDEX](../INDEX.md)

---

## Domain Service Pattern

One file per domain resource. Services are plain objects — no React, no hooks.

```ts
// src/services/user.service.ts
import { apiClient } from './client';
import type { User, CreateUserInput, UpdateUserInput } from '@/types';

export const userService = {
  list:   (): Promise<User[]>         => apiClient.get('/users', { revalidate: 30, tags: ['users'] }),
  get:    (id: string): Promise<User> => apiClient.get(`/users/${id}`, { tags: [`user-${id}`] }),
  create: (data: CreateUserInput): Promise<User>  => apiClient.post('/users', data),
  update: (id: string, data: UpdateUserInput): Promise<User> => apiClient.patch(`/users/${id}`, data),
  remove: (id: string): Promise<void> => apiClient.delete(`/users/${id}`),
};
```

Export from [src/services/index.ts](../../../src/services/index.ts) barrel.

---

## Server vs Client Usage

| Context | Can use apiClient? | Notes |
|---|---|---|
| Server Component | ✅ | `cache`/`revalidate`/`tags` work here |
| Server Action (`'use server'`) | ✅ | Use `cache: 'no-store'` for mutations |
| Client Component (`'use client'`) | ✅ | `cache`/`revalidate`/`tags` ignored client-side |
| API Route (`route.ts`) | ✅ | Typically pass-through or aggregation |
| Middleware | ⚠️ | Edge runtime — use `fetch` directly |

---

## Zod Validation (src/lib/validations/)

Package: zod v4.4.3

### Available schemas

```ts
import {
  emailSchema,       // z.string().min(1).email()
  passwordSchema,    // z.string().min(8).max(100)
  nameSchema,        // z.string().min(1).max(100).trim()
  urlSchema,         // z.string().url().optional()
  uuidSchema,        // z.string().uuid()
  paginationSchema,  // z.object({ page: coerce.number default 1, limit: coerce.number max 100 default 20 })
  type PaginationInput,
} from '@/lib/validations';
```

### Composing feature schemas

```ts
// src/lib/validations/auth.ts
import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginInput    = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
```

### Server Action pattern

```ts
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

## Health Endpoint

```
GET /api/health
→ { status: 'ok', timestamp: string, version: string }
```

Implementation: [src/app/api/health/route.ts](../../../src/app/api/health/route.ts) — Edge runtime, no DB calls.
Client: [src/services/health.service.ts](../../../src/services/health.service.ts) — `healthService.check(): Promise<HealthResponse>`.

---

← [01 — ApiClient, errors, interceptors](./01-apiclient-error-interceptors.md) | [SERVICES.md](../SERVICES.md)
