/**
 * Central "company brain" — single source of truth for all SEO, GEO, and LLMs.txt.
 * Edit this file first whenever you add a page or change brand/product details.
 * Every field here propagates to: metadata, sitemap, robots.txt, structured data, llms.txt.
 */

import type { MetadataRoute } from 'next';

export type SitemapChangeFreq = NonNullable<
  MetadataRoute.Sitemap[number]['changeFrequency']
>;

export interface PageConfig {
  /** URL path relative to root, e.g. '/about' */
  path: string;
  /** <title> for this page */
  title: string;
  /** Meta description — be specific: include what the visitor gains */
  description: string;
  /** Sitemap change frequency hint */
  changeFreq: SitemapChangeFreq;
  /** Sitemap priority 0.0–1.0 */
  priority: number;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  ogImage: string;
  company: {
    legalName: string;
    foundedYear: number;
    industry: string;
    targetAudience: string;
    problemSolved: string;
    solution: string;
    keyBenefits: string[];
    contactEmail: string;
    socialLinks: {
      twitter?: string;
      github?: string;
      linkedin?: string;
    };
  };
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    twitterHandle?: string;
    locale: string;
  };
  /** Registry of all public pages — drives sitemap + LLMs.txt page index */
  pages: Record<string, PageConfig>;
}

export const siteConfig: SiteConfig = {
  // ─── Core Identity ───────────────────────────────────────────────────────────
  name: 'Axeleration AI',
  tagline: 'One sentence that nails the value proposition.',
  description:
    'Two-sentence pitch: what the product does, who it is for, and what makes it different from alternatives.',
  url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://example.com',

  // ─── Brand Assets ────────────────────────────────────────────────────────────
  ogImage: '/og.png',

  // ─── Company Details (drives Organization schema + LLMs.txt) ─────────────────
  company: {
    legalName: 'My Company, Inc.',
    foundedYear: 2024,
    industry: 'Software / SaaS',
    targetAudience:
      'Developers and product teams building modern web applications who need …',
    problemSolved:
      'Most teams waste weeks bootstrapping the same infrastructure decisions — auth, state, design system — before they can ship any real product value.',
    solution:
      'Axeleration AI is a production-ready Next.js template with every architectural decision pre-made, documented, and tested, so teams can ship features from day one.',
    keyBenefits: [
      'Zero config — works out of the box with TypeScript and Tailwind v4',
      'Opinionated patterns that scale — CVA components, Zustand stores, Zod validation',
      'AI-agent friendly — every pattern is documented in machine-readable blueprint docs',
    ],
    contactEmail: 'contact@example.com',
    socialLinks: {
      twitter: 'https://twitter.com/handle',
      github: 'https://github.com/org/repo',
      linkedin: 'https://linkedin.com/company/my-company',
    },
  },

  // ─── SEO Settings ────────────────────────────────────────────────────────────
  seo: {
    titleTemplate: '%s | Axeleration AI',
    defaultTitle: 'Axeleration AI — One sentence value prop',
    twitterHandle: '@handle',
    locale: 'en_US',
  },

  // ─── Pages Registry ──────────────────────────────────────────────────────────
  // Add a new entry here every time you create a new public page.
  pages: {
    home: {
      path: '/',
      title: 'Axeleration AI — One sentence value prop',
      description:
        'Axeleration AI is a production-ready Next.js 16 template. Ship features from day one with TypeScript, Tailwind v4, Zustand, and full SEO / GEO / LLMs.txt support.',
      changeFreq: 'weekly',
      priority: 1.0,
    },
    about: {
      path: '/about',
      title: 'About Axeleration AI',
      description:
        'Learn the story, team, and mission behind Axeleration AI — the opinionated Next.js template built for teams who want to skip the boilerplate and focus on shipping.',
      changeFreq: 'monthly',
      priority: 0.8,
    },
  },
};
