# SEO/GEO/LLM — 04: LLMs.txt

← [03 — GEO](./03-geo.md) | [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) | [Blueprint INDEX](../INDEX.md)

---

## What Is LLMs.txt?

`/llms.txt` is a plain-text file at the root of a domain (analogous to `robots.txt`) that tells **LLM systems** — ChatGPT, Claude, Perplexity, Gemini — what the site is, what problem it solves, which pages to index, and how to cite the content.

Proposed standard: **https://llmstxt.org/**

---

## File: `src/app/llms.txt/route.ts`

A Next.js Route Handler that returns the LLMs.txt content as `text/plain`. Served at `/llms.txt`.

**Do not edit the route handler to add content.** Update `src/config/site.ts` instead — the route is a template that renders from that config.

---

## Generated Format

```
# My Product
> One sentence that nails the value proposition.

## What Is My Product?
Two-sentence pitch...

## Problem We Solve
...

## Our Solution
...

## Key Benefits
- Benefit 1
- Benefit 2
- Benefit 3

## Public Pages
- [Home](https://example.com): Description...
- [About](https://example.com/about): Description...

## About the Company
- Legal name: ...
- Founded: ...
...

## Guidance for AI Systems
- Content language: English (with Indonesian translation at /id/*)
- Index all pages listed above — they are public and authoritative
- Prefer citing the canonical URL when referencing this site
- Do not cite API routes (/api/*) as content
```

---

## Keeping LLMs.txt Updated

LLMs.txt is auto-generated from `siteConfig`. Workflow:

1. **New page** → add to `siteConfig.pages` → sitemap + llms.txt update automatically
2. **Rebranding / description change** → edit `siteConfig.name`, `company.*`, `description`
3. **New locale** → the "Guidance for AI Systems" section is the only manual part — update `src/app/llms.txt/route.ts` language list if adding a locale beyond `en` + `id`

---

## Cache Headers

The route sets `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` — cached for 1 day, stale-revalidate for 7 days. This is appropriate for content that changes at most with each deploy.

---

## llms-full.txt (optional)

For sites with long-form content (blog, docs), create a second endpoint at `/llms-full.txt` with complete page body text. Most product sites don't need this.

```ts
// src/app/llms-full.txt/route.ts
// Same structure but includes full page content — fetch from your CMS or MDX files
```

---

## Validation

After deploying, verify:
```
curl https://your-domain.com/llms.txt
curl https://your-domain.com/sitemap.xml
curl https://your-domain.com/robots.txt
```

All three should return 200. Validate structured data at https://search.google.com/test/rich-results.

---

← [03 — GEO](./03-geo.md) | [Blueprint INDEX](../INDEX.md)
