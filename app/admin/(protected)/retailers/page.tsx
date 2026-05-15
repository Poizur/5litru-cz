import { supabaseAdmin } from '@/lib/supabase'
import type { Retailer } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function loadRetailers(): Promise<Retailer[]> {
  const { data, error } = await supabaseAdmin
    .from('retailers')
    .select('*')
    .order('active', { ascending: false })
    .order('name', { ascending: true })
  if (error) return []
  return (data ?? []) as unknown as Retailer[]
}

function mask(hash: string | null): string {
  if (!hash) return '—'
  if (hash.length < 12) return hash
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

export default async function RetailersPage() {
  const retailers = await loadRetailers()

  return (
    <>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
          Retailers
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-[color:var(--color-text)] md:text-4xl">
          E-shopy s affiliate
          <span className="ml-3 font-sans text-base font-normal text-[color:var(--color-muted)]">
            {retailers.length} celkem
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--color-muted)]">
          Každý retailer má vlastní eHub tracking hash. Po aktualizaci stačí{' '}
          <code className="rounded bg-[color:var(--color-olive-pale)] px-1.5 py-0.5 font-mono text-xs">
            scripts/db-update-ehub-hash.ts
          </code>{' '}
          + Railway redeploy — `next.config.ts` při buildu vygeneruje nové
          redirect rules.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {retailers.map((r) => (
          <article key={r.id} className="rounded-[4px] border border-[color:var(--color-border)] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[color:var(--color-text)]">{r.name}</h2>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[color:var(--color-muted)]">
                  {r.slug}
                </p>
              </div>
              <span
                className={`inline-block rounded-[2px] px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                  r.active
                    ? 'bg-[color:var(--color-olive)] text-white'
                    : 'bg-[rgba(0,0,0,0.1)] text-[color:var(--color-muted)]'
                }`}
              >
                {r.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              <Row label="Base URL">
                <a
                  href={r.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--color-olive)] hover:underline"
                >
                  {r.base_url.replace(/^https?:\/\//, '')}
                </a>
              </Row>
              <Row label="Network">{r.affiliate_network}</Row>
              <Row label="eHub hash">
                <code className="font-mono text-xs text-[color:var(--color-text)]">
                  {mask(r.ehub_tracking_hash)}
                </code>
              </Row>
              <Row label="UTM campaign">
                <code className="font-mono text-xs text-[color:var(--color-text)]">{r.utm_campaign}</code>
              </Row>
            </dl>
          </article>
        ))}
        {retailers.length === 0 && (
          <p className="col-span-2 rounded-[4px] border border-[color:var(--color-border)] bg-white p-8 text-center text-sm text-[color:var(--color-muted)]">
            Žádný retailer v DB.
          </p>
        )}
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </dt>
      <dd className="flex-1">{children}</dd>
    </div>
  )
}
