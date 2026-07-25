/**
 * Structured data (JSON-LD) helpers for GEO — Generative Engine Optimization.
 * These schemas make content citable and indexable by AI search engines
 * (Perplexity, ChatGPT Browse, Google AI Overviews, Bing Copilot).
 *
 * Usage in a Server Component:
 * ```tsx
 * import { StructuredData, organizationSchema } from '@/lib/structured-data';
 * <StructuredData id="org" schema={organizationSchema()} />
 * ```
 */

import { siteConfig } from '@/config/site';

// ─── Type stubs (avoid @types/schema-dts as a dep) ───────────────────────────

interface WithContext<T> {
  '@context': 'https://schema.org';
  '@type': T extends { '@type': infer U } ? U : string;
  [key: string]: unknown;
}

// ─── Schema builders ─────────────────────────────────────────────────────────

/** Organization schema — attach once in the root layout or home page. */
export function organizationSchema(): WithContext<unknown> {
  const { company, name, url, ogImage } = siteConfig;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.legalName,
    alternateName: name,
    url,
    logo: {
      '@type': 'ImageObject',
      url: `${url}${ogImage}`,
    },
    foundingDate: String(company.foundedYear),
    email: company.contactEmail,
    description: siteConfig.description,
    sameAs: Object.values(company.socialLinks).filter(Boolean),
  };
}

export interface WebPageSchemaOptions {
  name: string;
  description: string;
  url: string;
  /** ISO 8601, e.g. '2024-01-01' */
  datePublished?: string;
  dateModified?: string;
}

/** WebPage schema — attach to every public page. */
export function webPageSchema(opts: WebPageSchemaOptions): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    isPartOf: { '@type': 'WebSite', url: siteConfig.url, name: siteConfig.name },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    inLanguage: 'en',
  };
}

export interface FAQ {
  question: string;
  answer: string;
}

/**
 * FAQPage schema — drives rich result FAQ snippets in Google and answer boxes
 * in AI search engines. Add to any page with a FAQ section.
 */
export function faqSchema(faqs: FAQ[]): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** BreadcrumbList schema — improves SERP display and helps AI understand site structure. */
export function breadcrumbSchema(items: BreadcrumbItem[]): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ArticleSchemaOptions {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  image?: string;
}

/** Article schema — use on blog posts, changelog entries, and docs pages. */
export function articleSchema(opts: ArticleSchemaOptions): WithContext<unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: {
      '@type': 'Organization',
      name: siteConfig.company.legalName,
      url: siteConfig.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.company.legalName,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.url}${siteConfig.ogImage}`,
      },
    },
    image: opts.image ?? `${siteConfig.url}${siteConfig.ogImage}`,
    isPartOf: { '@type': 'WebSite', url: siteConfig.url },
  };
}

// ─── Serialization helper ─────────────────────────────────────────────────────

/**
 * Serialize a schema to a safe JSON string for dangerouslySetInnerHTML.
 * JSON.stringify escapes all HTML special characters — no XSS risk.
 *
 * Usage in a Server Component (page.tsx):
 * ```tsx
 * import { serializeSchema, webPageSchema } from '@/lib/structured-data';
 *
 * export default function Page() {
 *   return (
 *     <>
 *       <script
 *         id="webpage-schema"
 *         type="application/ld+json"
 *         dangerouslySetInnerHTML={{ __html: serializeSchema(webPageSchema({ ... })) }}
 *       />
 *       {/* page content *\/}
 *     </>
 *   );
 * }
 * ```
 */
export function serializeSchema(schema: WithContext<unknown> | WithContext<unknown>[]): string {
  return JSON.stringify(schema);
}
