import { supabaseAdmin } from '@/lib/supabase'
import { PageHeader } from '../_components/PageHeader'
import { COLORS } from '../_components/tokens'

export const dynamic = 'force-dynamic'

interface SuggestionRow {
  olivator_product_id: string
  olivator_slug: string
  name: string
  brand_slug: string | null
  origin_country: string | null
  origin_region: string | null
  variety: string | null
  acidity: number | null
  olivator_score: number | null
  primary_offer_price: number | null
  primary_offer_url: string
  status: 'new' | 'imported' | 'ignored'
  imported_product_id: string | null
  discovered_at: string
}

async function loadSuggestions(): Promise<SuggestionRow[]> {
  const { data } = await supabaseAdmin
    .from('olivator_suggestions')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(100)
  return (data ?? []) as unknown as SuggestionRow[]
}

const STATUS_LABEL: Record<SuggestionRow['status'], { label: string; bg: string; color: string }> = {
  new:      { label: 'new',      bg: COLORS.draftBg,     color: COLORS.draft },
  imported: { label: 'imported', bg: COLORS.publishedBg, color: COLORS.published },
  ignored:  { label: 'ignored',  bg: COLORS.surfaceAlt,  color: COLORS.textSubtle },
}

export default async function SuggestionsPage() {
  const items = await loadSuggestions()
  const newCount = items.filter(i => i.status === 'new').length

  return (
    <>
      <PageHeader
        title="Návrhy"
        subtitle={`${items.length} návrhů celkem · ${newCount} nových${newCount > 0 ? ' — drafty se vytvoří automaticky při příštím Olivator syncu' : ''}`}
      />

      <div style={{ padding: '24px 32px', maxWidth: '1400px', width: '100%' }}>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            background: '#FFFFFF',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{
                  background: COLORS.surface,
                  borderBottom: `1px solid ${COLORS.border}`,
                  textAlign: 'left',
                }}>
                  <Th>Olivator name</Th>
                  <Th>Původ</Th>
                  <Th>Skóre</Th>
                  <Th>Cena</Th>
                  <Th>Status</Th>
                  <Th>Discovered</Th>
                </tr>
              </thead>
              <tbody>
                {items.map(s => {
                  const badge = STATUS_LABEL[s.status]
                  return (
                    <tr key={s.olivator_product_id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <Td>
                        <div style={{ fontWeight: 500, color: COLORS.text }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: COLORS.textSubtle, marginTop: '2px' }}>
                          {s.olivator_slug}
                        </div>
                      </Td>
                      <Td>
                        <span style={{ color: COLORS.textMuted }}>
                          {[s.origin_country, s.origin_region].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ fontFamily: 'ui-monospace, monospace', color: COLORS.textMuted }}>
                          {s.olivator_score ?? '—'}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ fontFamily: 'ui-monospace, monospace', color: COLORS.textMuted }}>
                          {s.primary_offer_price != null ? `${Math.round(s.primary_offer_price)} Kč` : '—'}
                        </span>
                      </Td>
                      <Td>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: badge.bg,
                          color: badge.color,
                          textTransform: 'uppercase',
                        }}>{badge.label}</span>
                        {s.imported_product_id && (
                          <a
                            href={`/admin/preview/${s.imported_product_id}/`}
                            style={{
                              fontSize: '12px',
                              color: COLORS.olive,
                              textDecoration: 'none',
                              marginLeft: '8px',
                            }}
                          >→ náhled</a>
                        )}
                      </Td>
                      <Td>
                        <span style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '12px',
                          color: COLORS.textSubtle,
                        }}>
                          {new Date(s.discovered_at).toLocaleDateString('cs-CZ', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                          })}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{
          marginTop: '20px',
          fontSize: '12px',
          color: COLORS.textSubtle,
          lineHeight: 1.6,
        }}>
          Návrhy přicházejí denně z Olivator syncu (Railway cron 06:00). Nové oleje s nabídkou
          u Reckonasbavi se automaticky vygenerují jako drafty — uvidíš je v záložce <strong>Drafts</strong>.
        </p>
      </div>
    </>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '10px 14px',
      fontSize: '11px',
      fontWeight: 500,
      color: COLORS.textSubtle,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>{children}</th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{children}</td>
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '64px 24px',
      border: `1px dashed ${COLORS.border}`,
      borderRadius: '8px',
      background: COLORS.surface,
    }}>
      <div style={{ fontSize: '15px', color: COLORS.text, marginBottom: '6px', fontWeight: 500 }}>
        Žádné návrhy
      </div>
      <div style={{ fontSize: '13px', color: COLORS.textSubtle }}>
        Po příštím Olivator syncu se sem objeví nové oleje.
      </div>
    </div>
  )
}
