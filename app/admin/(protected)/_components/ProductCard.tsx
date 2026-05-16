'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { COLORS } from './tokens'

export interface CardProduct {
  id: string
  slug: string
  review_slug: string | null
  name: string
  brand: string | null
  origin_region: string | null
  price_czk: number | null
  status: string
  hero_image: string | null
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'DRAFT',     bg: COLORS.draftBg,     color: COLORS.draft },
  published: { label: 'PUBLISHED', bg: COLORS.publishedBg, color: COLORS.published },
  archived:  { label: 'ARCHIVED',  bg: COLORS.surfaceAlt,  color: COLORS.textSubtle },
}

export function ProductCard({ product, onChanged }: { product: CardProduct; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const badge = STATUS[product.status] ?? STATUS.draft

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const previewHref = `/admin/preview/${product.id}/`
  const publicHref = product.review_slug ? `/${product.review_slug}/` : null

  async function handleDelete() {
    if (!confirm(`Smazat „${product.name}"? Tato akce je nevratná.`)) return
    setBusy(true)
    setMenuOpen(false)
    const res = await fetch(`/api/admin/products/${product.id}/delete`, { method: 'DELETE' })
    if (res.ok) onChanged()
    else { alert('Smazání selhalo'); setBusy(false) }
  }

  async function handleArchive() {
    setBusy(true)
    setMenuOpen(false)
    const res = await fetch(`/api/admin/products/${product.id}/archive`, { method: 'POST' })
    if (res.ok) router.refresh()
    else { alert('Archivace selhala'); setBusy(false) }
  }

  return (
    <article style={{
      background: '#FFFFFF',
      border: `1px solid ${COLORS.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      opacity: busy ? 0.5 : 1,
      transition: 'opacity 0.2s, border-color 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = COLORS.borderStrong
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = COLORS.border
      e.currentTarget.style.boxShadow = 'none'
    }}
    >
      <Link href={previewHref} style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}>
        <div style={{
          background: COLORS.surface,
          aspectRatio: '16 / 10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          {product.hero_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.hero_image}
              alt={product.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: '24px',
              }}
            />
          ) : (
            <span style={{ fontSize: '40px', opacity: 0.2 }}>🫙</span>
          )}
        </div>
      </Link>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link href={previewHref} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 500,
                color: COLORS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.005em',
              }}>
                {product.name}
              </div>
            </Link>
            <div style={{ fontSize: '12px', color: COLORS.textSubtle, marginTop: '2px' }}>
              {[product.brand, product.origin_region].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>

          {/* Menu */}
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Více akcí"
              style={{
                padding: '4px 8px',
                fontSize: '15px',
                lineHeight: 1,
                background: 'transparent',
                border: 'none',
                borderRadius: '5px',
                color: COLORS.textSubtle,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = COLORS.surfaceAlt }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >⋯</button>
            {menuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                background: '#FFFFFF',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '6px',
                padding: '4px',
                zIndex: 50,
                minWidth: '160px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                <MenuItem label="Otevřít náhled" href={previewHref} onClick={() => setMenuOpen(false)} />
                {publicHref && (
                  <MenuItemExt label="Otevřít na webu ↗" href={publicHref} onClick={() => setMenuOpen(false)} />
                )}
                <Divider />
                {product.status === 'published' && (
                  <MenuAction label="Archivovat" onClick={handleArchive} />
                )}
                <MenuAction label="Smazat" onClick={handleDelete} danger />
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            padding: '2px 7px',
            borderRadius: '4px',
            background: badge.bg,
            color: badge.color,
          }}>
            {badge.label}
          </span>
          {product.price_czk != null && (
            <span style={{
              fontSize: '13px',
              fontWeight: 500,
              color: COLORS.text,
            }}>
              {Math.round(product.price_czk).toLocaleString('cs-CZ')} Kč
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function MenuItem({ label, href, onClick }: { label: string; href: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} style={{
      display: 'block',
      padding: '7px 10px',
      fontSize: '13px',
      color: COLORS.text,
      textDecoration: 'none',
      borderRadius: '4px',
    }}>{label}</Link>
  )
}

function MenuItemExt({ label, href, onClick }: { label: string; href: string; onClick: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{
      display: 'block',
      padding: '7px 10px',
      fontSize: '13px',
      color: COLORS.text,
      textDecoration: 'none',
      borderRadius: '4px',
    }}>{label}</a>
  )
}

function MenuAction({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '7px 10px',
      fontSize: '13px',
      color: danger ? COLORS.danger : COLORS.text,
      background: 'transparent',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}>{label}</button>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: COLORS.border, margin: '4px 0' }} />
}
