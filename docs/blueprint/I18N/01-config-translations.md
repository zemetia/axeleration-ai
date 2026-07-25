# i18n — 01: Config, Messages, Translations, Metadata

← [I18N.md](../I18N.md) | [Blueprint INDEX](../INDEX.md) | [02 — Navigation, static gen, locales →](./02-navigation-static-locales.md)

---

## Configuration Files

| File | Export / Purpose |
|---|---|
| [src/i18n/routing.ts](../../../src/i18n/routing.ts) | `routing` — `defineRouting({ locales, defaultLocale, localePrefix })` |
| [src/i18n/navigation.ts](../../../src/i18n/navigation.ts) | `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` |
| [src/i18n/request.ts](../../../src/i18n/request.ts) | `getRequestConfig` — loads message JSON per locale per RSC render |
| [proxy.ts](../../../proxy.ts) | `intlMiddleware(request)` — locale detection + redirect (via `proxy.ts`, NOT `middleware.ts`) |
| [messages/](../../../messages/) | JSON translation files per locale |

---

## Routing Config (src/i18n/routing.ts)

```ts
export const routing = defineRouting({
  locales: ['en', 'id'] as const,
  defaultLocale: 'en',
  localePrefix: 'always',
  // every locale is always prefixed:
  // /about        → redirects to /en/about
  // /id/about     → serves Indonesian
});

export type Locale = (typeof routing.locales)[number];  // 'en' | 'id'
```

### Why `localePrefix: 'always'` (not `'as-needed'`)

| Mode | Default locale | Non-default | Effect |
|---|---|---|---|
| `'as-needed'` | `/about` (no prefix) | `/id/about` | `/*` is **not** redirected → inconsistent URLs, no locale in default paths |
| `'always'` | `/en/about` | `/id/about` | `/*` → **always** redirects to `/{locale}/*` — consistent, no missing-locale URLs |

**Always use `'always'`.** `'as-needed'` breaks the invariant that every route has a locale segment, which makes analytics, canonical URLs, and caching harder.

---

## Proxy Integration (proxy.ts)

`intlMiddleware` (created from `createMiddleware(routing)`) runs inside `proxy.ts` — **not** in a `middleware.ts` file (that convention is deprecated in Next.js 16).

```ts
// proxy.ts — relevant excerpt
const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // ...rate limit, api guard...
  return applySecurityHeaders(intlMiddleware(request));
}
```

`intlMiddleware` behaviour:
1. Reads `Accept-Language` header and locale cookie.
2. Redirects un-prefixed paths to `/{locale}/*` (because `localePrefix: 'always'`).
3. Prevents double-locale — `/en/en/about` can never be reached.

See [04-proxy.md](../ARCHITECTURE/04-proxy.md) for the full proxy flow.

---

## Message Files (messages/)

| Path | Namespace key |
|---|---|
| [messages/en/common.json](../../../messages/en/common.json) | `common` |
| [messages/en/navigation.json](../../../messages/en/navigation.json) | `navigation` |
| [messages/en/home.json](../../../messages/en/home.json) | `home` |
| [messages/id/common.json](../../../messages/id/common.json) | `common` |
| [messages/id/navigation.json](../../../messages/id/navigation.json) | `navigation` |
| [messages/id/home.json](../../../messages/id/home.json) | `home` |

Namespace key = JSON filename without extension. Loaded in `src/i18n/request.ts`:

```ts
return {
  locale,
  messages: {
    common:     (await import(`../../messages/${locale}/common.json`)).default,
    navigation: (await import(`../../messages/${locale}/navigation.json`)).default,
    home:       (await import(`../../messages/${locale}/home.json`)).default,
  },
};
```

---

## useTranslations (Server + Client)

`useTranslations` is isomorphic — same API in Server and Client Components.

```tsx
// Server Component
import { useTranslations } from 'next-intl';
export default function HomePage() {
  const t = useTranslations('home');
  return <h1>{t('hero.title')}</h1>;
}

// Client Component
'use client';
import { useTranslations } from 'next-intl';
export function Header() {
  const t = useTranslations('navigation');
  return <span>{t('home')}</span>;
}
```

Messages flow: Server layout → `NextIntlClientProvider` `messages` prop → client tree.

---

## generateMetadata

```ts
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return {
    title: { template: `%s | ${t('title')}`, default: t('title') },
    description: t('description'),
  };
}
```

`getTranslations` = async server-only counterpart to `useTranslations`. Use in `generateMetadata` and `generateStaticParams` only.

---

← [I18N.md](../I18N.md) | → [02 — Navigation, static gen, locales](./02-navigation-static-locales.md)
