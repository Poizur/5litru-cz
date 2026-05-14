import type { ReactNode } from 'react'

export interface FAQItem {
  question: string
  answer: string | ReactNode
}

interface FAQProps {
  items: FAQItem[]
  /** Skip emitting Schema.org JSON-LD (e.g. when frontmatter already has FAQPage). */
  noSchema?: boolean
}

// Pure-CSS accordion via <details>/<summary>. No JS needed, SSR-friendly,
// progressive enhancement, accessible by default.
export function FAQ({ items, noSchema }: FAQProps) {
  if (!items?.length) return null

  return (
    <section className="my-10">
      {!noSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: items.map((it) => ({
                '@type': 'Question',
                name: it.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: typeof it.answer === 'string' ? it.answer : '',
                },
              })),
            }),
          }}
        />
      )}
      <h2 className="font-serif text-2xl font-semibold text-[color:var(--color-text)] md:text-3xl">
        Často kladené otázky
      </h2>
      <div className="mt-6 divide-y divide-[color:var(--color-border)] border-t border-b border-[color:var(--color-border)]">
        {items.map((it, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-medium text-[color:var(--color-text)] [&::-webkit-details-marker]:hidden">
              <span>{it.question}</span>
              <span
                aria-hidden
                className="mt-1 shrink-0 text-[color:var(--color-gold)] transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-[color:var(--color-muted)]">
              {it.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
