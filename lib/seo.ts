// Shared SEO helpers for generateMetadata and JSON-LD schemas.

import type { Metadata } from 'next'
import type { ContentItem } from './content'
import { getSiteUrl, getSiteName, type Market } from './market'
import { getLocale } from './locale'

export const SITE_URL = 'https://5litru.cz'
export const SITE_NAME = '5litru.cz'

function absoluteOgImage(image: string | null | undefined, siteUrl: string): string | undefined {
  if (!image) return undefined
  if (/^https?:\/\//i.test(image)) return image
  if (image.startsWith('/')) return `${siteUrl}${image}`
  return `${siteUrl}/${image}`
}

function ogTypeFor(kind: ContentItem['kind']): 'website' | 'article' {
  return kind === 'review' || kind === 'guide' ? 'article' : 'website'
}

export function buildMetadata(item: ContentItem, market: Market = 'CZ'): Metadata {
  const fm = item.frontmatter
  const slug = item.slug
  const siteUrl = getSiteUrl(market)
  const siteName = getSiteName(market)
  const locale = getLocale(market)
  const url = slug === 'homepage' ? `${siteUrl}/` : `${siteUrl}/${slug}/`
  const ogImage = absoluteOgImage(fm.og_image as string | null | undefined, siteUrl)
  const defaultOgImage = `${siteUrl}/opengraph-image.png`
  const description = fm.description ?? ''

  const czUrl = slug === 'homepage' ? `${SITE_URL}/` : `${SITE_URL}/${slug}/`
  const skUrl = slug === 'homepage' ? 'https://5litrov.sk/' : `https://5litrov.sk/${slug}/`

  return {
    title: fm.title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'cs-CZ': czUrl,
        'sk-SK': skUrl,
      },
    },
    openGraph: {
      title: fm.title,
      description,
      url,
      siteName,
      locale: locale.locale,
      type: ogTypeFor(item.kind),
      images: [{ url: ogImage ?? defaultOgImage, width: 1200, height: 630 }],
      publishedTime:
        item.kind === 'review' || item.kind === 'guide' ? (fm.published_at as string | undefined) : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: fm.title,
      description,
      images: [ogImage ?? defaultOgImage],
    },
    robots: { index: true, follow: true },
  }
}

// Server-side breadcrumb schema (the migrated WP HTML doesn't include it).
export function breadcrumbSchema(item: ContentItem, market: Market = 'CZ'): Record<string, unknown> | null {
  const slug = item.slug
  if (slug === 'homepage') return null
  const siteUrl = getSiteUrl(market)
  const siteName = getSiteName(market)
  const locale = getLocale(market)
  const title = (item.frontmatter.title as string) ?? slug

  const items: Array<{ name: string; url: string }> = [
    { name: siteName, url: `${siteUrl}/` },
  ]
  if (item.kind === 'review') {
    items.push({ name: locale.breadcrumbReviews, url: `${siteUrl}/nejlepsi-olivovy-olej-5l/` })
  } else if (item.kind === 'guide') {
    items.push({ name: locale.breadcrumbGuides, url: `${siteUrl}/acidita-olivoveho-oleje/` })
  } else if (item.kind === 'page' && slug !== 'o-webu') {
    items.push({ name: locale.breadcrumbComparison, url: `${siteUrl}/nejlepsi-olivovy-olej-5l/` })
  }
  // Drop trailing if it would duplicate the leaf.
  const leafUrl = `${siteUrl}/${slug}/`
  const finalTrail = items.filter((it) => it.url !== leafUrl)
  finalTrail.push({ name: title, url: leafUrl })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: finalTrail.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}
