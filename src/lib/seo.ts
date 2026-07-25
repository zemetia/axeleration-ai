/**
 * SEO metadata builder — call buildMetadata() in every public page's
 * generateMetadata() export instead of hand-writing Metadata objects.
 */

import type { Metadata } from 'next';

import { routing } from '@/i18n/routing';
import { siteConfig } from '@/config/site';

export interface BuildMetadataOptions {
  /** Page <title> — omit to fall back to siteConfig.seo.defaultTitle */
  title?: string;
  /** Meta description — omit to fall back to siteConfig.description */
  description?: string;
  /** Locale-stripped path, e.g. '/about' (no locale prefix) */
  path: string;
  /** Active locale, e.g. 'en' */
  locale: string;
  /** Absolute URL or root-relative path to OG image — defaults to siteConfig.ogImage */
  ogImage?: string;
  /** Set true for noindex/nofollow (e.g. private/auth pages) */
  noIndex?: boolean;
}

/** Build hreflang alternate map for all supported locales. */
function buildAlternates(
  path: string,
): Record<string, string> {
  const alts: Record<string, string> = {};
  for (const locale of routing.locales) {
    const prefix =
      locale === routing.defaultLocale ? '' : `/${locale}`;
    alts[locale] = `${siteConfig.url}${prefix}${path === '/' ? '' : path}`;
  }
  alts['x-default'] = `${siteConfig.url}${path === '/' ? '' : path}`;
  return alts;
}

/**
 * Builds a complete Next.js Metadata object with SEO, OpenGraph, Twitter,
 * canonical URL, and hreflang alternates.
 *
 * Usage — in page.tsx:
 * ```ts
 * export async function generateMetadata({ params }: Props): Promise<Metadata> {
 *   const { locale } = await params;
 *   return buildMetadata({ title: 'About', path: '/about', locale });
 * }
 * ```
 */
export function buildMetadata({
  title,
  description,
  path,
  locale,
  ogImage,
  noIndex = false,
}: BuildMetadataOptions): Metadata {
  const resolvedTitle = title ?? siteConfig.seo.defaultTitle;
  const resolvedDescription = description ?? siteConfig.description;
  const resolvedOgImage = ogImage ?? siteConfig.ogImage;

  const localePrefix =
    locale === routing.defaultLocale ? '' : `/${locale}`;
  const canonicalPath = path === '/' ? '' : path;
  const canonicalUrl = `${siteConfig.url}${localePrefix}${canonicalPath}`;

  return {
    title: title
      ? { template: siteConfig.seo.titleTemplate, default: title }
      : siteConfig.seo.defaultTitle,
    description: resolvedDescription,
    metadataBase: new URL(siteConfig.url),

    alternates: {
      canonical: canonicalUrl,
      languages: buildAlternates(path),
    },

    openGraph: {
      type: 'website',
      url: canonicalUrl,
      siteName: siteConfig.name,
      title: resolvedTitle,
      description: resolvedDescription,
      images: [
        {
          url: resolvedOgImage,
          width: 1200,
          height: 630,
          alt: resolvedTitle,
        },
      ],
      locale: locale === 'id' ? 'id_ID' : siteConfig.seo.locale,
    },

    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      images: [resolvedOgImage],
      ...(siteConfig.seo.twitterHandle
        ? { creator: siteConfig.seo.twitterHandle, site: siteConfig.seo.twitterHandle }
        : {}),
    },

    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
  };
}
