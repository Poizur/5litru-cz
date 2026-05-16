import { supabaseAdmin } from '@/lib/supabase'
import { PageHeader } from '../_components/PageHeader'
import { COLORS } from '../_components/tokens'

export const dynamic = 'force-dynamic'

interface LogRow {
  id: number
  started_at: string
  duration_ms: number | null
  products_checked: number | null
  prices_updated: number | null
  suggestions_added: number | null
  status: 'running' | 'success' | 'partial' | 'failed'
  error_summary: string | null
  triggered_by: string | null
}

async function loadLogs(): Promise<LogRow[]> {
  const { data } = await supabaseAdmin
    .from('price_sync_log')
    .select('id,started_at,duration_ms,products_checked,prices_updated,suggestions_added,status,error_summary,triggered_by')
    .order('started_at', { ascending: false })
    .limit(30)
  return (data ?? []) as unknown as LogRow[]
}

const STATUS_BADGE: Record<LogRow['status'], { bg: string; color: string }> = {
  success: { bg: COLORS.publishedBg, color: COLORS.published },
  partial: { bg: COLORS.draftBg, color: COLORS.draft },
  failed:  { bg: COLORS.dangerBg, color: COLORS.danger },
  running: { bg: COLORS.surfaceAlt, color: COLORS.textSubtle },
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function SyncLogPage() {
  const logs = await loadLogs()

  return (
    <>
      <PageHeader
        title="Sync log"
        subtitle="Posledních 30 běhů Olivator syncu"
        right={
          <form method="POST" action="/api/admin/sync">
            <button
              type="submit"
              style={{
                background: COLORS.olive,
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >Spustit sync ručně</button>
          </form>
        }
      />

      <div style={{ padding: '24px 32px', maxWidth: '1400px', width: '100%' }}>
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
                <Th>Čas</Th>
                <Th>Trigger</Th>
                <Th align="right">Trvání</Th>
                <Th align="right">Cen ↻</Th>
                <Th align="right">Nové návrhy</Th>
                <Th>Stav</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                const badge = STATUS_BADGE[l.status]
                return (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <Td>
                      <span style={{ fontFamily: 'ui-monospace, monospace', color: COLORS.text }}>
                        {fmtTime(l.started_at)}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: COLORS.textMuted, fontSize: '12px' }}>{l.triggered_by ?? '—'}</span>
                    </Td>
                    <Td align="right">
                      <span style={{ fontFamily: 'ui-monospace, monospace', color: COLORS.textMuted }}>
                        {fmtDuration(l.duration_ms)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span style={{ fontFamily: 'ui-monospace, monospace', color: COLORS.text }}>
                        {l.prices_updated ?? 0}
                      </span>
                    </Td>
                    <Td align="right">
                      <span style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: (l.suggestions_added ?? 0) > 0 ? 600 : 400,
                        color: (l.suggestions_added ?? 0) > 0 ? COLORS.olive : COLORS.textMuted,
                      }}>
                        {l.suggestions_added ?? 0}
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
                      }}>{l.status}</span>
                      {l.error_summary && (
                        <span
                          title={l.error_summary}
                          style={{
                            display: 'block',
                            marginTop: '2px',
                            fontSize: '11px',
                            color: COLORS.danger,
                          }}
                        >{l.error_summary.slice(0, 50)}{l.error_summary.length > 50 ? '…' : ''}</span>
                      )}
                    </Td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: COLORS.textSubtle,
                  }}>
                    Žádné runy zatím. Spusť sync ručně tlačítkem nahoře.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '10px 14px',
      fontSize: '11px',
      fontWeight: 500,
      color: COLORS.textSubtle,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      textAlign: align ?? 'left',
    }}>{children}</th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: align ?? 'left' }}>{children}</td>
}
