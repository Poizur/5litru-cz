import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface SuggestionRow {
  olivator_product_id: string
  olivator_slug: string
  name: string
  brand_slug: string | null
  origin_country: string | null
  origin_region: string | null
  variety: string | null
  type: string | null
  acidity: number | null
  olivator_score: number | null
  image_url: string | null
  primary_offer_price: number | null
  primary_offer_url: string
  status: 'new' | 'imported' | 'ignored'
  ignore_reason: string | null
  discovered_at: string
}

async function loadSuggestions(origin: string | null): Promise<SuggestionRow[]> {
  let q = supabaseAdmin
    .from('olivator_suggestions')
    .select('*')
    .eq('status', 'new')
    .order('olivator_score', { ascending: false, nullsFirst: false })
  if (origin) q = q.eq('origin_country', origin)
  const { data } = await q
  return (data ?? []) as unknown as SuggestionRow[]
}

async function loadOriginCounts(): Promise<Array<{ country: string; count: number }>> {
  const { data } = await supabaseAdmin
    .from('olivator_suggestions')
    .select('origin_country')
    .eq('status', 'new')
  const counts = new Map<string, number>()
  for (const r of data ?? []) {
    const c = ((r as { origin_country: string | null }).origin_country) ?? '—'
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count }))
}

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>
}) {
  const sp = await searchParams
  const origin = sp.origin ?? null
  const [items, counts] = await Promise.all([loadSuggestions(origin), loadOriginCounts()])
  const totalNew = counts.reduce((s, c) => s + c.count, 0)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
            Návrhy z Olivatoru
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-[color:var(--color-text)] md:text-4xl">
            Nové oleje z Olivator katalogu
            <span className="ml-3 font-sans text-base font-normal text-[color:var(--color-muted)]">
              {totalNew} čeká
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-muted)]">
            Olivator denně sleduje 5L oleje. Tady jsou ti, co reckonasbavi
            nabízí a ještě je nemáme — vyber, který importuješ (vytvoří draft
            v Katalogu) nebo ignoruj.
          </p>
        </div>
        <form method="POST" action="/api/admin/sync">
          <button
            type="submit"
            className="rounded-[2px] bg-[color:var(--color-olive)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[color:var(--color-olive-2)]"
          >
            Spustit sync ručně →
          </button>
        </form>
      </div>

      {counts.length > 1 && (
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtr země původu">
          <FilterChip current={origin} value={null} label={`Vše (${totalNew})`} />
          {counts.map((c) => (
            <FilterChip key={c.country} current={origin} value={c.country} label={`${c.country} (${c.count})`} />
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <div className="mt-10 rounded-[4px] border border-[color:var(--color-border)] bg-white p-12 text-center">
          <p className="font-serif text-lg text-[color:var(--color-text)]">
            {totalNew === 0 ? 'Žádné nové návrhy.' : 'V tomto filtru nic.'}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            {totalNew === 0
              ? 'Po dalším Olivator syncu se sem objeví nové oleje, pokud Olivator přidá produkt s reckonasbavi nabídkou.'
              : 'Zkus jiný filtr nebo „Vše".'}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((s) => (
            <SuggestionCard key={s.olivator_product_id} s={s} />
          ))}
        </div>
      )}
    </>
  )
}

function FilterChip({
  current,
  value,
  label,
}: {
  current: string | null
  value: string | null
  label: string
}) {
  const active = current === value
  const href = value ? `/admin/suggestions/?origin=${encodeURIComponent(value)}` : '/admin/suggestions/'
  return (
    <a
      href={href}
      className={`rounded-[2px] border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
        active
          ? 'border-[color:var(--color-olive)] bg-[color:var(--color-olive)] text-white'
          : 'border-[color:var(--color-border)] bg-white text-[color:var(--color-muted)] hover:border-[color:var(--color-olive)]'
      }`}
    >
      {label}
    </a>
  )
}

function SuggestionCard({ s }: { s: SuggestionRow }) {
  const score = s.olivator_score ?? null
  const price = s.primary_offer_price !== null ? Math.round(s.primary_offer_price) : null

  return (
    <article className="overflow-hidden rounded-[4px] border border-[color:var(--color-border)] bg-white">
      <div className="grid grid-cols-[100px_1fr] gap-4 p-4">
        <div className="relative aspect-square overflow-hidden rounded-[2px] bg-[color:var(--color-olive-pale)]">
          {s.image_url ? (
            <Image
              src={s.image_url}
              alt={s.name}
              fill
              sizes="100px"
              className="object-contain p-2"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl opacity-30">🫙</div>
          )}
          {score !== null && (
            <span className="absolute right-1 top-1 rounded-[2px] bg-[color:var(--color-gold)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--color-dark)]">
              {score}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-base font-semibold text-[color:var(--color-text)] line-clamp-2">
            {s.name}
          </h3>
          <dl className="mt-2 space-y-1 text-xs text-[color:var(--color-muted)]">
            <div>
              <dt className="inline">Původ: </dt>
              <dd className="inline text-[color:var(--color-text)]">
                {[s.origin_country, s.origin_region].filter(Boolean).join(' · ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="inline">Odrůda: </dt>
              <dd className="inline text-[color:var(--color-text)]">{s.variety ?? '—'}</dd>
            </div>
            <div>
              <dt className="inline">Acidita: </dt>
              <dd className="inline text-[color:var(--color-text)]">
                {s.acidity !== null ? `${s.acidity.toFixed(2)} %` : '—'}
              </dd>
            </div>
            <div>
              <dt className="inline">Cena u reckonasbavi: </dt>
              <dd className="inline font-mono text-[color:var(--color-text)]">
                {price !== null ? `${price.toLocaleString('cs-CZ')} Kč` : '—'}
              </dd>
            </div>
          </dl>
          <a
            href={s.primary_offer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-[color:var(--color-olive)] hover:underline"
          >
            Otevřít u reckonasbavi →
          </a>
        </div>
      </div>

      <div className="flex border-t border-[color:var(--color-border)] bg-[color:var(--color-olive-pale)]">
        <form
          method="POST"
          action={`/api/admin/suggestions/${s.olivator_product_id}/import`}
          className="flex-1 border-r border-[color:var(--color-border)]"
        >
          <button
            type="submit"
            className="w-full py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-olive)] transition-colors hover:bg-[color:var(--color-olive)] hover:text-white"
          >
            Importovat →
          </button>
        </form>
        <form
          method="POST"
          action={`/api/admin/suggestions/${s.olivator_product_id}/ignore`}
          className="flex-1"
        >
          <input type="hidden" name="reason" value="manual-ignore" />
          <button
            type="submit"
            className="w-full py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition-colors hover:bg-[rgba(0,0,0,0.05)] hover:text-[color:var(--color-text)]"
          >
            Ignorovat
          </button>
        </form>
      </div>
    </article>
  )
}
