# State — 01: App Store, Cookie Storage, Cookie Utilities

← [STATE.md](../STATE.md) | [Blueprint INDEX](../INDEX.md) | [02 — New store, patterns →](./02-new-store-patterns.md)

---

## File Map

| File | Export | Purpose |
|---|---|---|
| [src/stores/app.store.ts](../../../src/stores/app.store.ts) | `useAppStore` | Global UI: `theme`, `sidebarOpen` |
| [src/stores/middleware/cookie-storage.ts](../../../src/stores/middleware/cookie-storage.ts) | `createCookieStorage` | Zustand persist adapter via `document.cookie` |
| [src/stores/index.ts](../../../src/stores/index.ts) | barrel | `useAppStore`, `createCookieStorage` |

---

## App Store (src/stores/app.store.ts)

### State interface

```ts
interface AppState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
}

interface AppActions {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}
```

### Middleware stack

```ts
export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      (set) => ({ ... }),
      {
        name: 'app',                                    // cookie key: zst_app
        storage: createCookieStorage({ maxAge: 31536000 }),
        partialize: (state) => ({ theme: state.theme }), // persist theme only
      },
    ),
    { name: 'AppStore' },                               // Redux DevTools label
  ),
);
```

`sidebarOpen` not persisted — session-local UI state.

### Usage

```ts
import { useAppStore } from '@/stores';

// ✅ selector — re-renders only when theme changes
const theme    = useAppStore((s) => s.theme);
const setTheme = useAppStore((s) => s.setTheme);

// ❌ whole store — re-renders on any change
const store = useAppStore();
```

---

## Cookie Storage Adapter (src/stores/middleware/cookie-storage.ts)

```ts
export function createCookieStorage<T>(options?: CookieStorageOptions): PersistStorage<T>
```

Cookie key format: `<prefix>_<storeName>` — default prefix `zst` → e.g. `zst_app`.

### CookieStorageOptions

```ts
interface CookieStorageOptions {
  prefix?:   string;                          // default 'zst'
  path?:     string;                          // default '/'
  domain?:   string;
  maxAge?:   number;                          // seconds
  expires?:  Date;
  secure?:   boolean;                         // auto-enabled in production
  sameSite?: 'Strict' | 'Lax' | 'None';     // default 'Lax'
}
```

**Why cookies not localStorage:** Cookies are in HTTP request headers → Server Components can read them before rendering → SSR applies correct theme class before browser paint → no flash-of-wrong-theme.

---

## Cookie Utilities (src/lib/cookies.ts)

Client-side only (`document.cookie`):

```ts
getCookie(name: string): string | undefined
setCookie(name: string, value: string, options?: CookieOptions): void
deleteCookie(name: string, options?: CookieOptions): void
getAllCookies(): Record<string, string>
parseCookieHeader(header: string): Record<string, string>   // Edge/middleware use
```

Server-side cookie access (Server Components, Server Actions, middleware):
```ts
import { cookies } from 'next/headers';

const cookieStore = await cookies();
const theme = cookieStore.get('zst_app')?.value;
```

---

← [STATE.md](../STATE.md) | → [02 — New store, patterns](./02-new-store-patterns.md)
