import { supabaseAdmin } from '@/lib/supabase'
import type { Retailer } from '@/lib/types'
import { PageHeader } from '../_components/PageHeader'
import { COLORS } from '../_components/tokens'

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
      <PageHeader title="Retailers" subtitle={`${retailers.length} e-shopů s affiliate`} />

      <div style={{ padding: '24px 32px', maxWidth: '1100px', width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '12px',
        }}>
          {retailers.map(r => (
            <article key={r.id} style={{
              background: '#FFFFFF',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              padding: '16px 18px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: COLORS.text,
                    letterSpacing: '-0.005em',
                  }}>{r.name}</div>
                  <div style={{ fontSize: '12px', color: COLORS.textSubtle, marginTop: '2px' }}>{r.slug}</div>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: r.active ? COLORS.publishedBg : COLORS.surfaceAlt,
                  color: r.active ? COLORS.published : COLORS.textSubtle,
                  textTransform: 'uppercase',
                }}>{r.active ? 'Active' : 'Inactive'}</span>
              </div>

              <dl style={{ marginTop: '14px', display: 'grid', gap: '8px', fontSize: '12px' }}>
                <Row label="Base URL">
                  <a
                    href={r.base_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: COLORS.olive, textDecoration: 'none' }}
                  >{r.base_url.replace(/^https?:\/\//, '')}</a>
                </Row>
                <Row label="Network">{r.affiliate_network}</Row>
                <Row label="eHub hash">
                  <code style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '11px',
                    color: COLORS.text,
                  }}>{mask(r.ehub_tracking_hash)}</code>
                </Row>
                <Row label="UTM campaign">
                  <code style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '11px',
                    color: COLORS.text,
                  }}>{r.utm_campaign}</code>
                </Row>
              </dl>
            </article>
          ))}
          {retailers.length === 0 && (
            <p style={{
              gridColumn: '1 / -1',
              padding: '32px',
              textAlign: 'center',
              fontSize: '13px',
              color: COLORS.textSubtle,
              border: `1px dashed ${COLORS.border}`,
              borderRadius: '8px',
              background: COLORS.surface,
            }}>Žádný retailer v DB.</p>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
      <dt style={{
        width: '88px',
        flexShrink: 0,
        fontSize: '11px',
        color: COLORS.textSubtle,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>{label}</dt>
      <dd style={{ flex: 1, margin: 0 }}>{children}</dd>
    </div>
  )
}
