'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin/catalog/', label: 'Katalog', icon: '▦' },
  { href: '/admin/suggestions/', label: 'Návrhy', icon: '✦' },
  { href: '/admin/add/', label: 'Přidat z URL', icon: '+' },
  { href: '/admin/retailers/', label: 'Retailers', icon: '⊛' },
  { href: '/admin/sync-log/', label: 'Sync log', icon: '↻' },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <div style={{
      width: '220px', minWidth: '220px', height: '100vh',
      background: '#0a1306', borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', color: '#8fa87a', textTransform: 'uppercase', marginBottom: '3px' }}>
          Admin
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e8eddf', letterSpacing: '-0.01em' }}>
          5litru<span style={{ color: '#c4973e' }}>.cz</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 6px' }}>
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '7px 10px', borderRadius: '5px', marginBottom: '1px',
              fontSize: '13px', fontWeight: active ? 500 : 400,
              color: active ? '#e8eddf' : '#8fa87a',
              background: active ? 'rgba(61,82,32,0.3)' : 'transparent',
              borderLeft: `2px solid ${active ? '#c4973e' : 'transparent'}`,
              textDecoration: 'none',
            }}>
              <span style={{ fontSize: '11px', opacity: 0.75 }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <form method="POST" action="/api/admin/logout">
          <button type="submit" style={{
            width: '100%', padding: '7px 10px', background: 'transparent',
            border: 'none', borderRadius: '5px', color: '#8fa87a',
            fontSize: '13px', cursor: 'pointer', textAlign: 'left',
          }}>
            ← Odhlásit
          </button>
        </form>
      </div>
    </div>
  )
}
