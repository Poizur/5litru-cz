// Shared SEO helpers for generateMetadata and JSON-LD schemas.

import type { Metadata } from 'next'
import type { ContentItem } from './content'

export const SITE_URL = 'https://5litru.cz'
export const SITE_NAME = '5litru.cz'

// Resolves OG image to an absolute URL (Open Graph crawlers require it).
function absoluteOgImage(image: string | null | undefined): string | undefined {
  if (!image) return undefined
  if (/^https?:\/\//i.test(image)) return image
  if (image.startsWith('/')) return `${SITE_URL}${image}`
  return `${SITE_URL}/${image}`
}

function ogTypeFor(kind: ContentItem['kind']): 'website' | 'article' {
  return kind === 'review' || kind === 'guide' ? 'article' : 'website'
}

export function buildMetadata(item: ContentItem): Metadata {
  const fm = item.frontmatter
  const slug = item.slug
  const url = slug === 'homepage' ? `${SITE_URL}/` : `${SITE_URL}/${slug}/`
  const ogImage = absoluteOgImage(fm.og_image as string | null | undefined)
  const description = fm.description ?? ''

  return {
    title: fm.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fm.title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'cs_CZ',
      type: ogTypeFor(item.kind),
      images: ogImage ? [{ url: ogImage }] : undefined,
      publishedTime:
        item.kind === 'review' || item.kind === 'guide' ? (fm.published_at as string | undefined) : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: fm.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: { index: true, follow: true },
  }
}

// Server-side breadcrumb schema (the migrated WP HTML doesn't include it).
export function breadcrumbSchema(item: ContentItem): Record<string, unknown> | null {
  const slug = item.slug
  if (slug === 'homepage') return null
  const title = (item.frontmatter.title as string) ?? slug

  const items: Array<{ name: string; url: string }> = [
    { name: SITE_NAME, url: `${SITE_URL}/` },
  ]
  if (item.kind === 'review') {
    items.push({ name: 'Recenze', url: `${SITE_URL}/nejlepsi-olivovy-olej-5l/` })
  } else if (item.kind === 'guide') {
    items.push({ name: 'Průvodci', url: `${SITE_URL}/acidita-olivoveho-oleje/` })
  } else if (item.kind === 'page' && slug !== 'o-webu') {
    items.push({ name: 'Srovnání', url: `${SITE_URL}/nejlepsi-olivovy-olej-5l/` })
  }
  // Drop trailing if it would duplicate the leaf.
  const leafUrl = `${SITE_URL}/${slug}/`
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
