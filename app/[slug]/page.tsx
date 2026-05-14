import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { cache } from 'react'
import { mdxComponents } from '@/lib/mdx-components'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import {
  resolveContent,
  getAllGuideSlugs,
  getAllPageSlugs,
  getAllReviewSlugs,
} from '@/lib/content'

interface PageProps {
  params: Promise<{ slug: string }>
}

// React.cache dedupes async calls within a single request — generateMetadata and
// the page body both call resolveContent for the same slug.
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

  return (
    <>
      <Breadcrumbs kind={item.kind} title={item.frontmatter.title ?? slug} slug={slug} />
      <article className="legacy-content">
        <MDXRemote source={item.body} components={mdxComponents} />
      </article>
    </>
  )
}
