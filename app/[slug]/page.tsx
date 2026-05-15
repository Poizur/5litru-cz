import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import {
  resolveContent,
  getAllGuideSlugs,
  getAllPageSlugs,
  getAllReviewSlugs,
} from '@/lib/content'
import { buildMetadata, breadcrumbSchema } from '@/lib/seo'

interface PageProps {
  params: Promise<{ slug: string }>
}

const resolve = cache(resolveContent)

export async function generateStaticParams() {
  const reviews = await getAllReviewSlugs()
  const slugs = [...getAllGuideSlugs(), ...getAllPageSlugs(), ...reviews]
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = await resolve(slug)
  if (!item) return {}
  return buildMetadata(item)
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params
  const item = await resolve(slug)
  if (!item) notFound()

  const pageSchemas = Array.isArray(item.frontmatter.schemas) ? item.frontmatter.schemas : []
  const breadcrumb = breadcrumbSchema(item)
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
