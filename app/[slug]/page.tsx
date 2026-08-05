import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

// force-dynamic: prevents cross-domain ISR cache contamination.
// 5litru.cz and 5litrov.sk share the same Railway deployment — if ISR cached
// CZ responses, SK visitors would get CZ-locale content and vice versa.
export const dynamic = 'force-dynamic'

import {
  resolveContent,
  getAllGuideSlugs,
  getAllPageSlugs,
  getAllReviewSlugs,
} from '@/lib/content'
import { buildMetadata, breadcrumbSchema } from '@/lib/seo'
import { getMarket } from '@/lib/market'

interface PageProps {
  params: Promise<{ slug: string }>
}

const resolve = cache(resolveContent)

// generateStaticParams is kept for documentation; with force-dynamic it's unused.
export async function generateStaticParams() {
  const reviews = await getAllReviewSlugs()
  const slugs = [...getAllGuideSlugs(), ...getAllPageSlugs(), ...reviews]
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = await resolve(slug)
  if (!item) return {}
  const market = await getMarket()
  return buildMetadata(item, market)
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params
  const item = await resolve(slug)
  if (!item) notFound()

  const market = await getMarket()
  let pageSchemas = Array.isArray(item.frontmatter.schemas) ? item.frontmatter.schemas : []

  // Dynamicky přepiš availability v Product schema podle aktuálního stavu produktu.
  // YAML/DB uchovává statickou hodnotu — správnou pravdu má products.available.
  if (item.kind === 'review' && item.product != null) {
    const isAvailable = item.product.available !== false
    const schemaAvailability = isAvailable
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock'
    pageSchemas = pageSchemas.map((s: Record<string, unknown>) => {
      const reviewed = s.itemReviewed as Record<string, unknown> | undefined
      if (!reviewed || reviewed['@type'] !== 'Product') return s
      const existingOffers = reviewed.offers as Record<string, unknown> | undefined
      if (!existingOffers) return s
      return {
        ...s,
        itemReviewed: {
          ...reviewed,
          offers: { ...existingOffers, availability: schemaAvailability },
        },
      }
    })
  }

  const breadcrumb = breadcrumbSchema(item, market)
  const schemas = breadcrumb ? [...pageSchemas, breadcrumb] : pageSchemas

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div dangerouslySetInnerHTML={{ __html: item.body }} />
    </>
  )
}
