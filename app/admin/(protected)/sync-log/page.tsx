import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface LogRow {
  id: number
  started_at: string
  finished_at: string | null
  products_checked: number | null
  prices_updated: number | null
  prices_unchanged: number | null
  prices_missing: number | null
  suggestions_added: number | null
  suggestions_skipped: number | null
  status: 'running' | 'success' | 'partial' | 'failed'
  error_summary: string | null
  duration_ms: number | null
  triggered_by: string | null
}

const STATUS_BADGE: Record<LogRow['status'], string> = {
  success: 'bg-[color:var(--color-olive)] text-white',
  partial: 'bg-[color:var(--color-gold)] text-[color:var(--color-dark)]',
  failed: 'bg-[#c00] text-white',
  running: 'bg-[rgba(0,0,0,0.1)] text-[color:var(--color-muted)]',
}

const TRIGGER_LABEL: Record<string, string> = {
  cron: '🕒 cron',
  admin_manual: '👤 manual',
  cli_test: '🧪 cli',
}

async function loadLogs(): Promise<LogRow[]> {
  const { data } = await supabaseAdmin
    .from('price_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)
  return (data ?? []) as unknown as LogRow[]
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function SyncLogPage() {
  const logs = await loadLogs()

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
            Sync log
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-[color:var(--color-text)] md:text-4xl">
            Historie Olivator syncu
            <span className="ml-3 font-sans text-base font-normal text-[color:var(--color-muted)]">
              posledních {logs.length}
            </span>
          </h1>
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

      <div className="mt-8 overflow-x-auto rounded-[4px] border border-[color:var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-olive-pale)] text-left font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-olive)]">
            <tr>
              <th className="px-4 py-3">Čas</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3 text-right">Trvání</th>
              <th className="px-4 py-3 text-right">Cen ↻</th>
              <th className="px-4 py-3 text-right">Cen =</th>
              <th className="px-4 py-3 text-right">Cen ⚠</th>
              <th className="px-4 py-3 text-right">Nové návrhy</th>
              <th className="px-4 py-3">Stav</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-[color:var(--color-border)] last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-text)]">
                  {fmtTime(l.started_at)}
                </td>
                <td className="px-4 py-3 text-xs text-[color:var(--color-muted)]">
                  {TRIGGER_LABEL[l.triggered_by ?? ''] ?? l.triggered_by ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-text)]">
                  {fmtDuration(l.duration_ms)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-olive)]">
                  {l.prices_updated ?? 0}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-muted)]">
                  {l.prices_unchanged ?? 0}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-muted)]">
                  {l.prices_missing ?? 0}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span
                    className={
                      (l.suggestions_added ?? 0) > 0 ? 'font-semibold text-[color:var(--color-olive)]' : 'text-[color:var(--color-muted)]'
                    }
                  >
                    {l.suggestions_added ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-[2px] px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${STATUS_BADGE[l.status]}`}
                  >
                    {l.status}
                  </span>
                  {l.error_summary && (
                    <p className="mt-1 text-[11px] text-[#c00]" title={l.error_summary}>
                      {l.error_summary.slice(0, 60)}
                      {l.error_summary.length > 60 ? '…' : ''}
                    </p>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[color:var(--color-muted)]">
                  Žádné runy zatím. Spusť sync ručně tlačítkem výše.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
