# SEO · GEO · LLMs.txt

← [Blueprint INDEX](./INDEX.md)

> **AI agents — read this before touching any page or adding any content.**  
> You are acting as a marketing strategist. Every public page must earn traffic from search engines, AI overviews, and LLM citations. Read `src/config/site.ts` first to understand the product's purpose and audience, then apply the patterns below.

---

## What This Covers

| Layer | Goal | Standard |
|---|---|---|
| **SEO** | Rank in traditional search | Title, description, OG, Twitter, canonical, hreflang, sitemap, robots |
| **GEO** | Be cited in AI search overviews | JSON-LD structured data, clear factual statements, FAQPage schema |
| **LLMs.txt** | Be understood by LLM systems | `/llms.txt` route describing site purpose and page index |

---

## Document Map

| Part | Coverage |
|---|---|
| [01 — Site Config](./SEO_GEO_LLM/01-site-config.md) | `src/config/site.ts` — the company brain driving all layers |
| [02 — SEO](./SEO_GEO_LLM/02-seo.md) | `buildMetadata()`, sitemap, robots, OpenGraph, Twitter, hreflang |
| [03 — GEO](./SEO_GEO_LLM/03-geo.md) | JSON-LD schemas, `StructuredData` component, GEO writing strategy |
| [04 — LLMs.txt](./SEO_GEO_LLM/04-llms-txt.md) | `/llms.txt` route handler, format, update workflow |

---

## How the Layers Relate

```
src/config/site.ts          ← single source of truth
    │
    ├── src/lib/seo.ts           → buildMetadata() → every page's generateMetadata()
    ├── src/lib/structured-data.ts → JSON-LD schemas → <StructuredData> in pages
    ├── src/app/sitemap.ts       → /sitemap.xml
    ├── src/app/robots.ts        → /robots.txt
    └── src/app/llms.txt/route.ts → /llms.txt
```

---

## Marketing Strategist Mindset

Before writing any metadata or content, ask:

1. **What search query would bring the right visitor here?** — write the title and description to match that query.
2. **What factual statement would an AI overview cite?** — put it in the first paragraph, use numbers and specifics.
3. **Would an LLM know what this page is for?** — the description in `siteConfig.pages` is what appears in `/llms.txt`.

---

← [Blueprint INDEX](./INDEX.md)
