# SEO/GEO/LLM — 03: GEO (Generative Engine Optimization)

← [02 — SEO](./02-seo.md) | [SEO_GEO_LLM.md](../SEO_GEO_LLM.md) | [04 — LLMs.txt →](./04-llms-txt.md)

---

## What GEO Is

GEO is the practice of making content **citable and indexable by AI search engines** — Google AI Overviews, Perplexity, ChatGPT Browse, and Bing Copilot.

Where traditional SEO wins clicks, GEO wins **citations in AI-generated answers**. Both matter. GEO content is: specific, factual, structured with clear headings, and answers questions directly.

---

## File: `src/lib/structured-data.ts`

Exports schema builders and a `serializeSchema()` serializer. Render schemas as raw `<script>` tags in Server Components (safe — `JSON.stringify` escapes all HTML).

| Export | Schema type | Use on |
|---|---|---|
| `organizationSchema()` | `Organization` | Root layout or home page — once per site |
| `webPageSchema(opts)` | `WebPage` | Every public page |
| `faqSchema(faqs)` | `FAQPage` | Any page with a FAQ section |
| `breadcrumbSchema(items)` | `BreadcrumbList` | All pages except home |
| `articleSchema(opts)` | `Article` | Blog posts, changelog, docs |
| `serializeSchema(schema)` | — | Converts a schema to a JSON string for `dangerouslySetInnerHTML` |

---

## Using Structured Data in Pages

Inline the `<script>` tag in your Server Component. This is the standard Next.js App Router pattern — no extra wrapper component needed:

```tsx
// src/app/[locale]/about/page.tsx
import { serializeSchema, webPageSchema, breadcrumbSchema } from '@/lib/structured-data';
import { siteConfig } from '@/config/site';

export default function AboutPage() {
  return (
    <>
      <script
        id="webpage-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSchema(
            webPageSchema({
              name: 'About My Product',
              description: siteConfig.pages['about']?.description ?? '',
              url: `${siteConfig.url}/about`,
              datePublished: '2024-01-01',
            })
          ),
        }}
      />
      <script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSchema(
            breadcrumbSchema([
              { name: 'Home', url: siteConfig.url },
              { name: 'About', url: `${siteConfig.url}/about` },
            ])
          ),
        }}
      />
      {/* page content */}
    </>
  );
}
```

### Organization schema — root layout (once per site)

```tsx
// src/app/[locale]/layout.tsx
import { serializeSchema, organizationSchema } from '@/lib/structured-data';

// Inside the layout JSX:
<script
  id="org-schema"
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: serializeSchema(organizationSchema()) }}
/>
```

---

## FAQ Schema

Use on any page that has a Q&A section. This drives "People also ask" rich results and populates AI answer boxes.

```tsx
import { serializeSchema, faqSchema } from '@/lib/structured-data';

const faqs = [
  {
    question: 'How long does it take to set up My Product?',
    answer: 'Under 5 minutes — clone, run npm install, copy .env.example to .env.local, and run npm run dev.',
  },
  {
    question: 'Does My Product support TypeScript?',
    answer: 'Yes. My Product is built with TypeScript 6 in strict mode with noUncheckedIndexedAccess.',
  },
];

<script
  id="faq-schema"
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: serializeSchema(faqSchema(faqs)) }}
/>
```

---

## GEO Content Strategy

Structured data alone is not enough. The **content itself** must be GEO-optimized:

### 1. Answer the question directly in the first sentence
AI overviews pull the most direct answer. Lead with the answer, then explain.

```
❌ "In this guide, we will explore what a Next.js template is and why you might want one."
✅ "A Next.js template is a pre-configured codebase with decisions about TypeScript, state, i18n, and design already made — so teams start with features instead of boilerplate."
```

### 2. Use specific numbers and facts
AI systems prefer citable specifics over vague claims.

```
❌ "saves a lot of time"
✅ "eliminates ~40 hours of setup per project"
```

### 3. Structured headings hierarchy
Use H2 for major sections, H3 for sub-topics. AI parsers treat headings as topic signals.

### 4. FAQ sections on key pages
Every product/feature page benefits from a FAQ section. Include real questions from `targetAudience`.

### 5. Entity clarity
Mention the product name, company name, and core use case in the first 100 words of body copy. This trains entity recognition.

### 6. Cite authoritative sources when relevant
AI search engines trust pages that link to primary sources (MDN, official docs, research papers).

---

## Speakable / Voice (optional)

For content meant to answer spoken queries, add `speakable` to the WebPage schema:

```ts
// extend webPageSchema output manually if needed:
{
  ...webPageSchema(opts),
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', '.summary', '.faq-answer'],
  },
}
```

---

← [02 — SEO](./02-seo.md) | → [04 — LLMs.txt](./04-llms-txt.md)
