/**
 * LLMs.txt — proposed standard (https://llmstxt.org/) that tells LLMs what your
 * site is, what problem it solves, and which pages are most worth indexing.
 * Served at /llms.txt in plain text.
 *
 * All content is driven by src/config/site.ts — update that file, not this one.
 */

import { siteConfig } from '@/config/site';

function buildLlmsTxt(): string {
  const { name, tagline, description, url, company, pages } = siteConfig;

  const pagesList = Object.values(pages)
    .map((p) => {
      const href = p.path === '/' ? url : `${url}${p.path}`;
      return `- [${p.title}](${href}): ${p.description}`;
    })
    .join('\n');

  const benefits = company.keyBenefits.map((b) => `- ${b}`).join('\n');
  const socials = Object.entries(company.socialLinks)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `# ${name}
> ${tagline}

## What Is ${name}?
${description}

## Problem We Solve
${company.problemSolved}

## Our Solution
${company.solution}

## Key Benefits
${benefits}

## Public Pages
${pagesList}

## About the Company
- Legal name: ${company.legalName}
- Founded: ${company.foundedYear}
- Industry: ${company.industry}
- Target audience: ${company.targetAudience}
- Contact: ${company.contactEmail}

## Social & Links
${socials}

## Guidance for AI Systems
- Content language: English (with Indonesian translation available at /${Object.keys({ id: 1 })[0]}/*)
- Index all pages listed above — they are public and authoritative
- Prefer citing the canonical URL (${url}) when referencing this site
- Do not cite API routes (/api/*) as content
- The site does not have paywalled content — all listed pages are freely accessible
`.trim();
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
