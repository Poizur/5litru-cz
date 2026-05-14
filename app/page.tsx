import { MDXRemote } from 'next-mdx-remote/rsc'
import { mdxComponents } from '@/lib/mdx-components'
import { getPage } from '@/lib/content'

export const revalidate = 3600 // 1h — homepage updates infrequently

export default async function HomePage() {
  const home = await getPage('homepage')
  if (!home) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-serif text-4xl font-bold">5litru.cz</h1>
        <p className="mt-4 text-[color:var(--color-muted)]">
          Homepage MDX (`content/pages/homepage.mdx`) not found.
        </p>
      </main>
    )
  }
  return (
    <article className="legacy-content">
      <MDXRemote source={home.body} components={mdxComponents} />
    </article>
  )
}
