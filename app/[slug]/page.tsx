import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import {
  resolveContent,
  getAllGuideSlugs,
  getAllPageSlugs,
  getAllReviewSlugs,
} from '@/lib/content'

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
  const fm = item.frontmatter
  const canonical = `https://5litru.cz/${slug}/`
  return {
    title: fm.title,
    description: fm.description,
    alternates: { canonical },
    openGraph: {
      title: fm.title,
      description: fm.description,
      url: canonical,
      images: fm.og_image ? [{ url: fm.og_image }] : undefined,
    },
  }
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params
  const item = await resolve(slug)
  if (!item) notFound()

  const schemas = Array.isArray(item.frontmatter.schemas) ? item.frontmatter.schemas : []

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
