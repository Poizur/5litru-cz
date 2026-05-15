// Draft review editor — shown after AI generation (or anytime a draft product exists).
// Allows admin to read the generated content, set status to published, and trigger redeploy.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { PublishButton } from './PublishButton'

export const dynamic = 'force-dynamic'

interface ProductDraft {
  id: string
  slug: string
  review_slug: string | null
  name: string
  status: string
  price_czk: number | null
  origin_country: string | null
  origin_region: string | null
  variety: string | null
  acidity_pct: number | null
  review_mdx: string | null
  review_frontmatter: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface AiJob {
  id: string
  model: string | null
  cost_usd: number | null
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  created_at: string
}

async function loadDraft(id: string): Promise<{ product: ProductDraft; jobs: AiJob[] } | null> {
  const [{ data: product }, { data: jobs }] = await Promise.all([
    supabaseAdmin.from('products').select('*').eq('id', id).single(),
    supabaseAdmin.from('ai_jobs').select('*').eq('product_id', id).order('created_at', { ascending: false }),
  ])
  if (!product) return null
  return { product: product as unknown as ProductDraft, jobs: (jobs ?? []) as unknown as AiJob[] }
}

export default async function EditDraftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadDraft(id)
  if (!data) notFound()

  const { product, jobs } = data
  const aiJob = jobs.find(j => j.model?.includes('sonnet'))
  const wordCount = product.review_mdx
    ? product.review_mdx.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length
    : 0
  const reviewPreviewUrl = product.review_slug ? `/${product.review_slug}/` : null

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
            Draft recenze
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-[color:var(--color-text)] md:text-3xl">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            <code className="rounded bg-[color:var(--color-olive-pale)] px-1 py-0.5 text-[11px]">{product.slug}</code>
            {product.review_slug && (
              <> / <code className="rounded bg-[color:var(--color-olive-pale)] px-1 py-0.5 text-[11px]">{product.review_slug}</code></>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          {reviewPreviewUrl && (
            <a
              href={reviewPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[2px] border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-olive)] hover:text-[color:var(--color-olive)]"
            >
              Náhled (draft) ↗
            </a>
          )}
          <PublishButton productId={product.id} currentStatus={product.status} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Status + meta */}
        <div className="space-y-6">
          <div className="rounded-[4px] border border-[color:var(--color-border)] bg-white p-5">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-gold)]">
              Stav
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <Stat label="Status" value={<StatusBadge status={product.status} />} />
              <Stat label="Vytvořeno" value={new Date(product.created_at).toLocaleDateString('cs-CZ')} />
              <Stat label="Slova" value={`~${wordCount.toLocaleString('cs-CZ')}`} />
              <Stat label="Acidita" value={product.acidity_pct != null ? `${product.acidity_pct.toFixed(2)} %` : '—'} />
              <Stat label="Odrůda" value={product.variety ?? '—'} />
              <Stat label="Cena" value={product.price_czk != null ? `${Math.round(product.price_czk).toLocaleString('cs-CZ')} Kč` : '—'} />
            </div>
          </div>

          {aiJob && (
            <div className="rounded-[4px] border border-[color:var(--color-border)] bg-white p-5">
              <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-gold)]">
                AI job
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <Stat label="Model" value={aiJob.model ?? '—'} />
                <Stat
                  label="Náklady"
                  value={aiJob.cost_usd != null ? `$${aiJob.cost_usd.toFixed(4)}` : '—'}
                />
                <Stat
                  label="Tokeny"
                  value={
                    aiJob.output
                      ? `${(aiJob.output.input_tokens as number | null) ?? '?'} + ${(aiJob.output.output_tokens as number | null) ?? '?'}`
                      : '—'
                  }
                />
                <Stat
                  label="Heureka recenze"
                  value={String((aiJob.input as { heureka_reviews?: number } | null)?.heureka_reviews ?? 0)}
                />
                <Stat
                  label="Eshop specs"
                  value={String((aiJob.input as { eshop_specs?: number } | null)?.eshop_specs ?? 0)}
                />
                <Stat label="Datum" value={new Date(aiJob.created_at).toLocaleString('cs-CZ')} />
              </div>
            </div>
          )}

          <div className="rounded-[4px] border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-700">
              Před publikací zkontroluj
            </h2>
            <ul className="space-y-1.5 text-sm text-amber-800">
              <li>✓ Intro — fakta o značce / regionu jsou správná?</li>
              <li>✓ Acidita, odrůda, BIO certifikace — sedí s eshopem?</li>
              <li>✓ Cena — aktuální k dnešku?</li>
              <li>✓ FAQ — otázky relevantní, odpovědi přesné?</li>
              <li>✓ Srovnání s alternativami — odkazuje na existující recenze?</li>
              <li>✓ Affiliate URL — funguje redirect <code>/{product.slug}/</code>?</li>
            </ul>
          </div>

          {/* MDX preview (truncated) */}
          {product.review_mdx && (
            <div className="rounded-[4px] border border-[color:var(--color-border)] bg-white">
              <div className="border-b border-[color:var(--color-border)] px-5 py-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-gold)]">
                  MDX preview (prvních 2 000 znaků)
                </span>
              </div>
              <pre className="overflow-x-auto px-5 py-4 text-[11px] leading-relaxed text-[color:var(--color-muted)] whitespace-pre-wrap">
                {product.review_mdx.slice(0, 2000)}{product.review_mdx.length > 2000 ? '\n…' : ''}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          <div className="rounded-[4px] border border-[color:var(--color-border)] bg-white p-5">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-gold)]">
              Akce
            </h2>
            <div className="space-y-2">
              <PublishButton productId={product.id} currentStatus={product.status} fullWidth />
              {reviewPreviewUrl && (
                <a
                  href={reviewPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center rounded-[2px] border border-[color:var(--color-border)] py-2.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-olive)] hover:text-[color:var(--color-olive)]"
                >
                  Náhled recenze ↗
                </a>
              )}
              <Link
                href="/admin/catalog/"
                className="flex w-full items-center justify-center rounded-[2px] border border-[color:var(--color-border)] py-2.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-olive)] hover:text-[color:var(--color-olive)]"
              >
                Zpět do katalogu
              </Link>
            </div>
          </div>
          <p className="text-[11px] text-[color:var(--color-muted)] leading-relaxed px-1">
            Po publikaci se aktivuje affiliate redirect <code>/{product.slug}/</code> při příštím Railway redeploy.
            Redeploy se spustí automaticky při publikaci.
          </p>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[color:var(--color-text)]">{value}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  )
}
