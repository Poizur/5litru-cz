import Link from 'next/link'
import type { ContentKind } from '@/lib/content'

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbsProps {
  kind: ContentKind
  title: string
  slug: string
}

const COMPARISONS = new Set([
  'nejlepsi-olivovy-olej-5l',
  'recky-olivovy-olej-5l',
  'olivovy-olej-kreta-5l',
  'kalamata-olivovy-olej-5l',
  'olivovy-olej-5l-akce',
])

function buildTrail({ kind, slug, title }: BreadcrumbsProps): BreadcrumbItem[] {
  const home: BreadcrumbItem = { label: '5litru.cz', href: '/' }
  if (kind === 'homepage') return []

  let category: BreadcrumbItem | null = null
  if (kind === 'review') {
    category = { label: 'Recenze', href: '/nejlepsi-olivovy-olej-5l/' }
  } else if (kind === 'page' && COMPARISONS.has(slug)) {
    category = { label: 'Srovnání', href: '/nejlepsi-olivovy-olej-5l/' }
  } else if (kind === 'guide') {
    category = { label: 'Průvodci', href: '/acidita-olivoveho-oleje/' }
  }

  const leaf: BreadcrumbItem = { label: title, href: `/${slug}/` }
  return category ? [home, category, leaf] : [home, leaf]
}

export function Breadcrumbs(props: BreadcrumbsProps) {
  const trail = buildTrail(props)
  if (trail.length === 0) return null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: `https://5litru.cz${item.href}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Drobečková navigace" className="mx-auto max-w-[1100px] px-5 pt-6 text-xs text-[color:var(--color-muted)] md:px-10">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {trail.map((item, i) => {
            const isLast = i === trail.length - 1
            return (
              <li key={item.href} className="flex items-center gap-2">
                {isLast ? (
                  <span className="text-[color:var(--color-text)]">{item.label}</span>
                ) : (
                  <>
                    <Link
                      href={item.href}
                      className="hover:text-[color:var(--color-olive)] transition-colors"
                    >
                      {item.label}
                    </Link>
                    <span aria-hidden className="opacity-50">/</span>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
