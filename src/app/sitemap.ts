import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/**
 * Auto-generated sitemap — driven by siteConfig.pages.
 * Add entries in src/config/site.ts, not here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(siteConfig.pages).map((page) => {
    const pathSegment = page.path === '/' ? '' : page.path;
    return {
      url: `${siteConfig.url}${pathSegment}`,
      lastModified: new Date(),
      changeFrequency: page.changeFreq,
      priority: page.priority,
    };
  });
}
