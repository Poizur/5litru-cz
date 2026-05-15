import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import type { Product, Retailer } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ProductRow extends Product {
  retailer?: Pick<Retailer, 'name' | 'slug'> | null
}

async function loadProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,slug,review_slug,name,brand,origin_region,volume_ml,acidity_pct,price_czk,status,published_at,hero_image,retailer:retailers(name,slug)')
    .order('status', { ascending: true })
    .order('name', { ascending: true })
  if (error) {
    console.error('catalog load error:', error)
    return []
  }
  return (data ?? []) as unknown as ProductRow[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  published: { label: 'Published', color: 'bg-[color:var(--color-olive)] text-white' },
  draft: { label: 'Draft', color: 'bg-[color:var(--color-gold)] text-[color:var(--color-dark)]' },
  archived: { label: 'Archived', color: 'bg-[rgba(0,0,0,0.1)] text-[color:var(--color-muted)]' },
}

export default async function CatalogPage() {
  const products = await loadProducts()

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
            Katalog
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-[color:var(--color-text)] md:text-4xl">
            Všechny produkty
            <span className="ml-3 font-sans text-base font-normal text-[color:var(--color-muted)]">
              {products.length} celkem
            </span>
          </h1>
        </div>
        <Link
          href="/admin/add/"
          className="rounded-[2px] bg-[color:var(--color-olive)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[color:var(--color-olive-2)]"
        >
          Přidat z URL →
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-[4px] border border-[color:var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-olive-pale)] text-left font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-olive)]">
            <tr>
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Acidita</th>
              <th className="px-4 py-3 text-right">Cena</th>
              <th className="px-4 py-3">Retailer</th>
              <th className="px-4 py-3">Stav</th>
              <th className="px-4 py-3 text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const badge = STATUS_LABEL[p.status] ?? { label: p.status, color: 'bg-[rgba(0,0,0,0.1)]' }
              return (
                <tr key={p.id} className="border-b border-[color:var(--color-border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-serif text-base font-semibold text-[color:var(--color-text)]">
                      {p.name}
                    </div>
                    {p.brand && (
                      <div className="mt-0.5 text-xs text-[color:var(--color-muted)]">{p.brand}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-text)]">{p.origin_region ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-text)]">
                    {p.acidity_pct !== null ? `${p.acidity_pct.toFixed(2)} %` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-[color:var(--color-text)]">
                    {p.price_czk !== null ? `${Math.round(p.price_czk).toLocaleString('cs-CZ')} Kč` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[color:var(--color-muted)]">
                    {p.retailer?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-[2px] px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.review_slug && (
                      <Link
                        href={`/${p.review_slug}/`}
                        target="_blank"
                        className="text-xs font-medium text-[color:var(--color-olive)] hover:text-[color:var(--color-olive-2)]"
                      >
                        Otevřít →
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[color:var(--color-muted)]">
                  Žádné produkty v DB. Použij „Přidat z URL".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
