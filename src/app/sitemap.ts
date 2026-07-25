import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { siteConfig } from '@/config/site';

/**
 * Auto-generated sitemap — driven by siteConfig.pages.
 * Add entries in src/config/site.ts, not here.
 * Produces one URL per page × locale (with 'as-needed' prefix logic).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of Object.values(siteConfig.pages)) {
    for (const locale of routing.locales) {
      const prefix =
        locale === routing.defaultLocale ? '' : `/${locale}`;
      const pathSegment = page.path === '/' ? '' : page.path;
      const url = `${siteConfig.url}${prefix}${pathSegment}`;

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: page.changeFreq,
        priority: page.priority,
      });
    }
  }

  return entries;
}
