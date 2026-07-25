# SEO/GEO/LLM — 02: SEO

← [01 — Site Config](./01-site-config.md) | [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) | [03 — GEO →](./03-geo.md)

---

## Files

| File | Purpose |
|---|---|
| [`src/lib/seo.ts`](../../../src/lib/seo.ts) | `buildMetadata()` — call in every page's `generateMetadata()` |
| [`src/app/sitemap.ts`](../../../src/app/sitemap.ts) | Auto-generates `/sitemap.xml` from `siteConfig.pages` |
| [`src/app/robots.ts`](../../../src/app/robots.ts) | Auto-generates `/robots.txt` |

---

## buildMetadata() — Required in Every Public Page

Every public page must export `generateMetadata`. Use `buildMetadata()` — never hand-write `Metadata` objects.

```ts
// src/app/[locale]/about/page.tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { siteConfig } from '@/config/site';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = siteConfig.pages['about'];
  return buildMetadata({
    title: page?.title,
    description: page?.description,
    path: '/about',
    locale,
  });
}
```

### What buildMetadata() produces

| Field | Source |
|---|---|
| `title` | `title` arg → `siteConfig.seo.titleTemplate` |
| `description` | `description` arg → `siteConfig.description` |
| `metadataBase` | `siteConfig.url` |
| `alternates.canonical` | locale-prefixed canonical URL |
| `alternates.languages` | hreflang for every `routing.locales` entry + `x-default` |
| `openGraph.*` | title, description, image, locale, type, siteName |
| `twitter.*` | card `summary_large_image`, title, description, image, creator |
| `robots` | `index:true, follow:true` (or noindex if `noIndex:true`) |

### noIndex pages

Auth pages, dashboards, and any non-public route:
```ts
return buildMetadata({ title: 'Login', path: '/login', locale, noIndex: true });
```

---

## i18n + hreflang

`buildMetadata()` automatically generates `alternates.languages` for every locale in `routing.locales`. No manual hreflang work needed.

Output for `/about` with locales `['en', 'id']`:
```html
<link rel="canonical" href="https://example.com/about" />
<link rel="alternate" hreflang="en" href="https://example.com/about" />
<link rel="alternate" hreflang="id" href="https://example.com/id/about" />
<link rel="alternate" hreflang="x-default" href="https://example.com/about" />
```

---

## Sitemap

`src/app/sitemap.ts` is auto-generated — **do not edit it directly**.

Add/remove pages only via `siteConfig.pages`. The sitemap produces one URL per `page × locale`. Served at `/sitemap.xml`.

Priority guide:
| Page type | `priority` |
|---|---|
| Home | `1.0` |
| Core product/feature | `0.9` |
| Secondary (about, pricing) | `0.8` |
| Blog post | `0.6` |
| Archive/list | `0.5` |

---

## robots.txt

Auto-generated at `/robots.txt` by `src/app/robots.ts`. Default allows all bots, disallows `/api/` and `/_next/`. Points to `/sitemap.xml`.

To block a specific bot (e.g. during a private beta):
```ts
// src/app/robots.ts
rules: [
  { userAgent: 'Googlebot', allow: '/' },
  { userAgent: '*', disallow: '/' },   // block all others during beta
],
```

---

## OG Image

1. Place the image at `public/og.png` (1200×630 px)
2. Update `siteConfig.ogImage` if the path differs
3. For per-page OG images, generate with Next.js `ImageResponse`:
   - Create `src/app/[locale]/about/opengraph-image.tsx`
   - Return `<ImageResponse>` — see [Next.js docs on OG images](https://nextjs.org/docs/app/api-reference/file-conventions/opengraph-image)

---

← [01 — Site Config](./01-site-config.md) | → [03 — GEO](./03-geo.md)
