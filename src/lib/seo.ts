/**
 * SEO metadata builder — call buildMetadata() in every public page's
 * generateMetadata() export instead of hand-writing Metadata objects.
 */

import type { Metadata } from 'next';

import { siteConfig } from '@/config/site';

export interface BuildMetadataOptions {
  /** Page <title> — omit to fall back to siteConfig.seo.defaultTitle */
  title?: string;
  /** Meta description — omit to fall back to siteConfig.description */
  description?: string;
  /** Path, e.g. '/about' */
  path: string;
  /** Absolute URL or root-relative path to OG image — defaults to siteConfig.ogImage */
  ogImage?: string;
  /** Set true for noindex/nofollow (e.g. private/auth pages) */
  noIndex?: boolean;
}

/**
 * Builds a complete Next.js Metadata object with SEO, OpenGraph, Twitter,
 * and canonical URL.
 *
 * Usage — in page.tsx:
 * ```ts
 * export async function generateMetadata(): Promise<Metadata> {
 *   return buildMetadata({ title: 'About', path: '/about' });
 * }
 * ```
 */
export function buildMetadata({
  title,
  description,
  path,
  ogImage,
  noIndex = false,
}: BuildMetadataOptions): Metadata {
  const resolvedTitle = title ?? siteConfig.seo.defaultTitle;
  const resolvedDescription = description ?? siteConfig.description;
  const resolvedOgImage = ogImage ?? siteConfig.ogImage;

  const canonicalPath = path === '/' ? '' : path;
  const canonicalUrl = `${siteConfig.url}${canonicalPath}`;

  return {
    title: title
      ? { template: siteConfig.seo.titleTemplate, default: title }
      : siteConfig.seo.defaultTitle,
    description: resolvedDescription,
    metadataBase: new URL(siteConfig.url),

    alternates: {
      canonical: canonicalUrl,
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
      locale: siteConfig.seo.locale,
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
