import type { Metadata } from 'next'
import { getPage } from '@/lib/content'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const home = await getPage('homepage')
  if (!home) return {}
  return {
    title: home.frontmatter.title,
    description: home.frontmatter.description,
    alternates: { canonical: 'https://5litru.cz/' },
    openGraph: {
      title: home.frontmatter.title,
      description: home.frontmatter.description,
      url: 'https://5litru.cz/',
      images: home.frontmatter.og_image ? [{ url: home.frontmatter.og_image }] : undefined,
    },
  }
}

export default async function HomePage() {
  const home = await getPage('homepage')
  if (!home) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-serif text-4xl font-bold">5litru.cz</h1>
        <p className="mt-4">Homepage not found.</p>
      </main>
    )
  }

  const schemas = Array.isArray(home.frontmatter.schemas) ? home.frontmatter.schemas : []
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div dangerouslySetInnerHTML={{ __html: home.body }} />
    </>
  )
}
