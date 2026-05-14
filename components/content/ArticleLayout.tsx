import type { ReactNode } from 'react'

interface ArticleLayoutProps {
  children: ReactNode
}

// Minimal wrapper for prose content. Migrated WP MDX already brings its own
// hero sections + styled containers from legacy.css, so this is intentionally
// thin — used as a fallback for any new hand-authored guide content that
// doesn't yet include the legacy hero markup.
export function ArticleLayout({ children }: ArticleLayoutProps) {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-12 md:px-0 md:py-16">
      <div className="prose-article">{children}</div>
    </div>
  )
}
