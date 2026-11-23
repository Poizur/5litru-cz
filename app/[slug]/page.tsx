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

function hasPrice(offer: unknown): boolean {
  if (!offer || typeof offer !== 'object') return false
  const o = offer as Record<string, unknown>
  const spec = o.priceSpecification as Record<string, unknown> | undefined
  return (o.price != null && o.price !== '') || (spec?.price != null && spec.price !== '')
}

function dropPricelessOffers(node: Record<string, unknown>): Record<string, unknown> {
  let out = node
  if (out['@type'] === 'Product' && 'offers' in out) {
    const offers = Array.isArray(out.offers) ? out.offers.filter(hasPrice) : hasPrice(out.offers) ? out.offers : null
    const { offers: _dropped, ...rest } = out
    out = offers && (!Array.isArray(offers) || offers.length > 0) ? { ...rest, offers } : rest
  }
  const reviewed = out.itemReviewed as Record<string, unknown> | undefined
  if (reviewed && typeof reviewed === 'object') out = { ...out, itemReviewed: dropPricelessOffers(reviewed) }
  return out
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params
  const item = await resolve(slug)
  if (!item) notFound()

  const market = await getMarket()
  let pageSchemas: Record<string, unknown>[] = Array.isArray(item.frontmatter.schemas)
    ? (item.frontmatter.schemas as Record<string, unknown>[])
    : []

  // Dynamicky přepiš cenu a availability v Product schema podle aktuálního stavu produktu.
  // YAML/DB uchovává statickou hodnotu — pravdu mají products.price_czk / price_eur / available
  // (ceny se synchronizují z Olivátoru, JSON-LD musí sedět s tím, co je na stránce).
  if (item.kind === 'review' && item.product != null) {
    const product = item.product
    const schemaAvailability = product.available !== false
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock'
    const offerPrice: Record<string, string> =
      market === 'SK' && product.price_eur != null
        ? { price: product.price_eur.toFixed(2), priceCurrency: 'EUR' }
        : product.price_czk != null
          ? { price: String(Math.round(product.price_czk)), priceCurrency: 'CZK' }
          : {}
    const patchOffers = (node: Record<string, unknown>): Record<string, unknown> => {
      const existingOffers = node.offers as Record<string, unknown> | undefined
      if (!existingOffers) return node
      return { ...node, offers: { ...existingOffers, ...offerPrice, availability: schemaAvailability } }
    }
    pageSchemas = pageSchemas.map((s: Record<string, unknown>) => {
      if (s['@type'] === 'Product') return patchOffers(s)
      const reviewed = s.itemReviewed as Record<string, unknown> | undefined
      if (!reviewed || reviewed['@type'] !== 'Product') return s
      return { ...s, itemReviewed: patchOffers(reviewed) }
    })
  }

  // Google: Offer bez price je chyba produktových úryvků → takovou nabídku raději vynech.
  pageSchemas = pageSchemas.map(dropPricelessOffers)

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
