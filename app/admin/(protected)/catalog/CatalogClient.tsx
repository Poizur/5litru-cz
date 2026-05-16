'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CatalogProduct } from './page'

const BG = '#0f1a08'
const SIDEBAR = '#0a1306'
const SURFACE = 'rgba(255,255,255,0.03)'
const SURFACE2 = 'rgba(255,255,255,0.06)'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = '#e8eddf'
const MUTED = '#8fa87a'
const GOLD = '#c4973e'
const OLIVE = '#3d5220'

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  published: { label: 'Published', bg: 'rgba(58,107,32,0.25)', color: '#9dce78' },
  draft:     { label: 'Draft',     bg: 'rgba(196,151,62,0.15)', color: GOLD },
  archived:  { label: 'Archived',  bg: 'rgba(255,255,255,0.05)', color: MUTED },
}

interface Props {
  products: CatalogProduct[]
  stats: { total: number; published: number; drafts: number; avgRating: string }
}

export function CatalogClient({ products, stats }: Props) {
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
      {/* Sticky page header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: SIDEBAR, borderBottom: `1px solid ${BORDER}`,
        padding: '0 24px', height: '52px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '13px', color: TEXT, fontWeight: 600 }}>Katalog produktů</div>
        <Link href="/admin/add/" style={{
          padding: '6px 14px', background: OLIVE, borderRadius: '5px',
          color: TEXT, fontSize: '12px', fontWeight: 600, textDecoration: 'none',
          letterSpacing: '0.02em',
        }}>
          + Přidat produkt
        </Link>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {([
            { label: 'Celkem',      value: stats.total,      icon: '▦', sub: 'produktů' },
            { label: 'Publikované', value: stats.published,  icon: '✓', sub: 'živé' },
            { label: 'Drafty',      value: stats.drafts,     icon: '✎', sub: 'rozpracované' },
            { label: 'Průměr',      value: stats.avgRating,  icon: '★', sub: 'hodnocení' },
          ] as const).map(c => (
            <div key={c.label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '16px 18px' }}>
              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11px' }}>{c.icon}</span> {c.label}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: TEXT, lineHeight: 1, marginBottom: '3px' }}>{c.value}</div>
              <div style={{ fontSize: '11px', color: MUTED }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Hledat produkt, brand, region…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px',
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: '5px', color: TEXT, fontSize: '13px', outline: 'none',
            }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px', background: '#0a1306',
              border: `1px solid ${BORDER}`, borderRadius: '5px',
              color: TEXT, fontSize: '13px', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Všechny stavy</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <div style={{ fontSize: '12px', color: MUTED, whiteSpace: 'nowrap' }}>
            {filtered.length} výsledků
          </div>
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <EmptyState q={q} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' }}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} onDeleted={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function EmptyState({ q }: { q: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: '32px', opacity: 0.25, marginBottom: '16px' }}>⊘</div>
      <div style={{ fontSize: '14px', color: TEXT, marginBottom: '6px' }}>
        {q ? `Žádný produkt neodpovídá „${q}"` : 'Zatím žádné produkty'}
      </div>
      <div style={{ fontSize: '13px', color: MUTED }}>
        {!q && 'Použij „+ Přidat produkt" nebo importuj z Návrhů.'}
      </div>
    </div>
  )
}

function ProductCard({ product: p, onDeleted }: { product: CatalogProduct; onDeleted: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const badge = STATUS[p.status] ?? { label: p.status, bg: SURFACE, color: MUTED }

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  async function handleDelete() {
    if (!confirm(`Smazat draft „${p.name}"? Tato akce je nevratná.`)) return
    setDeleting(true)
    setMenuOpen(false)
    const res = await fetch(`/api/admin/products/${p.id}/delete`, { method: 'DELETE' })
    if (res.ok) onDeleted()
    else { alert('Smazání selhalo'); setDeleting(false) }
  }

  const previewUrl = p.review_slug ? `/${p.review_slug}/` : `/${p.slug}/`

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px',
      display: 'flex', gap: '12px', padding: '14px',
      opacity: deleting ? 0.4 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Thumbnail */}
      <div style={{
        width: '52px', height: '52px', flexShrink: 0,
        background: 'rgba(255,255,255,0.04)', borderRadius: '5px',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {p.hero_image ? (
          <img src={p.hero_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
        ) : (
          <span style={{ fontSize: '18px', opacity: 0.25 }}>🫙</span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + price */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </div>
            {p.brand && (
              <div style={{ fontSize: '11px', color: MUTED, marginTop: '1px' }}>{p.brand}</div>
            )}
          </div>
          {p.price_czk !== null && (
            <div style={{ fontSize: '13px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {Math.round(p.price_czk).toLocaleString('cs-CZ')} Kč
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '3px', background: badge.bg, color: badge.color, fontWeight: 500 }}>
            {badge.label}
          </span>
          {p.origin_region && (
            <span style={{ fontSize: '11px', color: MUTED }}>📍 {p.origin_region}</span>
          )}
          {p.acidity_pct !== null && (
            <span style={{ fontSize: '11px', color: MUTED }}>⚗ {p.acidity_pct.toFixed(2)} %</span>
          )}
          {p.retailer && (
            <span style={{ fontSize: '11px', color: MUTED }}>{p.retailer.name}</span>
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
          <Link href={`/admin/products/${p.id}/edit/`} style={{
            padding: '4px 10px', fontSize: '11px', fontWeight: 600,
            background: 'rgba(61,82,32,0.35)', color: '#9dce78',
            borderRadius: '4px', textDecoration: 'none',
          }}>
            Edit
          </Link>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{
            padding: '4px 10px', fontSize: '11px', fontWeight: 500,
            background: SURFACE2, color: MUTED,
            borderRadius: '4px', textDecoration: 'none',
          }}>
            Preview ↗
          </a>

          {/* ⋯ dropdown */}
          <div ref={menuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                padding: '4px 9px', fontSize: '14px', lineHeight: 1,
                background: SURFACE2, border: `1px solid ${BORDER}`,
                borderRadius: '4px', color: MUTED, cursor: 'pointer',
              }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                background: '#131f0a', border: `1px solid ${BORDER}`,
                borderRadius: '6px', padding: '4px', zIndex: 50,
                minWidth: '165px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <MenuItem label="Edit" href={`/admin/products/${p.id}/edit/`} onClick={() => setMenuOpen(false)} />
                <MenuItemExternal label="Preview ↗" href={previewUrl} onClick={() => setMenuOpen(false)} />
                <Divider />
                <MenuItemDisabled label="Archivovat" />
                <MenuItemDisabled label="Duplikovat" />
                {p.status === 'draft' && (
                  <>
                    <Divider />
                    <button onClick={handleDelete} style={{
                      width: '100%', textAlign: 'left', padding: '7px 10px',
                      fontSize: '12px', color: '#f87171',
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', borderRadius: '4px',
                    }}>
                      Smazat draft
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuItem({ label, href, onClick }: { label: string; href: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} style={{ display: 'block', padding: '7px 10px', fontSize: '12px', color: TEXT, textDecoration: 'none', borderRadius: '4px' }}>
      {label}
    </Link>
  )
}

function MenuItemExternal({ label, href, onClick }: { label: string; href: string; onClick: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{ display: 'block', padding: '7px 10px', fontSize: '12px', color: TEXT, textDecoration: 'none', borderRadius: '4px' }}>
      {label}
    </a>
  )
}

function MenuItemDisabled({ label }: { label: string }) {
  return (
    <div style={{ padding: '7px 10px', fontSize: '12px', color: MUTED, cursor: 'default', opacity: 0.5 }}>
      {label} <span style={{ fontSize: '10px' }}>(brzy)</span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: BORDER, margin: '3px 0' }} />
}
