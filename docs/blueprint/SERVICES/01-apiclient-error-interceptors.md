# Services — 01: ApiClient, ApiError, Interceptors

← [SERVICES.md](../SERVICES.md) | [Blueprint INDEX](../INDEX.md) | [02 — Domain services, Zod →](./02-services-zod-health.md)

---

## File Map

| File | Export | Purpose |
|---|---|---|
| [src/services/types.ts](../../../src/services/types.ts) | `ApiError`, `RequestConfig`, interceptor types | All shared service types |
| [src/services/client.ts](../../../src/services/client.ts) | `apiClient` | Singleton `ApiClientInstance` |
| [src/services/health.service.ts](../../../src/services/health.service.ts) | `healthService` | Example domain service |
| [src/services/index.ts](../../../src/services/index.ts) | barrel | `apiClient`, `ApiError`, all services |

---

## ApiClient (src/services/client.ts)

```ts
export const apiClient = new ApiClientInstance({
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? '',
  timeout: 10_000,   // ms — per-request AbortController
});
```

### Methods

```ts
apiClient.get<T>(path: string, config?: RequestConfig): Promise<T>
apiClient.post<T>(path: string, body: unknown, config?: RequestConfig): Promise<T>
apiClient.put<T>(path: string, body: unknown, config?: RequestConfig): Promise<T>
apiClient.patch<T>(path: string, body: unknown, config?: RequestConfig): Promise<T>
apiClient.delete<T>(path: string, config?: RequestConfig): Promise<T>
```

All return `Promise<T>`. Throw `ApiError` on non-2xx responses.

### RequestConfig (src/services/types.ts)

```ts
interface RequestConfig {
  headers?:         Record<string, string>;
  cache?:           RequestCache;          // 'no-store' | 'force-cache' | etc.
  revalidate?:      number | false;        // Next.js ISR — seconds until revalidation
  tags?:            string[];              // Next.js cache tags for on-demand revalidation
  signal?:          AbortSignal;           // combined with internal timeout signal
  timeout?:         number;               // per-request ms override, 0 = disabled
  withCredentials?: boolean;
}
```

### Next.js cache usage (Server Components only)

```ts
const data = await apiClient.get<Product[]>('/products', { revalidate: 60 });
const data = await apiClient.get<Product[]>('/products', { tags: ['products'] });
const data = await apiClient.get<User>('/me', { cache: 'no-store' });
```

---

## ApiError (src/services/types.ts)

```ts
class ApiError extends Error {
  status: number;    // HTTP status. 0 = network error (no response)
  body?: unknown;    // Parsed response body if available

  isNotFound():      boolean  // status === 404
  isUnauthorized():  boolean  // status === 401
  isForbidden():     boolean  // status === 403
  isServerError():   boolean  // status >= 500
  isNetworkError():  boolean  // status === 0
}
```

### Error handling pattern

```ts
import { ApiError } from '@/services';
import { captureError } from '@/lib/sentry';

try { await apiClient.post('/checkout', cartData); }
catch (err) {
  if (err instanceof ApiError) {
    if (err.isUnauthorized()) { redirect('/login'); return; }
    if (err.isNetworkError()) { toast.error('Check your internet connection'); return; }
    if (err.isServerError()) {
      captureError(err, { action: 'checkout' });
      toast.error('Server error. Our team has been notified.');
      return;
    }
    toast.error(err.message);
  }
}
```

---

## Interceptors (src/services/client.ts)

Register on the singleton. Best location: `src/services/interceptors.ts`, imported once in `src/app/[locale]/layout.tsx`.

```ts
// src/services/interceptors.ts
import { apiClient } from '@/services';
import { getCookie } from '@/lib/cookies';
import { captureError } from '@/lib/sentry';

apiClient.interceptors.request.use((ctx) => {
  const token = getCookie('access_token');
  if (token) ctx.headers['Authorization'] = `Bearer ${token}`;
  return ctx;
});

apiClient.interceptors.response.use((data) => {
  return (data as { data: unknown }).data ?? data;
});

apiClient.interceptors.error.use((err) => {
  if (err.isServerError()) captureError(err);
  throw err;
});
```

```ts
// src/app/[locale]/layout.tsx — side-effect import, registers once
import '@/services/interceptors';
```

### Interceptor type signatures

```ts
type RequestInterceptorFn  = (ctx: RequestContext) => RequestContext | Promise<RequestContext>;
type ResponseInterceptorFn = <T>(data: T, response: Response) => T | Promise<T>;
type ErrorInterceptorFn    = (error: ApiError) => never | Promise<never>;
```

---

← [SERVICES.md](../SERVICES.md) | → [02 — Domain services, Zod](./02-services-zod-health.md)
