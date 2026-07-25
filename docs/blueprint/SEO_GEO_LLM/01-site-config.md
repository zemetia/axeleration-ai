# SEO/GEO/LLM — 01: Site Config

← [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) | [Blueprint INDEX](../INDEX.md) | [02 — SEO →](./02-seo.md)

---

## File: `src/config/site.ts`

This is the **company brain** — the single file that an AI agent must read and understand before generating any SEO content. Every other layer (metadata, structured data, sitemap, LLMs.txt) derives from it.

---

## Purpose of Each Section

### Core identity
```ts
name: 'My Product',
tagline: 'One sentence that nails the value proposition.',
description: 'Two-sentence pitch: what, for whom, and how it differs.',
url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://example.com',
```
- `name` → Organization schema, OG `site_name`, LLMs.txt heading
- `tagline` → LLMs.txt blockquote, og:title fallback
- `description` → fallback meta description for every page
- `url` → canonical base, sitemap, structured data

### Company details
```ts
company: {
  legalName, foundedYear, industry,
  targetAudience,   // who the product serves
  problemSolved,    // the pain point — specific and factual
  solution,         // how the product solves it
  keyBenefits,      // 3-5 bullet-point benefits (feeds LLMs.txt + GEO copy)
  contactEmail,
  socialLinks,      // used in Organization schema sameAs array
}
```
These fields drive the Organization JSON-LD schema and the LLMs.txt "About" sections. **Write them as a marketing strategist**: specific numbers, concrete outcomes, no vague adjectives.

### SEO settings
```ts
seo: {
  titleTemplate: '%s | My Product',   // Next.js title template
  defaultTitle: 'My Product — ...',   // used when no page title is given
  twitterHandle: '@handle',
  locale: 'en_US',                    // OG locale default
}
```

### Pages registry
```ts
pages: {
  home: {
    path: '/',
    title: '...',        // what goes in <title> and OG title
    description: '...',  // what goes in meta description AND llms.txt
    changeFreq: 'weekly',
    priority: 1.0,
  },
  about: { ... },
  // Add one entry per public page
}
```

**Rule: every public page must have an entry here** before it goes live. The `description` must answer "what does a visitor gain from this page?" in one specific sentence.

---

## Adding a New Page — Required Steps

1. Add an entry to `siteConfig.pages` in `src/config/site.ts`
2. Write `title` and `description` from the visitor's intent, not from what the page contains
3. Call `buildMetadata()` in the page's `generateMetadata()` — see [02 — SEO](./02-seo.md)
4. Add a `<StructuredData>` `webPageSchema()` call in the page — see [03 — GEO](./03-geo.md)

---

## Writing Good Descriptions

| Bad | Good |
|---|---|
| "About page for My Product" | "Learn how My Product cuts Next.js setup from weeks to hours — our story, team, and open-source commitments." |
| "Home" | "My Product is a production-ready Next.js 16 template. Ship features from day one with TypeScript, Tailwind v4, next-intl, and full SEO / GEO support." |

Rules:
- Include the primary keyword in the first 11 words
- State a concrete benefit (time saved, problem solved, outcome gained)
- 140–160 characters for Google; first 120 chars matter most for AI snippets
- No "welcome to", no "this page contains", no filler phrases

---

← [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) | → [02 — SEO](./02-seo.md)
