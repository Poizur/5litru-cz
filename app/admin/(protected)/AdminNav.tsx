'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  badge?: number | null
}

interface Props {
  draftCount?: number
}

export function AdminNav({ draftCount }: Props) {
  const path = usePathname()

  const items: NavItem[] = [
    { href: '/admin/catalog/', label: 'Katalog' },
    { href: '/admin/drafts/', label: 'Drafts', badge: draftCount ?? null },
    { href: '/admin/suggestions/', label: 'Návrhy' },
    { href: '/admin/retailers/', label: 'Retailers' },
    { href: '/admin/sync-log/', label: 'Sync log' },
  ]

  return (
    <aside style={{
      width: '232px',
      minWidth: '232px',
      height: '100vh',
      background: '#F4F4F5',
      borderRight: '1px solid #E4E4E7',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      fontFamily: ADMIN_FONT,
    }}>
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{
          fontSize: '15px',
          fontWeight: 600,
          color: '#18181B',
          letterSpacing: '-0.015em',
        }}>
          5litru<span style={{ color: '#71717A', fontWeight: 400 }}>.cz</span>
        </div>
        <div style={{
          fontSize: '11px',
          color: '#71717A',
          marginTop: '1px',
          letterSpacing: '0',
        }}>
          Admin
        </div>
      </div>

      <div role="navigation" style={{ flex: 1, padding: '4px 8px' }}>
        {items.map(item => {
          const active = path.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                marginBottom: '1px',
                borderRadius: '6px',
                fontSize: '13.5px',
                fontWeight: active ? 500 : 400,
                color: active ? '#18181B' : '#52525B',
                background: active ? '#FFFFFF' : 'transparent',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04), inset 0 0 0 1px #E4E4E7' : 'none',
                textDecoration: 'none',
              }}
            >
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: active ? '#4A5D3A' : '#E4E4E7',
                  color: active ? '#FFFFFF' : '#52525B',
                  lineHeight: '16px',
                  minWidth: '20px',
                  textAlign: 'center',
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div style={{ padding: '8px 8px 14px', borderTop: '1px solid #E4E4E7' }}>
        <form method="POST" action="/api/admin/logout">
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#71717A',
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            ← Odhlásit
          </button>
        </form>
      </div>
    </aside>
  )
}

export const ADMIN_FONT =
  "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
