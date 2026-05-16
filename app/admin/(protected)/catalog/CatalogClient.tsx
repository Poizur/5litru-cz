'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductCard, type CardProduct } from '../_components/ProductCard'
import { PageHeader } from '../_components/PageHeader'
import { COLORS } from '../_components/tokens'

interface Props {
  products: CardProduct[]
}

export function CatalogClient({ products }: Props) {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const router = useRouter()

  const filtered = products.filter(p => {
    if (q) {
      const lq = q.toLowerCase()
      if (
        !p.name.toLowerCase().includes(lq) &&
        !p.brand?.toLowerCase().includes(lq) &&
        !p.origin_region?.toLowerCase().includes(lq)
      ) return false
    }
    if (statusFilter && p.status !== statusFilter) return false
    return true
  })

  return (
    <>
      <PageHeader
        title="Katalog"
        subtitle={`${products.length} publikovaných recenzí`}
      />

      <div style={{ padding: '24px 32px', maxWidth: '1400px', width: '100%' }}>
        {/* Filter bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          alignItems: 'center',
        }}>
          <input
            type="search"
            placeholder="Hledat název, brand, region…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              flex: 1,
              maxWidth: '320px',
              padding: '7px 12px',
              background: '#FFFFFF',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              color: COLORS.text,
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = COLORS.olive }}
            onBlur={e => { e.target.style.borderColor = COLORS.border }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              background: '#FFFFFF',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              color: COLORS.text,
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <option value="">Všechny stavy</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <div style={{
            fontSize: '12px',
            color: COLORS.textSubtle,
            marginLeft: 'auto',
          }}>
            {filtered.length} {filtered.length === 1 ? 'výsledek' : filtered.length < 5 ? 'výsledky' : 'výsledků'}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState q={q} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} onChanged={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function EmptyState({ q }: { q: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '64px 24px',
      border: `1px dashed ${COLORS.border}`,
      borderRadius: '8px',
      background: COLORS.surface,
    }}>
      <div style={{ fontSize: '15px', color: COLORS.text, marginBottom: '6px', fontWeight: 500 }}>
        {q ? `Žádný produkt neodpovídá „${q}"` : 'Zatím žádné publikované recenze'}
      </div>
      <div style={{ fontSize: '13px', color: COLORS.textSubtle }}>
        Drafty najdeš v záložce <strong>Drafts</strong>.
      </div>
    </div>
  )
}
